#!/usr/bin/env python3
"""Preserve exact N1904 morphology for the Romans/Colossians review pilot.

The published analysis is copied, never inferred from English or Russian.
Functional/form-oriented tags remain two annotations of the same source token.
"""
import argparse
import collections
import csv
import hashlib
import json
import os
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / 'public/data/original-languages'
REVISION = '713f28a3b7d4d66132f5aa809fa223fe79762e5d'
SOURCE_SHA = '3beee6abb6302f691110fe0fc949fc195593b999cf2d0e463c9b573c1bb67150'
SCOPE = {'Rom': ('Romans', 7100), 'Col': ('Colossians', 1575)}
DOCS = Path(__file__).with_name('morphology-sources')
BASE_URL = f'https://github.com/biblicalhumanities/Nestle1904/blob/{REVISION}/morph/'
DOCUMENTS = [
    ('n1904-morphology-README.md', 'README.md', 'cb1e85834cac9a6a5509c0ddf7de4cf3b9aec986cf5e04ffb313fa57f59fa280'),
    ('n1904-parsing.txt', 'parsing.txt', '777b2b93acddb162dad0cfa9ad83c1dba5064fd5930163704e7da02f7eeeddb8'),
]


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def build(source, corpus):
    raw = source.read_bytes()
    assert hashlib.sha256(raw).hexdigest() == SOURCE_SHA, 'Morphology source is not the pinned N1904 CSV'
    assert corpus['sources'][0]['sha256'] == SOURCE_SHA, 'Displayed Greek belongs to a different source'
    assert corpus['sources'][0]['revision'] == REVISION, 'Displayed Greek revision differs'
    books = {book['name']: book for book in corpus['books']}
    rows = collections.defaultdict(list)
    for row in csv.DictReader(raw.decode('utf-8-sig').splitlines(), delimiter='\t'):
        osis, reference = row['BCV'].split()
        if osis in SCOPE:
            rows[(osis, reference)].append(row)
    lemmas, lemma_ids, codes, code_ids = [], {}, [], {}
    output_books = []
    differences = total = 0
    for osis, (name, expected_count) in SCOPE.items():
        verses, book_count = {}, 0
        for chapter in books[name]['chapters']:
            for verse in chapter['verses']:
                ref = f"{chapter['number']}:{verse['number']}"
                source_rows = rows[(osis, ref)]
                text = verse['text']
                assert all(ord(character) <= 0xFFFF for character in text), 'Pilot offset conversion requires a reviewed non-BMP character policy'
                assert ' '.join(row['text'] for row in source_rows) == text, f'Exact Greek text differs: {name} {ref}'
                words, offset = [], 0
                for token_index, row in enumerate(source_rows):
                    lemma = row['lemma']
                    assert lemma and row['func_morph'] and row['form_morph'], f'Incomplete source row: {name} {ref}:{token_index}'
                    if lemma not in lemma_ids:
                        lemma_ids[lemma] = len(lemmas)
                        lemmas.append({'lemma': lemma, 'strongs': []})
                    lemma_id = lemma_ids[lemma]
                    # Upstream warns that the optional trailing TVM number is
                    # not synchronized with morphology. Never decode that TVM.
                    strong = row['strongs'].split('&')[0]
                    if strong.isdecimal() and strong not in lemmas[lemma_id]['strongs']:
                        lemmas[lemma_id]['strongs'].append(strong)
                    for code in [row['func_morph'], row['form_morph']]:
                        if code not in code_ids:
                            code_ids[code] = len(codes)
                            codes.append(code)
                    end = offset + len(row['text'])
                    assert text[offset:end] == row['text'], f'Word offset differs: {name} {ref}:{token_index}'
                    words.append([offset, end, lemma_id, code_ids[row['func_morph']], code_ids[row['form_morph']]])
                    offset = end + 1
                    differences += row['func_morph'] != row['form_morph']
                    book_count += 1
                verses[ref] = {'text': text, 'words': words}
        assert book_count == expected_count, f'Unexpected pilot count: {name}'
        total += book_count
        output_books.append({'name': name, 'verses': verses})
    assert total == 8675 and differences == 71 and len(codes) == 491, 'Pilot annotation inventory changed'
    docs = []
    for filename, original, expected_sha in DOCUMENTS:
        path = DOCS / filename
        assert path.exists(), f'Missing pinned source documentation: {filename}'
        assert sha(path) == expected_sha, f'Pinned code documentation changed: {filename}'
        docs.append({'title': 'Morphology source documentation' if original == 'README.md' else 'Robinson-like parsing code guide',
                     'url': BASE_URL + original, 'sha256': sha(path), 'localFile': f'scripts/original-languages/morphology-sources/{filename}'})
    return {'schemaVersion': 1, 'sourceId': 'N1904', 'sourceSha256': SOURCE_SHA, 'revision': REVISION,
            'scope': {'books': [value[0] for value in SCOPE.values()], 'words': total, 'differentAnalysisTags': differences, 'distinctCodes': len(codes)},
            'provenance': {'title': 'Nestle 1904 morphology by Ulrik Sandborg-Petersen, based on Maurice A. Robinson',
                           'url': BASE_URL + 'Nestle1904.csv', 'license': 'CC0',
                           'licenseUrl': 'https://creativecommons.org/publicdomain/zero/1.0/',
                           'documents': docs, 'analysisNote': 'Functional and form-oriented tags are two analyses of the same printed token, not different textual readings. The optional Strong TVM suffix is not used.'},
            'wordSchema': ['startOffset', 'endOffset', 'lemmaId', 'functionalCodeId', 'formCodeId'],
            'lemmas': lemmas, 'codes': codes, 'books': output_books}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source', type=Path, help='Exact pinned Nestle1904.csv')
    parser.add_argument('--output', type=Path, default=DATA / 'greek-morphology-pilot.json')
    args = parser.parse_args()
    result = build(args.source, json.loads((DATA / 'greek-nt-n1904.json').read_text()))
    args.output.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(dir=args.output.parent, delete=False) as target:
        target.write((json.dumps(result, ensure_ascii=False, separators=(',', ':')) + '\n').encode())
        temporary = Path(target.name)
    os.replace(temporary, args.output)
    print(json.dumps({'books': result['scope']['books'], 'words': result['scope']['words'],
                      'differentTags': result['scope']['differentAnalysisTags'], 'codes': len(result['codes']),
                      'bytes': args.output.stat().st_size, 'sha256': sha(args.output)}))


if __name__ == '__main__':
    main()
