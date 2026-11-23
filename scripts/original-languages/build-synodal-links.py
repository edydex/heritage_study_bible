#!/usr/bin/env python3
"""Build SYNO-W NT links from independently approved occurrence reviews only.

The target must first match the reviewed native-source-piece resolver exactly.
Unreviewed verses receive no groups, word explanations, or semantic certification.
An explicit output directory is required; this module never materializes a Bible.
"""
import argparse
import hashlib
import importlib.util
import json
import os
import subprocess
import tempfile
from functools import partial
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / 'public/data/original-languages'
TARGET_ID = 'SYNO-W'
RAW_GREEK_SHA = '3beee6abb6302f691110fe0fc949fc195593b999cf2d0e463c9b573c1bb67150'
GREEK_SHA = '6fd5543a1abdfebf10037a8ed9dfd6b933a34d7ff0ee48e834b86346f4005a55'
CONCORDANCE_SHA = '0b5d3d2edfd505b7a97c11749b0a15783af132860b8c5bd94ba6670b7c131da6'
ERRATA_SHA = '600a05ba4922f7a1750307f4a3bb680189afe8c210cfd8a61901595a4d7187b6'
POLICY_SHA = '94e7d71728f03f65579072291d42e4262534335ee7e6dad06241ece8397df794'
RESOLVER_SHA = '6725f582ff9d2597bcd2be268c8050357422a2c0e9f5d95cd6fc64f44f7a2122'


spec = importlib.util.spec_from_file_location('reviewed_link_resources', Path(__file__).with_name('reviewed_link_resources.py'))
shared = importlib.util.module_from_spec(spec)
spec.loader.exec_module(shared)
compiler, read, sha, require, pinned = shared.compiler, shared.read, shared.sha, shared.require, shared.pinned
apply_reviews = shared.apply_reviews
load_module = shared.load_module
approved_resources = partial(shared.approved_resources, target_id=TARGET_ID)


def nt_texts(data, names):
    """Collect literal target text, rejecting duplicate references before dict conversion."""
    require(data.get('translation') == TARGET_ID, 'Wrong target corpus identity')
    books, result = set(), {}
    for book in data['books']:
        name = book['name']
        if name not in names:
            continue
        require(name not in books, f'Duplicate target NT book: {name}')
        books.add(name)
        chapters = set()
        for chapter in book['chapters']:
            number = chapter['number']
            require(type(number) is int and number > 0 and number not in chapters,
                    f'Invalid/duplicate target chapter: {name}')
            chapters.add(number)
            for verse in chapter['verses']:
                v = verse['number']
                ref = f'{name}|{number}|{v}'
                require(type(v) is int and v > 0 and ref not in result,
                        f'Invalid/duplicate target reference: {ref}')
                require(isinstance(verse['text'], str) and verse['text'].strip(),
                        f'Missing target text: {ref}')
                result[ref] = verse['text']
    require(books == set(names), 'Missing target NT book')
    return result


def validate_target_corpus(target_corpus, *,
                           native=ROOT / 'public/data/translations/SYNO-W-native.json',
                           template=ROOT / 'public/data/translations/LSV.json',
                           policy=ROOT / 'scripts/bible-sources/SYNO-W-nt-versification.json'):
    resolver = ROOT / 'scripts/lib/synodalNtVersification.cjs'
    pinned(resolver, RESOLVER_SHA, 'Reviewed NT resolver')
    pinned(policy, POLICY_SHA, 'Reviewed NT piece policy')
    # The resolver binds the actual native NT text/ref digest and canonical NT
    # ref-set, excluding OT. No proportional/same-number word mapping is used.
    script = """
const fs=require('node:fs');
const [modulePath,native,template,policy]=process.argv.slice(1);
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const {NT_BOOKS,resolveSynodalNtVersification}=require(modulePath);
const plan=resolveSynodalNtVersification({nativeData:read(native),canonicalTemplateData:read(template),policy:read(policy)});
process.stdout.write(JSON.stringify({books:NT_BOOKS,targetTexts:plan.targetTexts,report:plan.report}));
"""
    execution = subprocess.run(['node', '-e', script, str(resolver), str(native),
                                str(template), str(policy)], check=True,
                               capture_output=True, text=True)
    plan = json.loads(execution.stdout)
    actual = nt_texts(read(target_corpus), plan['books'])
    missing = set(plan['targetTexts']) - set(actual)
    extra = set(actual) - set(plan['targetTexts'])
    different = [ref for ref, text in actual.items()
                 if ref in plan['targetTexts'] and text != plan['targetTexts'][ref]]
    require(not (missing or extra or different),
            'Russian NT body differs from reviewed source-piece plan: '
            f'missing={sorted(missing)[:3]}, extra={sorted(extra)[:3]}, different={different[:3]}')
    return plan


def build(*, output, reviews, registry, target_corpus,
          greek_corpus=DATA / 'greek-nt-n1904.json',
          concordance_path=DATA / 'greek-concordance.json'):
    """Validate every input and compile in memory before writing any output."""
    plan = validate_target_corpus(target_corpus)
    pinned(greek_corpus, GREEK_SHA, 'N1904 displayed Greek')
    pinned(concordance_path, CONCORDANCE_SHA, 'N1904 concordance')
    errata = ROOT / 'scripts/original-languages/greek-nt-metadata-errata.json'
    pinned(errata, ERRATA_SHA, 'N1904 metadata errata')
    greek_data, concordance = read(greek_corpus), read(concordance_path)
    require(greek_data['sources'][0]['sha256'] == concordance['sourceSha256'] == RAW_GREEK_SHA
            and concordance['metadataErrataSha256'] == ERRATA_SHA, 'Greek provenance mismatch')
    approved = approved_resources(reviews, registry, plan['books'])
    greek = compiler.corpus(greek_data)
    target = {name: {} for name in plan['books']}
    for absolute, text in plan['targetTexts'].items():
        name, chapter, verse = absolute.split('|')
        target[name][f'{chapter}:{verse}'] = text
    provenance = {
        'url': 'https://ebible.org/find/details.php?id=russyn',
        'license': 'Public domain', 'licenseUrl': 'https://ebible.org/russyn/copyright.htm',
        'attribution': 'Russian Synodal Translation; eBible.org russyn source. '
                       'Occurrence correspondence reviews by Heritage Study Bible coding assistants.',
        'sourceEdition': 'Retained native eBible russyn; reviewed NT source-piece versification policy.',
        'publisherSourceArchiveSha256': '9af20fe73fff9370acc8fd03cc0ffa718e1cf107d83fc401d41dcadc6c4e4a88',
        'targetSha256': sha(target_corpus), 'greekSha256': RAW_GREEK_SHA,
        'greekCorpusSha256': GREEK_SHA, 'greekConcordanceSha256': CONCORDANCE_SHA,
        'greekMetadataErrataSha256': ERRATA_SHA, 'greekSource': greek_data['sources'][0],
        'ntVersificationPolicySha256': POLICY_SHA, 'ntResolverSha256': RESOLVER_SHA,
        'ntSourceDigests': plan['report']['sourceDigests'], 'reviewRegistrySha256': sha(registry),
    }
    books = {}
    for name in plan['books']:
        unavailable = {}
        for ref in sorted(set(greek[name]) | set(target[name]), key=lambda ref: tuple(map(int, ref.split(':')))):
            unavailable[ref] = ('not-independently-reviewed' if ref in greek[name] and ref in target[name]
                                else 'source-reference-absent-unreviewed' if ref in target[name]
                                else 'target-reference-absent-unreviewed')
        books[name] = {'schemaVersion': 1, 'book': name, 'sourceId': 'N1904', 'targetId': TARGET_ID,
                       'provenance': provenance,
                       'method': 'Only hash-approved full occurrence reviews create links. '
                                 'Unreviewed references have no inferred links or unpaired-word explanations. '
                                 'NT reference/source-piece validation is separate from word correspondence.',
                       'verses': {}, 'unavailable': unavailable, '_target': target[name]}
    counts = apply_reviews(books, approved, greek, concordance, read(registry).get('crossReferenceShared', {}))
    reviewed_target_count = sum(ref in target[name] for name, book in books.items() for ref in book['verses'])
    manifest = {'schemaVersion': 1, 'sourceId': 'N1904', 'targetId': TARGET_ID,
                'provenance': provenance, 'books': {}, 'reviewedVerseCount': counts['reviewedVerses'],
                'reviewedResources': [{k: item[k] for k in ('file', 'sha256', 'authorReceipt', 'independentPeer')}
                                      for _, item, _ in approved]}
    artifacts = {}
    for name, book in books.items():
        del book['_target']
        filename = name.lower().replace(' ', '-') + '.json'
        contents = (json.dumps(book, ensure_ascii=False, separators=(',', ':')) + '\n').encode()
        artifacts[filename] = contents
        manifest['books'][name] = {'file': filename, 'sha256': hashlib.sha256(contents).hexdigest(),
                                    'linkedVerses': len(book['verses']), 'unlinkedVerses': len(book['unavailable']),
                                    'groups': sum(len(v['groups']) for v in book['verses'].values())}
    report = {'schemaVersion': 1, 'targetId': TARGET_ID, 'reviewed': counts,
              'targetVerseRecords': len(plan['targetTexts']),
              'unreviewedTargetVerseRecords': len(plan['targetTexts']) - reviewed_target_count,
              'greekOnlyUnreviewedReferences': [f'{name}|{ref.replace(":", "|")}' for name in plan['books']
                                               for ref in greek[name] if ref not in target[name] and ref in books[name]['unavailable']],
              'versification': plan['report'], 'books': manifest['books']}
    manifest['coverage'] = {key: report[key] for key in ('targetVerseRecords', 'unreviewedTargetVerseRecords', 'greekOnlyUnreviewedReferences')}
    artifacts['index.json'] = (json.dumps(manifest, ensure_ascii=False, separators=(',', ':')) + '\n').encode()
    output = Path(output)
    output.mkdir(parents=True, exist_ok=True)
    # Index is promoted last, after all validated book artifacts exist.
    for filename, contents in artifacts.items():
        with tempfile.NamedTemporaryFile(dir=output, prefix=filename + '.', suffix='.tmp', delete=False) as handle:
            handle.write(contents)
            temporary = Path(handle.name)
        os.replace(temporary, output / filename)
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--reviews', type=Path, required=True)
    parser.add_argument('--registry', type=Path, required=True)
    parser.add_argument('--target-corpus', type=Path, default=ROOT / 'public/data/translations/SYNO-W.json')
    args = parser.parse_args()
    print(json.dumps(build(output=args.output, reviews=args.reviews, registry=args.registry,
                           target_corpus=args.target_corpus), ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
