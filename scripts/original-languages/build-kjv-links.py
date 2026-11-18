#!/usr/bin/env python3
"""Build conservative KJV links from publisher English/TR positional markup.

Only exact inflected Greek forms, compatible Strong identities, and mandatory
monotone sequence correspondences cross the TR/N1904 witness boundary. English
offsets belong to the installed KJV, never to a substituted source edition.
"""
import argparse
import collections
import hashlib
import itertools
import json
import os
import re
import subprocess
import sys
import tempfile
import unicodedata
from pathlib import Path
from xml.parsers import expat

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / 'public/data/original-languages'
REVISION = 'd490be7e34762deb2c76cb2c1306d4808e27890d'
SOURCE_SHA = '4bcbfe45722fca396adbeac9c81025bbb173cb1e30296da90864f0400cb0e3f5'
OSIS_BOOKS = dict(zip(
    'Matt Mark Luke John Acts Rom 1Cor 2Cor Gal Eph Phil Col 1Thess 2Thess 1Tim 2Tim Titus Phlm Heb Jas 1Pet 2Pet 1John 2John 3John Jude Rev'.split(),
    ['Matthew', 'Mark', 'Luke', 'John', 'Acts', 'Romans', '1 Corinthians', '2 Corinthians', 'Galatians', 'Ephesians', 'Philippians', 'Colossians', '1 Thessalonians', '2 Thessalonians', '1 Timothy', '2 Timothy', 'Titus', 'Philemon', 'Hebrews', 'James', '1 Peter', '2 Peter', '1 John', '2 John', '3 John', 'Jude', 'Revelation']))


def sha(value):
    return hashlib.sha256(value).hexdigest()


def read(path):
    return json.loads(path.read_text())


def visible(text):
    text = re.sub(r'^\s*¶\s*', '', text)
    text = re.sub(r'\s+¶\s+', '\n', text)
    return re.sub(r'</?b>', '', text)


def english_words(text):
    return [(m.group().casefold().replace('’', "'"), m.start(), m.end())
            for m in re.finditer(r"[^\W_]+(?:['’][^\W_]+)*", text)]


def greek_form(text):
    # Strip combining marks before casefold: otherwise an iota subscript is
    # expanded into a separate iota (ἀρχῇ -> αρχηι), unlike the publisher's
    # unaccented spelling (αρχη). Strong identity still guards homographs.
    plain = ''.join(c for c in unicodedata.normalize('NFD', text) if c.isalpha())
    return plain.casefold()


def corpus_verses(data):
    return {book['name']: {f"{chapter['number']}:{verse['number']}": visible(verse['text'])
            for chapter in book['chapters'] for verse in chapter['verses']} for book in data['books']}


def parse_osis(path):
    """SAX handles verse/quotation milestones which are not XML containers."""
    parser = expat.ParserCreate(namespace_separator='|')
    records, current = {}, None
    parts, marks, stack = [], [], []
    length = ignored = 0

    def start(name, attrs):
        nonlocal current, parts, marks, stack, length, ignored
        name = name.split('|')[-1]
        if name == 'verse':
            identifier = attrs.get('sID', '')
            if identifier.split('.')[0] in OSIS_BOOKS:
                current = identifier
                parts, marks, stack, length, ignored = [], [], [], 0, 0
            elif current and attrs.get('eID') == current:
                records[current] = {'text': ''.join(parts), 'marks': marks}
                current = None
        if current:
            if name == 'note':
                ignored += 1
            if name == 'w' and not ignored:
                stack.append((length, attrs))

    def end(name):
        nonlocal ignored
        name = name.split('|')[-1]
        if current:
            if name == 'w' and not ignored:
                offset, attrs = stack.pop()
                marks.append({'start': offset, 'end': length, **attrs})
            if name == 'note':
                ignored -= 1

    def text(value):
        nonlocal length
        if current and not ignored:
            parts.append(value)
            length += len(value)

    parser.StartElementHandler, parser.EndElementHandler, parser.CharacterDataHandler = start, end, text
    with path.open('rb') as source:
        parser.ParseFile(source)
    return records


def mandatory_pairs(left, right, equal):
    """Pairs traversed by every optimal LCS path, including repeated tokens.

    Counting optimal paths avoids SequenceMatcher's arbitrary tie-breaking. A
    shared word with two equally valid source positions remains unlinked.
    """
    n, m = len(left), len(right)
    same = [[equal(a, b) for b in right] for a in left]
    prefix = [[0] * (m + 1) for _ in range(n + 1)]
    before = [[1] * (m + 1) for _ in range(n + 1)]
    for i in range(1, n + 1):
        for j in range(1, m + 1):
            score = max(prefix[i - 1][j], prefix[i][j - 1],
                        prefix[i - 1][j - 1] + 1 if same[i - 1][j - 1] else -1)
            prefix[i][j] = score
            before[i][j] = (before[i - 1][j] if prefix[i - 1][j] == score else 0) \
                + (before[i][j - 1] if prefix[i][j - 1] == score else 0) \
                + (before[i - 1][j - 1] if same[i - 1][j - 1] and prefix[i - 1][j - 1] + 1 == score else 0)
    suffix = [[0] * (m + 1) for _ in range(n + 1)]
    after = [[1] * (m + 1) for _ in range(n + 1)]
    for i in range(n - 1, -1, -1):
        for j in range(m - 1, -1, -1):
            score = max(suffix[i + 1][j], suffix[i][j + 1], suffix[i + 1][j + 1] + 1 if same[i][j] else -1)
            suffix[i][j] = score
            after[i][j] = (after[i + 1][j] if suffix[i + 1][j] == score else 0) \
                + (after[i][j + 1] if suffix[i][j + 1] == score else 0) \
                + (after[i + 1][j + 1] if same[i][j] and suffix[i + 1][j + 1] + 1 == score else 0)
    return {i: j for i in range(n) for j in range(m) if same[i][j]
            and prefix[i][j] + 1 + suffix[i + 1][j + 1] == prefix[n][m]
            and before[i][j] * after[i + 1][j + 1] == before[n][m]}


def strong_ids(value):
    return frozenset(str(int(n)) for n in value)


def align_verse(record, source_text, target_text, source_words, lemmas, reasons):
    osis_words, target_words = english_words(record['text']), english_words(target_text)
    if not target_words:
        return [], 'installed-verse-empty'
    identical_english = [w[0] for w in osis_words] == [w[0] for w in target_words]
    english_matches = dict(enumerate(range(len(osis_words)))) if identical_english else mandatory_pairs(
        osis_words, target_words, lambda a, b: a[0] == b[0])
    tr, uncertain = {}, set()
    for mark in record['marks']:
        identifiers = mark.get('src', '').split()
        forms = re.findall(r'lemma\.TR:(\S+)', mark.get('lemma', ''))
        strongs = re.findall(r'strong:G(\d+)', mark.get('lemma', ''))
        if not identifiers or not all(re.fullmatch(r'\d+', item) for item in identifiers):
            mark['omit'] = 'cross-verse-or-missing-position'
            reasons['cross-verse-or-missing-position'] += 1
            continue
        if len(identifiers) != len(forms):
            return [], 'inconsistent-publisher-position-arrays'
        mark['positions'] = [int(item) for item in identifiers]
        if len(identifiers) == 1 and strongs:
            # One Greek compound/numeral can have several component Strong IDs.
            identities = [strong_ids(strongs)]
        elif len(identifiers) == len(strongs):
            identities = [strong_ids([strong]) for strong in strongs]
        else:
            # Retain the known witness forms/positions but never emit this
            # malformed English group or invent a per-word Strong assignment.
            mark['omit'] = 'inconsistent-publisher-strong-array'
            reasons[mark['omit']] += 1
            identities = [frozenset() for _ in forms]
            uncertain.update(mark['positions'])
        for position, form, identity in zip(mark['positions'], forms, identities):
            item = (greek_form(form), identity)
            if position in tr and tr[position] != item:
                return [], 'conflicting-publisher-source-position'
            tr[position] = item
    if not tr or set(tr) != set(range(1, max(tr) + 1)):
        return [], 'incomplete-publisher-source-sequence'
    tr_tokens = [tr[i] for i in range(1, max(tr) + 1)]
    source_tokens = [(greek_form(source_text[start:end]), strong_ids(lemmas[lemma]['strongs']))
                     for start, end, lemma in source_words]
    equal = lambda a, b: a[0] == b[0] and bool(a[1] & b[1])
    if uncertain:
        # Missing Strong annotations cannot force a neighboring repeated word
        # into the wrong occurrence. Require agreement across every compatible
        # identity assignment, including an unmatched witness variant.
        if len(uncertain) > 4:
            return [], 'too-many-unresolved-publisher-identities'
        positions = sorted(uncertain)
        options = []
        for position in positions:
            form = tr_tokens[position - 1][0]
            options.append([frozenset(), *sorted({identity for candidate, identity in source_tokens if candidate == form}, key=lambda value: sorted(value))])
        common = None
        for assignment in itertools.product(*options):
            variant = list(tr_tokens)
            for position, identity in zip(positions, assignment):
                variant[position - 1] = (variant[position - 1][0], identity)
            pairs = set(mandatory_pairs(variant, source_tokens, equal).items())
            common = pairs if common is None else common & pairs
        matches = dict(common or [])
    else:
        matches = mandatory_pairs(tr_tokens, source_tokens, equal)
    groups_by_source = {}
    for identifier, mark in enumerate(record['marks']):
        if mark.get('omit') or mark['start'] == mark['end']:
            continue
        positions = mark['positions']
        if any(pos - 1 not in matches for pos in positions):
            reasons['greek-variant-or-ambiguous-position'] += 1
            continue
        matched = sorted(matches[pos - 1] for pos in positions)
        blocks = []
        for index in matched:
            if blocks and index == blocks[-1][-1] + 1:
                blocks[-1].append(index)
            else:
                blocks.append([index])
        source_ranges = [[source_words[block[0]][0], source_words[block[-1]][1]] for block in blocks]
        english_indexes = [i for i, (_, start, end) in enumerate(osis_words)
                           if mark['start'] <= start and end <= mark['end']]
        if not english_indexes:
            continue
        if any(i not in english_matches for i in english_indexes):
            reasons['english-variant-or-ambiguous-position'] += 1
            continue
        target_indexes = [english_matches[i] for i in english_indexes]
        if target_indexes != list(range(target_indexes[0], target_indexes[-1] + 1)):
            reasons['noncontiguous-english-phrase'] += 1
            continue
        target = [target_words[target_indexes[0]][1], target_words[target_indexes[-1]][2]]
        source = source_ranges[0]
        assert source_text[slice(*source)].strip() and target_text[slice(*target)].strip()
        assert all(ord(c) <= 0xffff for c in source_text + target_text), 'UTF-16 review required'
        key = tuple(map(tuple, source_ranges))
        if key not in groups_by_source:
            groups_by_source[key] = {'id': identifier, 'source': source, 'sourceRanges': source_ranges, 'target': target, 'targetRanges': [target]}
        elif target not in groups_by_source[key]['targetRanges']:
            groups_by_source[key]['targetRanges'].append(target)
    groups = list(groups_by_source.values())
    for group in groups:
        group['targetRanges'].sort()
        group['target'] = group['targetRanges'][0]
    return groups, 'no-unambiguous-shared-source-phrase'


def build(osis_path, output):
    source_bytes = osis_path.read_bytes()
    if sha(source_bytes) != SOURCE_SHA:
        raise ValueError('KJV OSIS source hash changed; review a source upgrade explicitly')
    records = parse_osis(osis_path)
    kjv_path = ROOT / 'public/data/translations/KJV.json'
    target = corpus_verses(read(kjv_path))
    greek = corpus_verses(read(DATA / 'greek-nt-n1904.json'))
    concordance = read(DATA / 'greek-concordance.json')
    source_words = {book['name']: book['verses'] for book in concordance['books']}
    provenance = {
        'url': f'https://gitlab.com/crosswire-bible-society/kjv/-/blob/{REVISION}/kjv.osis.xml',
        'revision': REVISION, 'sourceSha256': SOURCE_SHA, 'sourceEdition': 'CrossWire KJV 3.1, Robinson TR positional markup',
        'license': 'GPL; CrossWire also grants use of this text for any purpose',
        'licenseUrl': f'https://gitlab.com/crosswire-bible-society/kjv/-/blob/{REVISION}/kjv.conf',
        'attribution': 'KJV2003 Project / CrossWire Bible Society; Greek TR data by Maurice A. Robinson.',
        'targetSha256': sha(kjv_path.read_bytes()), 'greekSha256': concordance['sourceSha256'],
        'greekConcordanceSha256': sha((DATA / 'greek-concordance.json').read_bytes()),
        'greekMetadataErrataSha256': concordance.get('metadataErrataSha256'),
    }
    output.mkdir(parents=True, exist_ok=True)
    manifest, audit = {}, {}
    for code, name in OSIS_BOOKS.items():
        aligned, unavailable, reasons = {}, {}, collections.Counter()
        for ref, source_text in greek[name].items():
            chapter, verse = ref.split(':')
            record = records.get(f'{code}.{chapter}.{verse}')
            target_text = target[name].get(ref, '')
            if not target_text:
                unavailable[ref] = 'target-verse-absent'
                continue
            if record is None:
                unavailable[ref] = 'publisher-verse-unavailable'
                continue
            groups, reason = align_verse(record, source_text, target_text, source_words[name][ref], concordance['lemmas'], reasons)
            if groups:
                aligned[ref] = {'sourceText': source_text, 'targetText': target_text, 'groups': groups}
            else:
                unavailable[ref] = reason
        value = {'schemaVersion': 1, 'book': name, 'sourceId': 'N1904', 'targetId': 'KJV', 'provenance': provenance,
                 'method': 'Publisher OSIS English phrases and TR source positions; exact inflected Greek forms plus compatible Strong identity matched only where every optimal monotone TR/N1904 alignment agrees. Exact English words require the same mandatory sequence agreement with installed KJV, preserving unchanged phrases across printing differences. Single-position compounds retain their multiple component Strong identities. An inconsistent Strong array is omitted without forcing neighboring matches. Discontinuous publisher pieces use sourceRanges/targetRanges; source/target retain their first segments for schema-1 compatibility. Textual variants, ambiguous repeats and cross-verse positions remain unpaired.',
                 'verses': aligned, 'unavailable': unavailable}
        path = output / (name.lower().replace(' ', '-') + '.json')
        path.write_text(json.dumps(value, ensure_ascii=False, separators=(',', ':')) + '\n')
        manifest[name] = {'file': path.name, 'sha256': sha(path.read_bytes()), 'linkedVerses': len(aligned),
                          'unlinkedVerses': len(unavailable), 'groups': sum(len(v['groups']) for v in aligned.values())}
        coverage = collections.Counter()
        for ref, source_text in greek[name].items():
            target_tokens = english_words(target[name].get(ref, ''))
            greek_tokens = source_words[name][ref]
            current_groups = aligned.get(ref, {}).get('groups', [])
            target_ranges = [r for group in current_groups for r in group['targetRanges']]
            coverage['targetWords'] += len(target_tokens)
            coverage['linkedTargetWords'] += sum(any(a <= start and end <= b for a, b in target_ranges) for _, start, end in target_tokens)
            coverage['sourceWords'] += len(greek_tokens)
            coverage['linkedSourceWords'] += sum(any(a <= start and end <= b for group in current_groups for a, b in group['sourceRanges']) for start, end, _ in greek_tokens)
            coverage['splitGroups'] += sum(len(group['targetRanges']) > 1 for group in current_groups)
            coverage['splitSourceGroups'] += sum(len(group['sourceRanges']) > 1 for group in current_groups)
        audit[name] = {**manifest[name], **coverage, 'unavailableReasons': dict(collections.Counter(unavailable.values())), 'omittedGroups': dict(reasons)}
    (output / 'index.json').write_text(json.dumps({'schemaVersion': 1, 'sourceId': 'N1904', 'targetId': 'KJV',
        'provenance': provenance, 'books': manifest}, ensure_ascii=False, separators=(',', ':')) + '\n')
    return {'linkedVerses': sum(m['linkedVerses'] for m in manifest.values()),
            'groups': sum(m['groups'] for m in manifest.values()), 'books': audit}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--osis', type=Path, required=True)
    parser.add_argument('--output', type=Path, default=DATA / 'kjv-word-links')
    parser.add_argument('--audit', type=Path)
    args = parser.parse_args()
    with tempfile.TemporaryDirectory(prefix='heritage-kjv-links-') as staging:
        staged=Path(staging)
        audit=build(args.osis,staged)
        subprocess.run([sys.executable,str(ROOT/'scripts/original-languages/compile-reviewed-links.py'),
                        '--reviews',str(ROOT/'scripts/original-languages/reviewed-kjv'),
                        '--registry',str(ROOT/'scripts/original-languages/kjv-review-status.json'),
                        '--input',str(staged),'--output',str(staged),'--target','KJV'],check=True)
        final=read(staged/'index.json')
        audit['reviewedVerseCount']=final['reviewedVerseCount']
        audit['finalGroups']=sum(item['groups'] for item in final['books'].values())
        args.output.mkdir(parents=True,exist_ok=True)
        for path in sorted(staged.glob('*.json'),key=lambda p:p.name=='index.json'):
            with tempfile.NamedTemporaryFile(dir=args.output,prefix=path.name+'.',suffix='.tmp',delete=False) as target:
                target.write(path.read_bytes());temporary=Path(target.name)
            os.replace(temporary,args.output/path.name)
    if args.audit:
        args.audit.write_text(json.dumps(audit, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps(audit, ensure_ascii=False, indent=2))
