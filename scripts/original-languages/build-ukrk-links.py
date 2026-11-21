#!/usr/bin/env python3
"""Build reviewed N1904 links for the installed Ukrainian Kulish/Pulyui edition."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import tempfile

from reviewed_link_resources import apply_reviews, approved_resources, compiler, pinned, read, require, sha

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / 'public/data/original-languages'
TRANSLATIONS = ROOT / 'public/data/translations'
TARGET_ID = 'UKRK'

def book_filename(name):
    return name.lower().replace(' ', '-') + '.json'


def target_verses(corpus, names):
    require(corpus['translation'] == TARGET_ID, 'Wrong Ukrainian edition')
    targets = {}
    for book in corpus['books']:
        name = book['name']
        if name not in names:
            continue
        require(name not in targets, f'Duplicate Ukrainian book: {name}')
        shard = read(TRANSLATIONS / TARGET_ID / book_filename(name))
        require(shard == book, f'Installed Ukrainian book differs from its sharded text: {name}')
        verses, chapters = {}, set()
        for chapter in book['chapters']:
            number = chapter['number']
            require(type(number) is int and number > 0 and number not in chapters, f'Invalid Ukrainian chapter: {name} {number}')
            chapters.add(number)
            for verse in chapter['verses']:
                index = verse['number']
                key = f'{number}:{index}'
                require(type(index) is int and index > 0 and key not in verses, f'Invalid Ukrainian verse: {name} {key}')
                verses[key] = compiler.visible(verse['text'])
        targets[name] = verses
    require(targets.keys() == names, 'Missing Ukrainian New Testament book')
    return targets


def dump(value):
    return (json.dumps(value, ensure_ascii=False, separators=(',', ':')) + '\n').encode()


def build(*, output, reviews, registry):
    target_path = TRANSLATIONS / 'UKRK.json'
    greek_path = DATA / 'greek-nt-n1904.json'
    concordance_path = DATA / 'greek-concordance.json'
    errata = ROOT / 'scripts/original-languages/greek-nt-metadata-errata.json'
    pinned(greek_path, '6fd5543a1abdfebf10037a8ed9dfd6b933a34d7ff0ee48e834b86346f4005a55', 'Displayed N1904')
    pinned(concordance_path, '0b5d3d2edfd505b7a97c11749b0a15783af132860b8c5bd94ba6670b7c131da6', 'N1904 concordance')
    source, concordance = read(greek_path), read(concordance_path)
    source_info = source['sources'][0]
    require(source_info['sha256'] == concordance['sourceSha256'], 'N1904 source pin mismatch')
    pinned(errata, concordance['metadataErrataSha256'], 'N1904 metadata errata')
    greek = compiler.corpus(source)
    target = target_verses(read(target_path), greek.keys())
    status = read(registry)
    approved = approved_resources(reviews, registry, greek.keys(), target_id=TARGET_ID)

    provenance = {
        'url': 'https://ebible.org/find/details.php?id=ukr1871',
        'license': 'Public domain',
        'licenseUrl': 'https://ebible.org/ukr1871/copyright.htm',
        'attribution': 'Ukrainian Kulish/Pulyui, eBible.org ukr1871. Word correspondences independently reviewed by Heritage Study Bible coding assistants.',
        'sourceEdition': 'eBible.org ukr1871, catalogued as the 1905 edition, in the installed Ukrainian numbering and spelling.',
        'targetSha256': sha(target_path),
        'greekSha256': source_info['sha256'],
        'greekCorpusSha256': sha(greek_path),
        'greekConcordanceSha256': sha(concordance_path),
        'greekMetadataErrataSha256': sha(errata),
        'greekSource': source_info,
        'reviewRegistrySha256': sha(registry),
    }
    common = {'schemaVersion': 1, 'sourceId': 'N1904', 'targetId': TARGET_ID, 'provenance': provenance}
    books = {}
    for name, source_verses in greek.items():
        available = set(target[name]) | set(source_verses)
        unreviewed = {ref: 'not-independently-reviewed' for ref in
                      sorted(available, key=lambda ref: tuple(map(int, ref.split(':'))))}
        books[name] = {**common, 'book': name, 'verses': {}, 'unavailable': unreviewed, '_target': target[name]}
    counts = apply_reviews(books, approved, greek, concordance, status.get('crossReferenceShared', {}))
    manifest = {**common, 'books': {}, 'reviewedVerseCount': counts['reviewedVerses'],
                'reviewedResources': [{key: entry[key] for key in ('file', 'sha256', 'authorReceipt', 'independentPeer')}
                                      for _, entry, _ in approved]}
    artifacts = {}
    for name, book in books.items():
        del book['_target']
        filename = book_filename(name)
        data = dump(book)
        artifacts[filename] = data
        manifest['books'][name] = {'file': filename, 'sha256': hashlib.sha256(data).hexdigest(),
            'linkedVerses': sum(bool(verse['groups']) for verse in book['verses'].values()),
            'reviewedTargetVerses': len(target[name].keys() & book['verses'].keys()),
            'groups': sum(len(verse['groups']) for verse in book['verses'].values())}
    artifacts['index.json'] = dump(manifest)
    output.mkdir(parents=True, exist_ok=True)
    for filename, data in artifacts.items():
        with tempfile.NamedTemporaryFile(dir=output, prefix=filename + '.', suffix='.tmp', delete=False) as handle:
            handle.write(data)
            temporary = Path(handle.name)
        os.replace(temporary, output / filename)
    return counts


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--reviews', type=Path, default=ROOT / 'scripts/original-languages/reviewed-ukrk')
    parser.add_argument('--registry', type=Path, default=ROOT / 'scripts/original-languages/ukrk-review-status.json')
    args = parser.parse_args()
    print(json.dumps(build(output=args.output, reviews=args.reviews, registry=args.registry)))


if __name__ == '__main__':
    main()
