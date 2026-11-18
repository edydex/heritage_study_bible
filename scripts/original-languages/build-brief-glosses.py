#!/usr/bin/env python3
"""Extract pinned STEPBible English lexical glosses for exact N1904 lemmas."""
import argparse
import collections
import hashlib
import json
import re
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SOURCE_REVISION = '5de0a47f35f0fc13dfe1430d104e5db8a4285f9c'
SOURCE_SHA256 = '734a5b64a1152f67604bf09d32f15c0ba537151961752fcf168087b41b4d93ea'
SOURCE_FILENAME = 'TBESG - Translators Brief lexicon of Extended Strongs for Greek - STEPBible.org CC BY.txt'
SOURCE_URL = f'https://github.com/STEPBible/STEPBible-Data/blob/{SOURCE_REVISION}/Lexicons/' + SOURCE_FILENAME.replace(' ', '%20')
CONCORDANCE_SOURCE_SHA256 = '3beee6abb6302f691110fe0fc949fc195593b999cf2d0e463c9b573c1bb67150'
CONCORDANCE_INVENTORY_SHA256 = '8e59397d4e6bc15f42ed69fb08db54ad69773f9b80aa99eb51d39a040bfbadae'


def normalized_strongs(values):
    if not isinstance(values, list) or not values or any(not isinstance(v, str) or not re.fullmatch(r'[0-9]+', v) or int(v) <= 0 for v in values):
        raise ValueError('Expected actual positive base Strong numbers')
    return sorted({str(int(v)) for v in values}, key=int)


def parse_records(raw):
    """Only the eight-column lexical table, never biographies or definitions."""
    records = []
    for line in raw.decode('utf-8-sig').splitlines():
        if not re.match(r'^G[0-9]{4,5}\t', line):
            continue
        fields = line.split('\t')
        if len(fields) != 8:
            raise ValueError('Unexpected TBESG lexical columns')
        estrong, dstrong, _, greek, _, _, gloss, _ = fields
        # A named-person relation record has no Greek headword. It cannot
        # establish a lexical identity. A blank gloss likewise supplies none.
        if not greek.strip() or not gloss.strip():
            continue
        for headword in greek.split(','):
            if not headword.strip():
                raise ValueError('Missing publisher headword')
            records.append({'strong': str(int(estrong[1:])),
                            'headword': unicodedata.normalize('NFC', headword.strip()),
                            'sourceId': dstrong.split()[0], 'gloss': gloss.strip()})
    if not records:
        raise ValueError('No lexical records')
    return records


def index_records(records):
    index = collections.defaultdict(list)
    for record in records:
        index[(record['headword'], record['strong'])].append(record)
    return index


def match_lemma(lemma, index):
    """NFC equivalence only: preserve case, accents, homographs and base IDs."""
    strongs = normalized_strongs(lemma['strongs'])
    matches = [record for strong in strongs for record in index.get((unicodedata.normalize('NFC', lemma['lemma']), strong), [])]
    entry = {'lemma': lemma['lemma'], 'strongs': strongs,
             'status': 'available' if matches else 'unavailable',
             'glosses': list(dict.fromkeys(record['gloss'] for record in matches)),
             'matches': [list(row) for row in dict.fromkeys((record['strong'], record['sourceId'], record['gloss']) for record in matches)]}
    if not matches:
        entry['reason'] = 'No exact NFC headword and base Strong identity in the pinned lexicon.'
    return entry


def build(raw, concordance):
    if hashlib.sha256(raw).hexdigest() != SOURCE_SHA256:
        raise ValueError('TBESG source hash differs from the pinned publisher file')
    if concordance.get('sourceId') != 'N1904' or concordance.get('sourceSha256') != CONCORDANCE_SOURCE_SHA256 or len(concordance.get('lemmas', [])) != 5402:
        raise ValueError('Concordance inventory differs from the pinned N1904 source')
    inventory = concordance['lemmas']
    inventory_sha = hashlib.sha256(json.dumps(inventory, ensure_ascii=False, separators=(',', ':')).encode()).hexdigest()
    if inventory_sha != CONCORDANCE_INVENTORY_SHA256:
        raise ValueError('Actual concordance lemma identities differ from the pinned inventory')
    index = index_records(parse_records(raw))
    entries = [match_lemma(lemma, index) for lemma in inventory]
    keys = [unicodedata.normalize('NFC', e['lemma']) for e in entries]
    if len(keys) != len(set(keys)):
        raise ValueError('Ambiguous concordance identity')
    available = sum(e['status'] == 'available' for e in entries)
    return {'schemaVersion': 1, 'sourceId': 'STEP-TBESG', 'language': 'en',
            'matchSchema': ['baseStrong', 'publisherDStrong', 'englishGloss'],
            'source': {'title': 'STEPBible Translators Brief Lexicon of Extended Strongs for Greek (TBESG)',
                       'url': SOURCE_URL, 'revision': SOURCE_REVISION, 'sha256': SOURCE_SHA256,
                       'license': 'CC BY 4.0', 'licenseUrl': 'https://creativecommons.org/licenses/by/4.0/',
                       'attribution': 'Tyndale House, Cambridge and STEPBible.org (https://www.stepbible.org). Source: https://STEPBible.github.io/STEPBible-Data.',
                       'notice': 'Filtered and reformatted for Heritage: only publisher English Gloss fields with an exact NFC Greek headword and matching base Strong identity are retained. Surrounding field whitespace is trimmed; distinct glosses are retained without choosing a contextual sense. Definitions, biographies and contextual translation frequencies are excluded.'},
            'concordance': {'sourceId': 'N1904', 'sourceSha256': CONCORDANCE_SOURCE_SHA256,
                            'lemmaInventorySha256': inventory_sha, 'lemmaCount': len(entries)},
            'counts': {'available': available, 'unavailable': len(entries) - available,
                       'multipleGlosses': sum(len(e['glosses']) > 1 for e in entries)},
            'entries': entries}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source', type=Path, help='Exact pinned TBESG publisher file (kept outside committed sources)')
    parser.add_argument('--concordance', type=Path, default=ROOT / 'public/data/original-languages/greek-concordance.json')
    parser.add_argument('--output', type=Path, default=ROOT / 'public/data/original-languages/greek-brief-glosses.json')
    parser.add_argument('--check', action='store_true', help='Compare reproducible output without writing')
    args = parser.parse_args()
    result = build(args.source.read_bytes(), json.loads(args.concordance.read_text()))
    output = (json.dumps(result, ensure_ascii=False, separators=(',', ':')) + '\n').encode()
    if args.check:
        if args.output.read_bytes() != output:
            raise SystemExit('Generated brief glosses differ')
    else:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_bytes(output)
    print(json.dumps({'counts': result['counts'], 'bytes': len(output), 'sha256': hashlib.sha256(output).hexdigest(),
                      'lemmaInventorySha256': result['concordance']['lemmaInventorySha256']}))


if __name__ == '__main__':
    main()
