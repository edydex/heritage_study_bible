#!/usr/bin/env python3
"""Generate the named Greek NT source and conservative Greek–BSB links.

Inputs are publisher/source downloads, never AI-generated text. Source words
are paired only where an exact match is mandatory in every longest common
subsequence, allowing only the reviewed spelling pairs below. Publisher English
phrases must remain complete and contiguous before their row links transfer.
"""
import argparse
import csv
import hashlib
import json
import re
import unicodedata
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
NESTLE_COMMIT = '713f28a3b7d4d66132f5aa809fa223fe79762e5d'
NESTLE_SHA256 = '3beee6abb6302f691110fe0fc949fc195593b999cf2d0e463c9b573c1bb67150'
OSIS = ['Matt','Mark','Luke','John','Acts','Rom','1Cor','2Cor','Gal','Eph','Phil','Col','1Thess','2Thess','1Tim','2Tim','Titus','Phlm','Heb','Jas','1Pet','2Pet','1John','2John','3John','Jude','Rev']
NAMES = ['Matthew','Mark','Luke','John','Acts','Romans','1 Corinthians','2 Corinthians','Galatians','Ephesians','Philippians','Colossians','1 Thessalonians','2 Thessalonians','1 Timothy','2 Timothy','Titus','Philemon','Hebrews','James','1 Peter','2 Peter','1 John','2 John','3 John','Jude','Revelation']
EN_WORD = re.compile(r"[^\W_]+(?:['’][^\W_]+)*", re.UNICODE)
# The pinned N1904 morphology and publisher rows attest the same words (G1138
# and G4837) with these spellings. This is an explicit orthography allowlist,
# not approximate matching, lemma matching or permission to omit extra words.
GREEK_SPELLINGS = {'δαυειδ': 'δαυιδ', 'συνπαρακληθηναι': 'συμπαρακληθηναι'}

def checksum(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()

def greek_word(value):
    word = ''.join(c for c in unicodedata.normalize('NFD', value).lower() if unicodedata.category(c).startswith('L')).replace('ς', 'σ')
    return GREEK_SPELLINGS.get(word, word)

def english_words(value):
    return [(m.group().lower().replace('’', "'"), m.start(), m.end()) for m in EN_WORD.finditer(value)]

def visible_text(value):
    value = re.sub(r'^\s*¶\s*', '', value)
    value = re.sub(r'\s+¶\s+', '\n', value)
    value = re.sub(r'\s*\|\|\s*', '\n', value)
    return re.sub(r'</?b>', '', value)

def mandatory_exact_pairs(source, target):
    """Return only exact token pairs present in every maximum subsequence.

    A single LCS can arbitrarily pair repeated words or choose one side of a
    reordered passage. A token must be used in every optimal alignment AND have
    exactly one possible counterpart before it can carry a publisher link.
    """
    if source == target:
        return {index: index for index in range(len(source))}
    n, m = len(source), len(target)
    if not n or not m:
        return {}
    prefix = [[0] * (m + 1) for _ in range(n + 1)]
    for i in range(n):
        for j in range(m):
            prefix[i + 1][j + 1] = prefix[i][j] + 1 if source[i] == target[j] else max(prefix[i][j + 1], prefix[i + 1][j])
    suffix = [[0] * (m + 1) for _ in range(n + 1)]
    for i in range(n - 1, -1, -1):
        for j in range(m - 1, -1, -1):
            suffix[i][j] = suffix[i + 1][j + 1] + 1 if source[i] == target[j] else max(suffix[i + 1][j], suffix[i][j + 1])
    longest = prefix[n][m]
    pairs = {}
    for i in range(n):
        # If an optimal path can omit this source token, its identity is not
        # established even when its sole possible counterpart looks unique.
        if max(prefix[i][j] + suffix[i + 1][j] for j in range(m + 1)) == longest:
            continue
        candidates = [j for j in range(m) if source[i] == target[j]
                      and prefix[i][j] + 1 + suffix[i + 1][j + 1] == longest]
        if len(candidates) == 1:
            pairs[i] = candidates[0]
    return pairs

def generate(nestle_path, berean_path, bsb_path, output, all_nt_links=False):
    if checksum(nestle_path) != NESTLE_SHA256:
        raise ValueError('Greek source differs from the pinned edition. Review and update provenance before regeneration.')
    source = {
        'id': 'N1904', 'name': 'Nestle 1904 Greek New Testament', 'language': 'Greek', 'languageCode': 'grc', 'direction': 'ltr',
        'edition': 'Eberhard Nestle, 1904; Diego Santos transcription as supplied by Biblical Humanities',
        'url': 'https://github.com/biblicalhumanities/Nestle1904/tree/' + NESTLE_COMMIT + '/morph',
        'revision': NESTLE_COMMIT, 'sha256': checksum(nestle_path), 'license': 'Public domain / CC0',
        'licenseUrl': 'https://creativecommons.org/publicdomain/zero/1.0/',
        'attribution': 'Eberhard Nestle; transcription by Diego Renato dos Santos; morphology by Ulrik Sandborg-Petersen, building on Maurice A. Robinson. Biblical Humanities.',
    }
    words_by_ref = defaultdict(list)
    with nestle_path.open(encoding='utf-8-sig', newline='') as file:
        rows = csv.reader(file, delimiter='\t')
        assert next(rows)[:2] == ['BCV', 'text']
        for row in rows:
            if not row or not row[0]: continue
            match = re.fullmatch(r'(\S+) (\d+):(\d+)', row[0])
            if not match or match[1] not in OSIS or not row[1].strip(): raise ValueError('Invalid Greek source row')
            name = NAMES[OSIS.index(match[1])]
            words_by_ref[(name, int(match[2]), int(match[3]))].append(row[1])
    books, source_verses = [], {}
    for name in NAMES:
        chapters = defaultdict(list)
        for (book, chapter, verse), words in words_by_ref.items():
            if book != name: continue
            text = ' '.join(words)
            source_verses[f'{book} {chapter}:{verse}'] = text
            chapters[chapter].append({'number': verse, 'text': text})
        books.append({'name': name, 'sourceId': 'N1904', 'chapters': [{'number': c, 'verses': sorted(v, key=lambda x:x['number'])} for c,v in sorted(chapters.items())]})
    original = {'translation': 'ORIGINAL', 'name': 'Original languages', 'schemaVersion': 1, 'coverage': 'New Testament', 'sources': [source], 'books': books}
    bsb = json.loads(bsb_path.read_text())
    bsb_verses = {f"{b['name']} {c['number']}:{v['number']}": visible_text(v['text']) for b in bsb['books'] if b['name'] in (NAMES if all_nt_links else ['Romans']) for c in b['chapters'] for v in c['verses']}
    with berean_path.open(encoding='utf-8-sig', newline='') as file:
        rows = list(csv.reader(file, delimiter='\t'))
    assert rows[0][12] == 'VerseId' and rows[0][18].strip() == 'BSB version'
    refs = {r[3]: r[12] for r in rows[1:] if r[12]}
    table = defaultdict(list)
    for row in rows[1:]:
        ref = refs.get(row[3], '')
        if ref in bsb_verses: table[ref].append(row)
    aligned_books = defaultdict(dict)
    unavailable_books = defaultdict(dict)
    for key, words in words_by_ref.items():
        book, chapter, verse = key
        if not all_nt_links and book != 'Romans': continue
        aligned, unavailable = aligned_books[book], unavailable_books[book]
        ref = f'{book} {chapter}:{verse}'
        source_text, target_text = source_verses[ref], bsb_verses.get(ref, '')
        # Character offsets are consumed by JS. Current Greek/English corpora
        # contain BMP characters; refuse silent UTF-16 offset drift.
        assert all(ord(c) <= 0xffff for c in source_text + target_text)
        rows = table[ref]
        greek_rows = sorted((r for r in rows if r[5].strip()), key=lambda r:int(r[1]))
        english_rows = sorted((r for r in rows if r[18].strip() not in ['', '-', 'vvv', '. . .']), key=lambda r:int(r[2]))
        source_words = [greek_word(w) for w in words]
        publisher_words = [greek_word(r[5]) for r in greek_rows]
        source_pairs = mandatory_exact_pairs(source_words, publisher_words)
        tokenized = english_words(target_text)
        expected = [w[0] for r in english_rows for w in english_words(r[18])]
        target_pairs = mandatory_exact_pairs(expected, [w[0] for w in tokenized])
        source_ranges, cursor = {}, 0
        for index, word in enumerate(words):
            if index in source_pairs:
                row = greek_rows[source_pairs[index]]
                source_ranges[row[2]] = (index, cursor, cursor+len(word))
            cursor += len(word)+1
        groups, cursor = [], 0
        for row in english_rows:
            count = len(english_words(row[18]))
            if not count: continue
            positions = [target_pairs.get(index) for index in range(cursor, cursor + count)]
            cursor += count
            # Never reduce a changed multiword publisher phrase to a guessed
            # subphrase. Every token must retain one contiguous destination.
            if any(position is None for position in positions) or positions != list(range(positions[0], positions[0] + count)):
                continue
            link = source_ranges.get(row[2])
            if link is None: continue
            index, source_start, source_end = link
            start, end = tokenized[positions[0]][1], tokenized[positions[-1]][2]
            groups.append({'id': index, 'source': [source_start, source_end], 'target': [start, end]})
        if not groups:
            unavailable[f'{chapter}:{verse}'] = ('greek-edition-differs' if source_words != publisher_words
                else 'english-edition-differs' if [w[0] for w in tokenized] != expected else 'no-publisher-word-correspondence')
            continue
        entry = {'sourceText': source_text, 'targetText': target_text, 'groups': groups}
        if source_words != publisher_words or [w[0] for w in tokenized] != expected:
            entry['partial'] = {'method': 'Mandatory exact token pairs across edition differences; complete publisher English phrases only.',
                'sourceWords': len(words), 'matchedSourceWords': len(source_pairs),
                'publisherGreekWords': len(greek_rows), 'targetWords': len(tokenized),
                'matchedTargetWords': len(target_pairs), 'publisherEnglishWords': len(expected)}
        aligned[f'{chapter}:{verse}'] = entry
    aligned, unavailable = aligned_books['Romans'], unavailable_books['Romans']
    alignment = {
        'schemaVersion': 1, 'book': 'Romans', 'sourceId': 'N1904', 'targetId': 'BSB',
        'provenance': {'url': 'https://bereanbible.com/bsb_tables.tsv', 'license': 'CC0', 'licenseUrl': 'https://berean.bible/terms.htm', 'tableSha256': checksum(berean_path), 'targetSha256': checksum(bsb_path), 'greekSha256': source['sha256']},
        'method': 'Publisher row links transferred through exact token pairs mandatory in every longest common subsequence. Complete publisher English phrases must map contiguously; repeated or reordered ambiguity remains unlinked. Greek comparison ignores accents, case and punctuation and allows two reviewed spelling pairs: Δαυεὶδ/Δαυὶδ and συνπαρακληθῆναι/συμπαρακληθῆναι. English comparison ignores case and punctuation. Edition differences are recorded per verse. No inferred synonym or Strong-number matching.',
        'verses': aligned, 'unavailable': unavailable,
    }
    output.mkdir(parents=True, exist_ok=True)
    for name, value in [('greek-nt-n1904.json', original), ('romans-bsb-links.json', alignment)]:
        (output/name).write_text(json.dumps(value, ensure_ascii=False, separators=(',', ':'))+'\n')
    if all_nt_links:
        folder = output/'bsb-word-links'
        folder.mkdir(parents=True, exist_ok=True)
        manifest = {}
        for name in NAMES:
            item = {**alignment, 'book': name, 'verses': aligned_books[name], 'unavailable': unavailable_books[name]}
            filename = name.lower().replace(' ', '-') + '.json'
            path = folder/filename
            path.write_text(json.dumps(item, ensure_ascii=False, separators=(',', ':'))+'\n')
            manifest[name] = {'file': filename, 'sha256': checksum(path), 'linkedVerses': len(item['verses']), 'unlinkedVerses': len(item['unavailable']), 'groups': sum(len(v['groups']) for v in item['verses'].values())}
        (folder/'index.json').write_text(json.dumps({'schemaVersion': 1, 'sourceId': 'N1904', 'targetId': 'BSB', 'provenance': alignment['provenance'], 'books': manifest}, ensure_ascii=False, indent=2)+'\n')
    print(json.dumps({'books': len(books), 'chapters': sum(len(b['chapters']) for b in books), 'verses': len(source_verses), 'linkedRomansVerses': len(aligned), 'unlinkedRomansVerses': len(unavailable), 'groups': sum(len(v['groups']) for v in aligned.values())}))

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--nestle', type=Path, required=True)
    parser.add_argument('--berean', type=Path, required=True)
    parser.add_argument('--all-nt-links', action='store_true', help='Also generate per-book BSB mappings for New Testament occurrence results.')
    parser.add_argument('--bsb', type=Path, default=ROOT/'public/data/translations/BSB.json')
    parser.add_argument('--output', type=Path, default=ROOT/'public/data/original-languages')
    args = parser.parse_args()
    generate(args.nestle, args.berean, args.bsb, args.output, args.all_nt_links)
