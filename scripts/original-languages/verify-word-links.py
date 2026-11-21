#!/usr/bin/env python3
"""One check for every NT word-link translation, shared by both content agents.

Runs, in order:
  1. the word-link unit tests (scripts/original-languages/test_*.py);
  2. a rebuild of BSB, LSV, KJV, SYNO-W and UKRK into a temporary folder from
     the accepted review resources, byte-compared with the committed files;
  3. registry <-> resource <-> published-verse consistency for each translation;
  4. a done/left table per translation and book (always printed);
  5. with --owner and --since, a list of changed files the agent does not own
     (see docs/word-links/AGREEMENT.md).

Exit status is non-zero when any check fails. It never writes into the
repository; rebuilds go to a temporary directory that is removed afterwards.

    python3 scripts/original-languages/verify-word-links.py
    python3 scripts/original-languages/verify-word-links.py --owner claude --since origin/main
    python3 scripts/original-languages/verify-word-links.py --table-only
"""
import argparse
import collections
import hashlib
import json
import subprocess
import sys
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SCRIPTS = ROOT / 'scripts/original-languages'
DATA = ROOT / 'public/data/original-languages'
TRANSLATIONS = ['BSB', 'LSV', 'KJV', 'SYNO-W', 'UKRK']

# Longest matching prefix wins. Keep in step with docs/word-links/AGREEMENT.md.
OWNERS = {
    # Claude
    'scripts/original-languages/reviewed-bsb/': 'claude',
    'scripts/original-languages/bsb-review-status.json': 'claude',
    'public/data/original-languages/bsb-word-links/': 'claude',
    'public/data/original-languages/romans-bsb-links.json': 'claude',
    'docs/KJV-WORD-LINKS.md': 'claude',
    'scripts/original-languages/reviewed-lsv/': 'claude',
    'scripts/original-languages/lsv-review-status.json': 'claude',
    'scripts/original-languages/build-lsv-links.py': 'claude',
    'public/data/original-languages/lsv-word-links/': 'claude',
    'scripts/original-languages/reviewed-syno-w/': 'claude',
    'scripts/original-languages/syno-w-review-status.json': 'claude',
    'scripts/original-languages/build-synodal-links.py': 'claude',
    'public/data/original-languages/syno-w-word-links/': 'claude',
    'src/data/synodalTextAdditions.js': 'claude',
    'docs/SYNO-W-WORD-LINKS.md': 'claude',
    'docs/word-links/AGREEMENT.md': 'claude',
    'docs/word-links/status-claude.md': 'claude',
    'docs/word-links/claude-review-notes/': 'claude',
    'scripts/original-languages/verify-word-links.py': 'claude',
    'scripts/original-languages/draft-review-from-links.py': 'claude',
    # Codex
    'scripts/original-languages/reviewed-ukrk/': 'codex',
    'scripts/original-languages/ukrk-review-status.json': 'codex',
    'scripts/original-languages/build-ukrk-links.py': 'codex',
    'public/data/original-languages/ukrk-word-links/': 'codex',
    'src/data/ukrkTextAdditions.json': 'codex',
    'public/data/verse-layout/UKRK.json': 'codex',
    'src/': 'codex',
    'e2e/': 'codex',
    'tests/': 'codex',
    'android/': 'codex',
    'package.json': 'codex',
    'package-lock.json': 'codex',
    'docs/ORIGINAL-LANGUAGES.md': 'codex',
    'docs/word-links/status-codex.md': 'codex',
    # Shared engine: change only after a request in your status file and the owner's OK.
    'scripts/original-languages/compile-reviewed-links.py': 'shared',
    'scripts/original-languages/reviewed_link_resources.py': 'shared',
    'scripts/original-languages/shared_phrase_links.py': 'shared',
    'scripts/original-languages/audit-nt-word-links.py': 'shared',
    'public/data/original-languages/greek-nt-n1904.json': 'shared',
    'public/data/original-languages/greek-concordance.json': 'shared',
    'scripts/original-languages/greek-nt-metadata-errata.json': 'shared',
    # Parked until the owner assigns it.
    'scripts/original-languages/reviewed-kjv/': 'parked',
    'scripts/original-languages/kjv-review-status.json': 'parked',
    'scripts/original-languages/build-kjv-links.py': 'parked',
    'public/data/original-languages/kjv-word-links/': 'parked',
    # Another session's area.
    'community-server/': 'other',
}


def owner_of(path):
    best = ''
    for prefix in OWNERS:
        if (path == prefix or (prefix.endswith('/') and path.startswith(prefix))) and len(prefix) > len(best):
            best = prefix
    return OWNERS[best] if best else 'unassigned'


def read(path):
    return json.loads(Path(path).read_text(encoding='utf-8'))


def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def slug(t):
    return t.lower()


def registry_path(t):
    return SCRIPTS / f'{slug(t)}-review-status.json'


def reviews_dir(t):
    return SCRIPTS / f'reviewed-{slug(t)}'


def published_dir(t):
    return DATA / f'{slug(t)}-word-links'


def run(cmd):
    result = subprocess.run(cmd, cwd=ROOT, capture_output=True, text=True)
    return result.returncode, (result.stdout + result.stderr).strip()


def rebuild_command(t, output):
    py = sys.executable
    if t == 'UKRK':
        return [py, str(SCRIPTS / 'build-ukrk-links.py'), '--output', str(output)]
    if t == 'SYNO-W':
        return [py, str(SCRIPTS / 'build-synodal-links.py'), '--output', str(output),
                '--reviews', str(reviews_dir(t)), '--registry', str(registry_path(t))]
    # BSB, LSV and KJV: their full builders need external publisher inputs, so
    # re-apply every accepted review on top of the committed files instead.
    return [py, str(SCRIPTS / 'compile-reviewed-links.py'), '--target', t,
            '--reviews', str(reviews_dir(t)), '--registry', str(registry_path(t)),
            '--input', str(published_dir(t)), '--output', str(output)]


def check_unit_tests(failures):
    code, out = run([sys.executable, '-m', 'unittest', 'discover', '-s', str(SCRIPTS), '-p', 'test_*.py'])
    last = out.splitlines()[-3:] if out else []
    print('unit tests:', 'pass' if code == 0 else 'FAIL', '|', ' '.join(line.strip() for line in last if line.strip()))
    if code:
        failures.append('unit tests failed:\n' + out[-4000:])


def check_rebuilds(failures, only):
    with tempfile.TemporaryDirectory(prefix='heritage-verify-word-links-') as tmp:
        for t in only:
            output = Path(tmp) / slug(t)
            code, out = run(rebuild_command(t, output))
            if code:
                print(f'rebuild {t}: FAIL')
                failures.append(f'{t} rebuild failed:\n{out[-3000:]}')
                continue
            committed = {p.name: p.read_bytes() for p in published_dir(t).glob('*.json')}
            rebuilt = {p.name: p.read_bytes() for p in output.glob('*.json')}
            differ = sorted(n for n in committed.keys() | rebuilt.keys() if committed.get(n) != rebuilt.get(n))
            print(f'rebuild {t}:', 'identical' if not differ else f'DIFFERS in {len(differ)} file(s)')
            if differ:
                failures.append(f'{t}: committed files do not match a rebuild from accepted reviews: {", ".join(differ[:10])}'
                                + ' (run the builder for this translation and commit its output)')


def check_consistency(failures, warnings, only):
    for t in only:
        registry = read(registry_path(t))
        if registry.get('targetId') != t:
            failures.append(f'{t}: registry targetId is {registry.get("targetId")!r}')
        entries = registry.get('resources', [])
        files = [e.get('file') for e in entries]
        dupes = [f for f, n in collections.Counter(files).items() if n > 1]
        if dupes:
            failures.append(f'{t}: registry lists a file more than once: {dupes}')
        on_disk = {p.name for p in reviews_dir(t).glob('*.json')}
        missing = sorted(set(files) - on_disk)
        if missing:
            failures.append(f'{t}: registry names files that do not exist: {missing[:10]}')
        unregistered = sorted(on_disk - set(files))
        if unregistered:
            warnings.append(f'{t}: {len(unregistered)} review file(s) not in the registry (drafts are fine): {unregistered[:5]}')
        accepted = {e['file']: e for e in entries if e.get('status') == 'accepted' and e.get('file') in on_disk}
        for name, entry in accepted.items():
            if sha(reviews_dir(t) / name) != entry.get('sha256'):
                failures.append(f'{t}: {name} changed after it was accepted (registry hash differs)')
            # Review notes committed to the repo must still match their recorded hash.
            for field in ('authorReceipt', 'independentPeer'):
                proof = entry.get(field)
                if isinstance(proof, dict) and proof.get('file'):
                    note = ROOT / proof['file']
                    if not note.exists():
                        failures.append(f'{t}: {name} {field} note is missing: {proof["file"]}')
                    elif sha(note) != proof.get('sha256'):
                        failures.append(f'{t}: {name} {field} note changed after acceptance: {proof["file"]}')
        # Every accepted verse must be published as reviewed from that exact
        # resource, and every published reviewed verse must come from one.
        expected = {}
        for name in accepted:
            resource = read(reviews_dir(t) / name)
            for ref in resource.get('verses', {}):
                expected[(resource['book'], ref)] = (name, accepted[name]['sha256'])
        seen = {}
        for path in published_dir(t).glob('*.json'):
            if path.name == 'index.json':
                continue
            book = read(path)
            for ref, verse in book.get('verses', {}).items():
                review = verse.get('review') or {}
                if review.get('resource'):
                    seen[(book['book'], ref)] = (Path(review['resource']).name, review.get('sha256'))
        if expected != seen:
            gone = sorted(set(expected) - set(seen))[:5]
            extra = sorted(set(seen) - set(expected))[:5]
            stale = sorted(k for k in set(expected) & set(seen) if expected[k] != seen[k])[:5]
            failures.append(f'{t}: published reviewed verses do not match accepted resources '
                            f'(missing {gone}, unexpected {extra}, stale {stale})')


def coverage(only):
    rows = collections.OrderedDict()
    totals = {t: [0, 0] for t in only}
    for t in only:
        index = read(published_dir(t) / 'index.json')
        for name, meta in index['books'].items():
            book = read(published_dir(t) / meta['file'])
            verses, unavailable = book.get('verses', {}), book.get('unavailable', {})
            reviewed = sum(1 for v in verses.values() if (v.get('review') or {}).get('resource'))
            total = len(verses) + len(unavailable)
            rows.setdefault(name, {})[t] = (reviewed, total)
            totals[t][0] += reviewed
            totals[t][1] += total
    return rows, totals


def print_table(only):
    rows, totals = coverage(only)
    width = 16
    print('\nReviewed verses (reviewed/total; "done" = complete):')
    print('book'.ljust(width) + ''.join(t.rjust(13) for t in only))
    for name, cells in rows.items():
        line = name.ljust(width)
        for t in only:
            r, n = cells.get(t, (0, 0))
            line += ('done' if n and r == n else f'{r}/{n}').rjust(13)
        print(line)
    print('TOTAL'.ljust(width) + ''.join(f'{totals[t][0]}/{totals[t][1]}'.rjust(13) for t in only))
    print('LEFT'.ljust(width) + ''.join(str(totals[t][1] - totals[t][0]).rjust(13) for t in only))


def check_ownership(failures, warnings, owner, since):
    code, out = run(['git', 'log', '--first-parent', '--no-merges', '--name-only', '--format=', f'{since}..HEAD'])
    if code:
        failures.append(f'could not list changes since {since}: {out}')
        return
    changed = sorted({line.strip() for line in out.splitlines() if line.strip()})
    foreign = [(p, owner_of(p)) for p in changed if owner_of(p) not in (owner, 'unassigned')]
    unassigned = [p for p in changed if owner_of(p) == 'unassigned']
    print(f'ownership ({owner}, own commits since {since}): {len(changed)} file(s) changed,',
          'all yours' if not foreign else f'{len(foreign)} NOT yours')
    for path, who in foreign:
        failures.append(f'{owner} changed {path}, which belongs to {who}')
    if unassigned:
        warnings.append(f'{len(unassigned)} changed file(s) have no owner in the agreement: {unassigned[:8]}')


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--owner', choices=['claude', 'codex'])
    parser.add_argument('--since', help='Base commit for the ownership check, for example origin/main')
    parser.add_argument('--only', nargs='+', choices=TRANSLATIONS, help='Limit rebuild/consistency/table to these')
    parser.add_argument('--table-only', action='store_true', help='Only print the done/left table')
    parser.add_argument('--skip-tests', action='store_true', help='Skip the unit tests (faster while iterating)')
    args = parser.parse_args()
    only = args.only or TRANSLATIONS
    if args.table_only:
        print_table(only)
        return 0
    if bool(args.owner) != bool(args.since):
        parser.error('--owner and --since go together')
    failures, warnings = [], []
    if not args.skip_tests:
        check_unit_tests(failures)
    check_rebuilds(failures, only)
    check_consistency(failures, warnings, only)
    if args.owner:
        check_ownership(failures, warnings, args.owner, args.since)
    print_table(only)
    for warning in warnings:
        print('warning:', warning)
    if failures:
        print(f'\nFAILED ({len(failures)}):')
        for failure in failures:
            print(' -', failure)
        return 1
    print('\nAll word-link checks passed.')
    return 0


if __name__ == '__main__':
    sys.exit(main())
