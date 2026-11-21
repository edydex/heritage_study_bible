#!/usr/bin/env python3
"""Draft, check and register chapter review resources for a translation.

draft:    start a chapter review from the committed published links (for BSB,
          the publisher's own row correspondences). Verses already in an
          existing reviewed chapter file are kept unchanged. Every Greek token
          and translated word without an owner is listed under "_todo", so the
          reviewer sees exactly what still needs a decision. The draft is
          written outside the canonical review folder unless --output says
          otherwise.
check:    compile every verse of a review file with the real compiler and
          list every problem (the compiler itself stops at the first one).
          Leftover "_todo" fields are reported as problems.
register: record an accepted review file in the translation's registry with
          its sha256 and the committed author/peer note files, then rebuild
          the canonical published files for that translation.

    python3 scripts/original-languages/draft-review-from-links.py draft --target BSB --book Matthew --chapter 18 --output /tmp/matthew-18.json
    python3 scripts/original-languages/draft-review-from-links.py check --target BSB /tmp/matthew-18.json
    python3 scripts/original-languages/draft-review-from-links.py register --target BSB matthew-18.json \
        --author-note docs/word-links/claude-review-notes/bsb/matthew-18.md \
        --peer-note docs/word-links/claude-review-notes/bsb/matthew-18.peer.md
"""
import argparse
import hashlib
import importlib.util
import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SCRIPTS = ROOT / 'scripts/original-languages'
DATA = ROOT / 'public/data/original-languages'
WORD = re.compile(r"[^\W_]+(?:['’][^\W_]+)*")

spec = importlib.util.spec_from_file_location('review_compiler', SCRIPTS / 'compile-reviewed-links.py')
compiler = importlib.util.module_from_spec(spec)
spec.loader.exec_module(compiler)


def read(path):
    return json.loads(Path(path).read_text(encoding='utf-8'))


def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def slug(text):
    return text.lower().replace(' ', '-')


def corpora(target):
    greek = compiler.corpus(read(DATA / 'greek-nt-n1904.json'))
    translated = compiler.corpus(read(ROOT / f'public/data/translations/{target}.json'))
    concordance = read(DATA / 'greek-concordance.json')
    return greek, translated, concordance


def occurrence_of(text, start, end):
    """Selector for text[start:end] in the compiler's whole-word phrase terms."""
    phrase = text[start:end]
    matches = list(re.finditer(r'(?<!\w)' + re.escape(phrase) + r'(?!\w)', text))
    for n, match in enumerate(matches):
        if match.start() == start:
            return {'text': phrase, 'occurrence': n}
    return None


def publisher_evidence(entry):
    """What the publisher's own Greek says about textual differences in this verse."""
    if not entry:
        return 'No publisher row for this verse: say nothing about the publisher Greek.'
    partial = entry.get('partial')
    if not partial:
        return ('Publisher Greek = N1904 word for word here. Do not claim a different reading; '
                'unlinked words are translation choices.')
    n1904, matched, publisher = partial['sourceWords'], partial['matchedSourceWords'], partial['publisherGreekWords']
    return (f'Publisher Greek differs: {n1904 - matched} N1904 word(s) unmatched, '
            f'{publisher - matched} publisher word(s) not in N1904. Only these can be a different reading.')


def draft_verse(entry, source_text, target_text):
    tokens = list(re.finditer(r'\S+', source_text))
    groups, notes = [], []
    if entry and entry.get('sourceText') == source_text and entry.get('targetText') == target_text:
        by_token = {}
        for group in entry.get('groups', []):
            if group.get('sourceAnchors') and any(a.get('chapter') is not None for a in group['sourceAnchors']):
                # Shifted references need a human decision; leave them as todo.
                notes.append('Published group links another verse; re-create it explicitly if correct.')
                continue
            source_ranges = group.get('sourceRanges', [group['source']])
            target_ranges = group.get('targetRanges', [group['target']])
            indexes = sorted({i for i, t in enumerate(tokens) for a, b in source_ranges if t.start() < b and a < t.end()})
            phrases = []
            for a, b in target_ranges:
                selector = occurrence_of(target_text, a, b)
                if selector is None:
                    notes.append(f'Published target range is not a whole-word phrase: {target_text[a:b]!r}')
                    phrases = []
                    break
                phrases.append(selector)
            if not indexes or not phrases:
                continue
            # The compiler forbids a token in two groups: merge such groups.
            existing = next((g for g in groups if set(g['sourceTokens']) & set(indexes)), None)
            if existing:
                existing['sourceTokens'] = sorted(set(existing['sourceTokens']) | set(indexes))
                existing['targetPhrases'] += [p for p in phrases if p not in existing['targetPhrases']]
                notes.append(f'Merged publisher rows sharing Greek token(s) {indexes}.')
            else:
                groups.append({'sourceTokens': indexes, 'targetPhrases': phrases})
            for i in indexes:
                by_token[i] = True
    used_source = {i for g in groups for i in g['sourceTokens']}
    spans = []
    for g in groups:
        for p in g['targetPhrases']:
            spans.append(compiler.phrase_range(target_text, p))
    # Order target phrases inside a group by position, then groups by first token.
    for g in groups:
        g['targetPhrases'].sort(key=lambda p: compiler.phrase_range(target_text, p)[0])
    groups.sort(key=lambda g: min(g['sourceTokens']))
    todo_source = [[i, tokens[i].group()] for i in range(len(tokens)) if i not in used_source]
    todo_target = [m.group() for m in WORD.finditer(target_text)
                   if not any(a < m.end() and b > m.start() for a, b in spans)]
    verse = {'sourceText': source_text, 'targetText': target_text, 'groups': groups,
             'unmappedSource': [], 'unmappedTarget': []}
    todo = {}
    if todo_source:
        todo['sourceTokens'] = todo_source
    if todo_target:
        todo['targetWords'] = todo_target
    if notes:
        todo['notes'] = notes
    if not entry:
        todo['notes'] = todo.get('notes', []) + ['No published links for this verse: review from scratch.']
    if todo:
        verse['_todo'] = todo
    verse['_evidence'] = publisher_evidence(entry)
    verse['_tokens'] = [f'{i}:{t.group()}' for i, t in enumerate(tokens)]
    return verse


def cmd_draft(args):
    greek, translated, _ = corpora(args.target)
    book, chapter = args.book, args.chapter
    published = read(DATA / f'{args.target.lower()}-word-links' / f'{slug(book)}.json')
    existing_path = SCRIPTS / f'reviewed-{args.target.lower()}' / f'{slug(book)}-{chapter}.json'
    existing = read(existing_path)['verses'] if existing_path.exists() else {}
    refs = sorted({r for r in translated[book] if int(r.split(':')[0]) == chapter}
                  | {r for r in greek[book] if int(r.split(':')[0]) == chapter},
                  key=lambda r: int(r.split(':')[1]))
    verses, counts = {}, {'kept': 0, 'drafted': 0, 'todoSource': 0, 'todoTarget': 0, 'absent': []}
    for ref in refs:
        if ref in existing:
            verses[ref] = existing[ref]
            counts['kept'] += 1
            continue
        if not greek[book].get(ref, '').strip() and not translated[book].get(ref, '').strip():
            # Neither witness prints this verse (for example a TR-only verse
            # that the edition leaves blank): there is nothing to link.
            counts.setdefault('skippedEmpty', []).append(ref)
            continue
        if not greek[book].get(ref) or not translated[book].get(ref):
            counts['absent'].append(ref)
            verses[ref] = {'_todo': {'notes': [
                f'Reference {ref} is missing from the ' + ('Greek' if not greek[book].get(ref) else args.target)
                + ' text. Use `x targetAbsent` (or `x sourceAbsent`) and explain every word of the other side,'
                + ' or link moved words.']},
                'sourceText': greek[book].get(ref, ''), 'targetText': translated[book].get(ref, '')}
            continue
        verse = draft_verse(published['verses'].get(ref), greek[book][ref], translated[book][ref])
        verses[ref] = verse
        counts['drafted'] += 1
        counts['todoSource'] += len(verse.get('_todo', {}).get('sourceTokens', []))
        counts['todoTarget'] += len(verse.get('_todo', {}).get('targetWords', []))
    resource = {'schemaVersion': 1, 'targetId': args.target, 'sourceId': 'N1904', 'book': book, 'chapter': chapter,
                'review': {'source': 'Actual written N1904 and the publisher rows, reviewed against the displayed '
                                     + args.target + ' by Claude (Anthropic); independent peer review recorded in the registry.'},
                'verses': verses}
    output = Path(args.output)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(resource, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    print(json.dumps({'output': str(output), **counts}, ensure_ascii=False))


def cmd_check(args):
    greek, translated, concordance = corpora(args.target)
    source_words = {b['name']: b['verses'] for b in concordance['books']}
    problems, ok = [], 0
    for file in args.files:
        resource = read(file)
        book = resource['book']
        for key in resource:
            if key.startswith('_'):
                problems.append(f'{file}: leftover top-level field {key}')
        for ref, entry in resource['verses'].items():
            leftovers = [k for k in entry if k.startswith('_')]
            if leftovers:
                problems.append(f'{book} {ref}: leftover working field(s) {leftovers}')
            chapter, verse = map(int, ref.split(':'))
            source_ref = entry.get('sourceReference', {'chapter': chapter, 'verse': verse})
            raw = f"{source_ref['chapter']}:{source_ref['verse']}"
            try:
                assert raw in greek[book] or entry.get('sourceAbsent'), 'Missing source reference needs an explicit absence review'
                assert ref in translated[book] or entry.get('targetAbsent'), 'Missing target reference needs an explicit absence review'
                clean = {k: v for k, v in entry.items() if not k.startswith('_')}
                compiled = compiler.compile_verse(clean, greek[book].get(raw, ''), translated[book].get(ref, ''), False,
                                                  greek[book], source_ref)
                compiler.validate_article_auxiliaries(clean, source_words[book], concordance['lemmas'], source_ref)
                for group in clean['groups']:
                    for phrase in group['targetPhrases']:
                        assert 'occurrence' in phrase, f'Target phrase without explicit occurrence: {phrase}'
                ok += 1
            except (AssertionError, ValueError, KeyError) as error:
                problems.append(f'{book} {ref}: {error}')
    for problem in problems:
        print(problem)
    print(json.dumps({'versesOk': ok, 'problems': len(problems)}))
    return 1 if problems else 0


TEXT_HELP = """# Review text format (one verse per "@ chapter:verse" block). Informational lines:
#   GR:  Greek verse; TOK: numbered Greek tokens; EN: translation, with each repeated
#   word numbered (you#0, you#1); TODO: what the draft could not resolve;
#   EVIDENCE: whether the publisher's own Greek differs from N1904 in this verse.
# Decision lines (every Greek token and every EN word must be covered exactly once):
#   g 3 4 = phrase + other phrase // optional note     link Greek tokens 3,4 to phrase(s)
#   h 3 = phrase // note                               study head for the group above (optional)
#   s 0 7 = reason                                     Greek tokens left untranslated, with reason
#   t phrase = reason                                  EN words with no Greek counterpart, with reason
#   m 5 6 > 19:41 = reason                             Greek tokens rendered in another EN verse
#   g @18:2 5 = phrase // note                         link tokens of another Greek verse (rare)
#   x sourceAbsent | x targetAbsent | x sourceReference 18:2
# A phrase is exact whole-word text. Put #n after its first word when that word repeats:
#   "you#1 will" = the phrase that starts at the second "you". Case matters.
"""


TEXT_FIELDS = {'sourceText', 'targetText', 'groups', 'unmappedSource', 'unmappedTarget', 'sourceMoved',
               'sourceAbsent', 'targetAbsent', 'sourceReference'}


def tokens_of(text):
    return list(re.finditer(r'\S+', text))


def occurrences(text, word):
    """Start offsets of word as the compiler matches it (whole-word, case-sensitive)."""
    return [m.start() for m in re.finditer(r'(?<!\w)' + re.escape(word) + r'(?!\w)', text)]


def numbered_english(text):
    out, last = [], 0
    for m in WORD.finditer(text):
        starts = occurrences(text, m.group())
        out.append(text[last:m.end()])
        if len(starts) > 1:
            out.append(f'#{starts.index(m.start())}')
        last = m.end()
    out.append(text[last:])
    return ''.join(out)


def phrase_selector_text(text, phrase):
    """Inverse of resolve_phrase: show a phrase with #n on its first word when needed."""
    a, _ = compiler.phrase_range(text, phrase)
    first = WORD.search(phrase['text'])
    starts = occurrences(text, first.group())
    if len(starts) == 1:
        return phrase['text']
    n = starts.index(a + first.start())
    return phrase['text'][:first.end()] + f'#{n}' + phrase['text'][first.end():]


def resolve_phrase(text, written):
    """'you#1 will' -> {'text': 'you will', 'occurrence': k} for the compiler."""
    match = re.match(r'^(.*?)#(\d+)(.*)$', written)
    phrase = written if not match else match.group(1) + match.group(3)
    phrase = phrase.strip()
    if not phrase:
        raise ValueError('empty phrase')
    first = WORD.search(phrase)
    if not first:
        raise ValueError(f'phrase has no word: {written!r}')
    if match and [w.group() for w in WORD.finditer(match.group(1))] != [first.group()]:
        raise ValueError(f'#n must follow the first word of the phrase: {written!r}')
    starts = occurrences(text, first.group())
    if match:
        n = int(match.group(2))
        if n >= len(starts):
            raise ValueError(f'{first.group()!r} occurs only {len(starts)} time(s): {written!r}')
        start = starts[n] - first.start()
    else:
        candidates = [m.start() for m in re.finditer(r'(?<!\w)' + re.escape(phrase) + r'(?!\w)', text)]
        if len(candidates) != 1:
            raise ValueError(f'{phrase!r} occurs {len(candidates)} times; add #n after its first word')
        start = candidates[0]
    matches = [m.start() for m in re.finditer(r'(?<!\w)' + re.escape(phrase) + r'(?!\w)', text)]
    if start not in matches:
        raise ValueError(f'{written!r} is not whole-word text at that position')
    return {'text': phrase, 'occurrence': matches.index(start)}


def cmd_totext(args):
    resource = read(args.draft)
    lines = [f"# {resource['book']} {resource.get('chapter', '')} {resource.get('targetId', '')} review", TEXT_HELP]
    for ref, verse in resource['verses'].items():
        if not args.all and '_todo' not in verse and '_tokens' not in verse:
            lines.append(f'@ {ref} KEEP  (already reviewed; copied unchanged)\n')
            continue
        source, target = verse.get('sourceText', ''), verse.get('targetText', '')
        lines.append(f'@ {ref}')
        lines.append(f'GR: {source}')
        lines.append('TOK: ' + ' '.join(f'{i}:{t.group()}' for i, t in enumerate(tokens_of(source))))
        lines.append(f'EN: {numbered_english(target)}')
        if verse.get('_evidence'):
            lines.append(f"EVIDENCE: {verse['_evidence']}")
        todo = verse.get('_todo', {})
        bits = []
        if todo.get('sourceTokens'):
            bits.append('greek ' + ' '.join(f'{i}:{t}' for i, t in todo['sourceTokens']))
        if todo.get('targetWords'):
            bits.append('english ' + ', '.join(todo['targetWords']))
        bits += todo.get('notes', [])
        if bits:
            lines.append('TODO: ' + ' | '.join(bits))
        for flag in ('sourceAbsent', 'targetAbsent'):
            if verse.get(flag):
                lines.append(f'x {flag}')
        if verse.get('sourceReference'):
            r = verse['sourceReference']
            lines.append(f"x sourceReference {r['chapter']}:{r['verse']}")
        for group in verse.get('groups', []):
            ref_part = ''
            if group.get('sourceReference'):
                r = group['sourceReference']
                ref_part = f"@{r['chapter']}:{r['verse']} "
            phrases = ' + '.join(phrase_selector_text(target, p) for p in group['targetPhrases'])
            note = f" // {group['note']}" if group.get('note') else ''
            lines.append(f"g {ref_part}{' '.join(map(str, group['sourceTokens']))} = {phrases}{note}")
            for head in group.get('studyHeads', []):
                hp = ' + '.join(phrase_selector_text(target, p) for p in head['targetPhrases'])
                lines.append(f"h {' '.join(map(str, head['sourceTokens']))} = {hp} // {head['note']}")
        for note in verse.get('unmappedSource', []):
            lines.append(f"s {' '.join(map(str, note['tokens']))} = {note['reason']}")
        for note in verse.get('unmappedTarget', []):
            lines.append(f"t {phrase_selector_text(target, note)} = {note['reason']}")
        for note in verse.get('sourceMoved', []):
            r = note['targetReference']
            lines.append(f"m {' '.join(map(str, note['tokens']))} > {r['chapter']}:{r['verse']} = {note['reason']}")
        lines.append('')
    Path(args.output).write_text('\n'.join(lines), encoding='utf-8')
    print(args.output)


def parse_ref(text):
    chapter, verse = text.split(':')
    return {'chapter': int(chapter), 'verse': int(verse)}


def cmd_fromtext(args):
    base = read(args.base)
    resource = {k: v for k, v in base.items() if k != 'verses'}
    verses, errors = {}, []
    current, ref = None, None
    for number, raw in enumerate(Path(args.text).read_text(encoding='utf-8').splitlines(), 1):
        line = raw.strip()
        if not line or line.startswith('#') or re.match(r'^(GR|TOK|EN|TODO|EVIDENCE):', line):
            continue
        try:
            if line.startswith('@'):
                parts = line[1:].split()
                ref = parts[0]
                if ref not in base['verses']:
                    raise ValueError(f'unknown verse {ref}')
                if len(parts) > 1 and parts[1] == 'KEEP':
                    verses[ref] = base['verses'][ref]
                    current = None
                else:
                    original = base['verses'][ref]
                    current = {'sourceText': original.get('sourceText', ''), 'targetText': original.get('targetText', ''),
                               'groups': [], 'unmappedSource': [], 'unmappedTarget': []}
                    for key, value in original.items():
                        if key not in TEXT_FIELDS and not key.startswith('_'):
                            current[key] = value
                    verses[ref] = current
                continue
            if current is None:
                raise ValueError('decision line outside an editable verse')
            kind, rest = line[0], line[1:].strip()
            target = current['targetText']
            if kind == 'x':
                if rest in ('sourceAbsent', 'targetAbsent'):
                    current[rest] = True
                elif rest.startswith('sourceReference'):
                    current['sourceReference'] = parse_ref(rest.split()[1])
                else:
                    raise ValueError(f'unknown flag {rest!r}')
                continue
            left, _, right = rest.partition('=')
            if not _:
                raise ValueError('missing "="')
            right, _, note = right.partition('//')
            right, note = right.strip(), note.strip()
            if kind == 'g':
                fields = left.split()
                group = {}
                if fields and fields[0].startswith('@'):
                    group['sourceReference'] = parse_ref(fields.pop(0)[1:])
                group['sourceTokens'] = [int(f) for f in fields]
                group['targetPhrases'] = [resolve_phrase(target, p.strip()) for p in right.split(' + ')]
                if note:
                    group['note'] = note
                current['groups'].append({'sourceTokens': group['sourceTokens'], 'targetPhrases': group['targetPhrases'],
                                          **({'sourceReference': group['sourceReference']} if 'sourceReference' in group else {}),
                                          **({'note': note} if note else {})})
            elif kind == 'h':
                if not current['groups']:
                    raise ValueError('study head without a group above it')
                if not note:
                    raise ValueError('study head needs a // note')
                current['groups'][-1].setdefault('studyHeads', []).append(
                    {'sourceTokens': [int(f) for f in left.split()],
                     'targetPhrases': [resolve_phrase(target, p.strip()) for p in right.split(' + ')], 'note': note})
            elif kind == 's':
                if not right:
                    raise ValueError('unmapped Greek needs a reason')
                current['unmappedSource'].append({'tokens': [int(f) for f in left.split()], 'reason': right})
            elif kind == 't':
                if not right:
                    raise ValueError('unmapped English needs a reason')
                current['unmappedTarget'].append({**resolve_phrase(target, left.strip()), 'reason': right})
            elif kind == 'm':
                tokens_part, _, to = left.partition('>')
                if not _ or not right:
                    raise ValueError('moved line needs "> chapter:verse = reason"')
                current.setdefault('sourceMoved', []).append(
                    {'tokens': [int(f) for f in tokens_part.split()], 'targetReference': parse_ref(to.strip()), 'reason': right})
            else:
                raise ValueError(f'unknown line kind {kind!r}')
        except (ValueError, IndexError) as error:
            errors.append(f'line {number} ({ref}): {error}: {raw.strip()[:120]}')
    for ref in base['verses']:
        if ref not in verses:
            errors.append(f'verse {ref} is missing from the text file')
    if errors:
        print('\n'.join(errors))
        print(json.dumps({'parseErrors': len(errors)}))
        return 1
    ordered = {ref: verses[ref] for ref in base['verses']}
    resource['verses'] = ordered
    Path(args.output).write_text(json.dumps(resource, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    target_id = base.get('targetId') or args.target
    if not target_id:
        raise SystemExit('The base file has no targetId: pass --target')
    return cmd_check(argparse.Namespace(target=target_id, files=[args.output]))


def cmd_register(args):
    target = args.target
    reviews = SCRIPTS / f'reviewed-{target.lower()}'
    registry_path = SCRIPTS / f'{target.lower()}-review-status.json'
    path = reviews / args.file
    if args.source:
        # Finished reviews may be prepared outside the canonical folder so that
        # in-progress edits never break the rebuild of accepted files.
        source = Path(args.source)
        if source.resolve() != path.resolve():
            path.write_bytes(source.read_bytes())
    if cmd_check(argparse.Namespace(target=target, files=[path])):
        raise SystemExit('Fix the problems above before registering.')
    registry = read(registry_path)
    entry = {'file': args.file, 'sha256': sha(path), 'status': 'accepted'}
    for field, note in (('authorReceipt', args.author_note), ('independentPeer', args.peer_note)):
        note_path = ROOT / note
        if not note_path.exists():
            raise SystemExit(f'Missing {field} note: {note}')
        entry[field] = {'file': note, 'sha256': sha(note_path)}
    resources = registry['resources']
    for n, item in enumerate(resources):
        if item['file'] == args.file:
            resources[n] = entry
            break
    else:
        resources.append(entry)
    registry_path.write_text(json.dumps(registry, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    if args.no_build:
        return 0
    published = DATA / f'{target.lower()}-word-links'
    if target == 'SYNO-W':
        # SYNO-W has its own builder (full rebuild from accepted resources).
        subprocess.run([sys.executable, str(SCRIPTS / 'build-synodal-links.py'), '--output', str(published),
                        '--reviews', str(reviews), '--registry', str(registry_path)], check=True)
        return 0
    subprocess.run([sys.executable, str(SCRIPTS / 'compile-reviewed-links.py'), '--target', target,
                    '--reviews', str(reviews), '--registry', str(registry_path),
                    '--input', str(published), '--output', str(published)], check=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = parser.add_subparsers(dest='command', required=True)
    d = sub.add_parser('draft')
    d.add_argument('--target', required=True)
    d.add_argument('--book', required=True)
    d.add_argument('--chapter', type=int, required=True)
    d.add_argument('--output', required=True)
    c = sub.add_parser('check')
    c.add_argument('--target', required=True)
    c.add_argument('files', nargs='+')
    r = sub.add_parser('register')
    r.add_argument('--target', required=True)
    r.add_argument('file', help='File name inside reviewed-<target>/')
    r.add_argument('--author-note', required=True)
    r.add_argument('--peer-note', required=True)
    r.add_argument('--no-build', action='store_true', help='Only update the registry (register several files, then build once)')
    r.add_argument('--from', dest='source', help='Copy this finished review file into reviewed-<target>/ first')
    t = sub.add_parser('totext', help='Write a draft or review file as editable review text')
    t.add_argument('draft')
    t.add_argument('--output', required=True)
    t.add_argument('--all', action='store_true', help='Make every verse editable (for a peer review of a finished file)')
    f = sub.add_parser('fromtext', help='Turn edited review text back into a review file, then check it')
    f.add_argument('text')
    f.add_argument('--base', required=True, help='The draft JSON the text was made from')
    f.add_argument('--output', required=True)
    f.add_argument('--target', help='Translation id when the base file does not name one')
    args = parser.parse_args()
    return {'draft': cmd_draft, 'check': cmd_check, 'register': cmd_register,
            'totext': cmd_totext, 'fromtext': cmd_fromtext}[args.command](args) or 0


if __name__ == '__main__':
    sys.exit(main())
