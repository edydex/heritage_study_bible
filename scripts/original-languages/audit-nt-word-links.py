#!/usr/bin/env python3
"""Report mapped, explicitly explained and unresolved NT words by translation/book.

These are accounting figures, not a semantic certification. A partially linked
verse must never be counted as a fully mapped or independently reviewed verse.
"""
import argparse
import collections
import hashlib
import json
import re
import unicodedata
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT / 'public/data/original-languages'


def read(path):
    return json.loads(path.read_text())


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def visible(text):
    text = re.sub(r'^\s*¶\s*', '', text)
    text = re.sub(r'\s+¶\s+', '\n', text)
    return re.sub(r'</?b>', '', re.sub(r'\s*\|\|\s*', '\n', text))


def corpus(value):
    return {book['name']: {f"{chapter['number']}:{verse['number']}": visible(verse['text'])
            for chapter in book['chapters'] for verse in chapter['verses']} for book in value['books']}


def word_spans(text, greek=False):
    if not greek:
        return [(match.start(), match.end(), match[0]) for match in re.finditer(r"[^\W_]+(?:['’][^\W_]+)*", text)]
    result = []
    for match in re.finditer(r'\S+', text):
        start, end = match.start(), match.end()
        while start < end and not unicodedata.category(text[start]).startswith(('L', 'M', 'N')):
            start += 1
        while end > start and not unicodedata.category(text[end - 1]).startswith(('L', 'M', 'N')):
            end -= 1
        assert start < end, f'Non-word source token: {match[0]}'
        result.append((start, end, text[start:end]))
    return result


def audit_book(source, target, entries):
    texts = {'source': source, 'target': target}
    words = {side: {ref: word_spans(text, side == 'source') for ref, text in verses.items()} for side, verses in texts.items()}
    ownership = {(side, status): collections.defaultdict(set) for side in texts for status in ('mapped', 'explained')}

    def cover(side, ref, start, end, status):
        assert ref in texts[side], f'Missing {side} reference {ref}'
        assert isinstance(start, int) and isinstance(end, int) and 0 <= start < end <= len(texts[side][ref]), f'Invalid {side} range {ref}: {start}:{end}'
        ownership[side, status][ref].update(i for i, (a, b, _) in enumerate(words[side][ref]) if start <= a and end >= b)

    complete_reviews, source_only_reviews = [], []
    for ref, entry in entries.items():
        raw_reference = entry.get('sourceReference')
        raw_ref = f"{raw_reference['chapter']}:{raw_reference['verse']}" if raw_reference else ref
        assert entry['sourceText'] == source.get(raw_ref, '')
        assert entry['targetText'] == target.get(ref, '')
        for group in entry['groups']:
            anchors = group.get('sourceAnchors') or [dict(zip(('startOffset', 'endOffset'), span)) for span in group.get('sourceRanges', [group['source']])]
            for anchor in anchors:
                anchor_ref = f"{anchor['chapter']}:{anchor['verse']}" if 'chapter' in anchor else raw_ref
                if 'text' in anchor:
                    assert source[anchor_ref][anchor['startOffset']:anchor['endOffset']] == anchor['text']
                cover('source', anchor_ref, anchor['startOffset'], anchor['endOffset'], 'mapped')
            for start, end in group.get('targetRanges', [group['target']]):
                cover('target', ref, start, end, 'mapped')
        review = entry.get('review', {})
        for note in review.get('sourceNotes', []):
            assert note['reason'].strip()
            note_ref = f"{note['chapter']}:{note['verse']}" if 'chapter' in note else raw_ref
            cover('source', note_ref, note['startOffset'], note['endOffset'], 'explained')
        for note in review.get('targetNotes', []):
            assert note['reason'].strip()
            cover('target', ref, note['startOffset'], note['endOffset'], 'explained')
        if review.get('completeAccounting'):
            (complete_reviews if ref in target else source_only_reviews).append(ref)
    counts = {'targetVerseRecords': len(target), 'sourceVerseRecords': len(source),
              'linkedVerseRecords': sum(bool(entry['groups']) for entry in entries.values()),
              'reviewedTargetVerseRecords': len(complete_reviews),
              'reviewedSourceOnlyRecords': len(source_only_reviews),
              'groups': sum(len(entry['groups']) for entry in entries.values())}
    gaps = {}
    for side in texts:
        totals = collections.Counter()
        for ref, spans in words[side].items():
            mapped = ownership[side, 'mapped'][ref]
            explained = ownership[side, 'explained'][ref] - mapped
            unresolved = set(range(len(spans))) - mapped - explained
            totals.update(words=len(spans), mappedWords=len(mapped), explainedUnpairedWords=len(explained), unresolvedWords=len(unresolved))
            if unresolved:
                gaps.setdefault(ref, {})[side] = [{'index': i, 'start': spans[i][0], 'end': spans[i][1], 'text': spans[i][2]} for i in sorted(unresolved)]
        counts[side] = dict(totals)
        counts[side]['mappedPercent'] = round(100 * totals['mappedWords'] / totals['words'], 4) if totals['words'] else 0
    counts['completeReviewedBook'] = set(complete_reviews) >= set(target)
    return counts, gaps


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    greek_corpus = read(DATA / 'greek-nt-n1904.json')
    source = corpus(greek_corpus)
    report = {'schemaVersion': 1, 'scope': 'New Testament only',
              'standard': 'Mapped words have actual range anchors. Explained words have an explicit unpaired reason. All remaining words are unresolved, regardless of likely cause. Mechanical accounting is not semantic certification.',
              'rawSourceSha256': greek_corpus['sources'][0]['sha256'],
              'greekCorpusSha256': sha(DATA / 'greek-nt-n1904.json'), 'translations': {}}
    for target_id in ('BSB', 'LSV', 'KJV'):
        folder = DATA / f'{target_id.lower()}-word-links'
        index = read(folder / 'index.json')
        target = corpus(read(ROOT / f'public/data/translations/{target_id}.json'))
        books, gaps, totals = {}, {}, collections.Counter()
        for book, meta in index['books'].items():
            assert sha(folder / meta['file']) == meta['sha256'], 'Manifest does not match mapping artifact'
            books[book], gaps[book] = audit_book(source[book], target[book], read(folder / meta['file'])['verses'])
            for key in ('source', 'target'):
                for name, count in books[book][key].items():
                    if name != 'mappedPercent':totals[f'{key}_{name}'] += count
            totals['reviewedTargetVerseRecords'] += books[book]['reviewedTargetVerseRecords']
            totals['reviewedSourceOnlyRecords'] += books[book]['reviewedSourceOnlyRecords']
            totals['completeReviewedBooks'] += books[book]['completeReviewedBook']
        report['translations'][target_id] = {'manifestSha256': sha(folder / 'index.json'), 'totals': dict(totals), 'books': books, 'unresolved': gaps}
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    lines = ['# New Testament mapping progress', '', report['standard'], '',
             'The reviewed column counts accepted verse resources with complete word accounting and a separate assistant semantic review. Reader verification remains pending.', '']
    for target_id, translation in report['translations'].items():
        totals = translation['totals']
        lines += [f'## {target_id}', '', f"Accepted reviewed verses: **{totals['reviewedTargetVerseRecords']}**. Completely reviewed books: **{totals['completeReviewedBooks']} / 27**.", '',
                  '| Book | Greek mapped | English mapped | Unresolved Greek words | Unresolved English words | Reviewed verses |',
                  '|---|---:|---:|---:|---:|---:|']
        for book, counts in translation['books'].items():
            lines.append(f"| {book} | {counts['source']['mappedPercent']:.2f}% | {counts['target']['mappedPercent']:.2f}% | {counts['source']['unresolvedWords']} | {counts['target']['unresolvedWords']} | {counts['reviewedTargetVerseRecords']} / {counts['targetVerseRecords']} |")
        lines += ['', f"Mapping manifest SHA-256: `{translation['manifestSha256']}`.", '']
    args.output.with_suffix('.md').write_text('\n'.join(lines) + '\n')
    print(json.dumps({key: item['totals'] for key, item in report['translations'].items()}))


if __name__ == '__main__':
    main()
