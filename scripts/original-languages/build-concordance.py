#!/usr/bin/env python3
"""Build attested Greek lemmas/occurrences from the same pinned N1904 source."""
import argparse, collections, csv, hashlib, json
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument('source', type=Path, help='Nestle1904/morph/Nestle1904.csv at the installed revision')
args = parser.parse_args()
root = Path(__file__).resolve().parents[2]
corpus = json.loads((root / 'public/data/original-languages/greek-nt-n1904.json').read_text())
raw = args.source.read_bytes()
assert hashlib.sha256(raw).hexdigest() == corpus['sources'][0]['sha256'], 'Wrong morphology source'
groups = collections.OrderedDict()
for row in csv.DictReader(raw.decode('utf-8-sig').splitlines(), delimiter='\t'):
    groups.setdefault(row['BCV'], []).append(row)
source_books = list(dict.fromkeys(key.split(' ')[0] for key in groups))
assert len(source_books) == len(corpus['books']) == 27
mapping = dict(zip(source_books, corpus['books']))
lemmas, lemma_ids, books = [], {}, []
for osis, book in mapping.items():
    verses = {}
    for chapter in book['chapters']:
        for verse in chapter['verses']:
            key = f"{chapter['number']}:{verse['number']}"
            rows = groups[f'{osis} {key}']
            assert ' '.join(row['text'] for row in rows) == verse['text'], f'Text differs: {osis} {key}'
            words, offset = [], 0
            for row in rows:
                lemma = row['lemma']
                assert lemma.strip(), f'Missing lemma: {osis} {key}'
                if lemma not in lemma_ids:
                    lemma_ids[lemma] = len(lemmas)
                    lemmas.append({'lemma': lemma, 'strongs': []})
                index = lemma_ids[lemma]
                strong = row['strongs'].split('&')[0]
                if strong.isdecimal() and strong not in lemmas[index]['strongs']: lemmas[index]['strongs'].append(strong)
                words.append([offset, offset + len(row['text']), index])
                offset += len(row['text']) + 1
            verses[key] = words
    books.append({'name': book['name'], 'verses': verses})
result = {'schemaVersion': 1, 'sourceId': 'N1904', 'sourceSha256': corpus['sources'][0]['sha256'],
          'revision': corpus['sources'][0]['revision'], 'license': 'CC0', 'lemmas': lemmas, 'books': books}
path = root / 'public/data/original-languages/greek-concordance.json'
path.write_text(json.dumps(result, ensure_ascii=False, separators=(',', ':')) + '\n')
print(json.dumps({'books': len(books), 'lemmas': len(lemmas), 'words': sum(len(w) for b in books for w in b['verses'].values()), 'bytes': path.stat().st_size}))
