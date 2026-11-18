#!/usr/bin/env python3
"""Build attested Greek lemmas from pinned N1904 with explicit annotation errata."""
import argparse
import collections
import csv
import hashlib
import json
import os
import tempfile
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / 'public/data/original-languages'
ERRATA = Path(__file__).with_name('greek-nt-metadata-errata.json')


def build(source, corpus, errata):
    raw = source.read_bytes()
    source_sha = hashlib.sha256(raw).hexdigest()
    assert source_sha == corpus['sources'][0]['sha256'], 'Wrong morphology source'
    assert errata['schemaVersion'] == 1 and errata['sourceId'] == 'N1904'
    assert errata['sourceSha256'] == source_sha, 'Errata refer to a different source'
    groups = collections.OrderedDict()
    lemmas, lemma_ids = [], {}

    def lemma_id(lemma, strongs):
        assert lemma.strip(), 'Missing lemma'
        if lemma not in lemma_ids:
            lemma_ids[lemma] = len(lemmas)
            lemmas.append({'lemma': lemma, 'strongs': []})
        index = lemma_ids[lemma]
        strong = strongs.split('&')[0]
        if strong.isdecimal() and strong not in lemmas[index]['strongs']:
            lemmas[index]['strongs'].append(strong)
        return index

    # Preserve original lemma indexes; corrected new lemmas are appended.
    for row in csv.DictReader(raw.decode('utf-8-sig').splitlines(), delimiter='\t'):
        groups.setdefault(row['BCV'], []).append(row)
        lemma_id(row['lemma'], row['strongs'])
    canonical_lemmas = {unicodedata.normalize('NFC', lemma): lemma for lemma in lemma_ids}
    source_books = list(dict.fromkeys(key.split(' ')[0] for key in groups))
    assert len(source_books) == len(corpus['books']) == 27
    mapping = dict(zip(source_books, corpus['books']))
    corrections = {}
    for correction in errata['corrections']:
        ref = correction['reference']
        key = (ref['book'], ref['chapter'], ref['verse'], correction['tokenIndex'])
        assert key not in corrections, 'Duplicate metadata correction'
        assert correction['reason'].strip() and correction['evidence'], 'Missing correction evidence'
        corrections[key] = correction
    applied, books = set(), []
    for osis, book in mapping.items():
        verses = {}
        for chapter in book['chapters']:
            for verse in chapter['verses']:
                key = f"{chapter['number']}:{verse['number']}"
                rows = groups[f'{osis} {key}']
                assert ' '.join(row['text'] for row in rows) == verse['text'], f'Text differs: {osis} {key}'
                words, offset = [], 0
                for token_index, row in enumerate(rows):
                    occurrence = (book['name'], chapter['number'], verse['number'], token_index)
                    annotation = row
                    if occurrence in corrections:
                        correction = corrections[occurrence]
                        assert row['text'] == correction['text'], f'Erratum text changed: {occurrence}'
                        assert all(row[field] == value for field, value in correction['original'].items()), f'Erratum original annotation changed: {occurrence}'
                        annotation = {**row, **correction['corrected']}
                        # Tonos and oxia are canonically equivalent Greek
                        # accents, not separate entries in the concordance.
                        annotation['lemma'] = canonical_lemmas.get(unicodedata.normalize('NFC', annotation['lemma']), annotation['lemma'])
                        applied.add(occurrence)
                    index = lemma_id(annotation['lemma'], annotation['strongs'])
                    words.append([offset, offset + len(row['text']), index])
                    offset += len(row['text']) + 1
                verses[key] = words
        books.append({'name': book['name'], 'verses': verses})
    assert applied == set(corrections), 'Metadata correction did not match an exact source occurrence'
    return {'schemaVersion': 1, 'sourceId': 'N1904', 'sourceSha256': source_sha,
            'revision': corpus['sources'][0]['revision'], 'license': 'CC0',
            'metadataCorrections': errata['corrections'], 'lemmas': lemmas, 'books': books}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source', type=Path, help='Pinned Nestle1904/morph/Nestle1904.csv')
    parser.add_argument('--output', type=Path, default=DATA / 'greek-concordance.json')
    args = parser.parse_args()
    corpus = json.loads((DATA / 'greek-nt-n1904.json').read_text())
    result = build(args.source, corpus, json.loads(ERRATA.read_text()))
    result['metadataErrataSha256'] = hashlib.sha256(ERRATA.read_bytes()).hexdigest()
    args.output.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(dir=args.output.parent, delete=False) as target:
        target.write((json.dumps(result, ensure_ascii=False, separators=(',', ':')) + '\n').encode())
        temporary = Path(target.name)
    os.replace(temporary, args.output)
    print(json.dumps({'books': len(result['books']), 'lemmas': len(result['lemmas']),
                      'words': sum(len(w) for b in result['books'] for w in b['verses'].values()),
                      'metadataCorrections': len(result['metadataCorrections']), 'bytes': args.output.stat().st_size}))


if __name__ == '__main__':
    main()
