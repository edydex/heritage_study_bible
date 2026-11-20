"""Validate approved translation reviews and compile exact Greek source identities."""

import collections
import hashlib
import importlib.util
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]

def read(path):
    return json.loads(Path(path).read_text(encoding='utf-8'))


def sha(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def require(condition, message):
    if not condition:
        raise ValueError(message)


def pinned(path, expected, label):
    require(sha(path) == expected, f'{label} source pin changed')


def load_module(name, filename):
    spec = importlib.util.spec_from_file_location(name, Path(__file__).with_name(filename))
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


compiler = load_module('review_compiler', 'compile-reviewed-links.py')


def approved_resources(reviews, registry, book_names, *, target_id):
    """The root-owned registry is the authority for separately reviewed resources."""
    status = read(registry)
    require(status.get('schemaVersion') == 1 and status.get('targetId') == target_id,
            'Wrong review registry identity')
    require(isinstance(status.get('resources'), list), 'Missing review registry resources')
    accepted, seen = [], set()
    for item in status['resources']:
        if item.get('status') != 'accepted':
            continue
        require(isinstance(item.get('file'), str) and item['file'].endswith('.json')
                and item['file'] not in seen and re.fullmatch(r'[0-9a-f]{64}', item.get('sha256', '')),
                'Invalid/duplicate approved review resource')
        seen.add(item['file'])
        path = Path(reviews) / item['file']
        require(path.resolve().parent == Path(reviews).resolve(), 'Review path escaped directory')
        pinned(path, item['sha256'], 'Approved review')
        for field in ['authorReceipt', 'independentPeer']:
            proof = item.get(field, {})
            require(isinstance(proof, dict) and re.fullmatch(r'[0-9a-f]{64}', proof.get('sha256', '')),
                    f'Missing approved {field}')
            # Registry authority carries the reviewed proof digest. A local
            # evidence file, when explicitly requested, must also match; ignored
            # review artifacts are not an implicit dependency of a clean build.
            if 'file' in proof:
                require(isinstance(proof['file'], str), 'Malformed proof file')
                pinned(ROOT / proof['file'], proof['sha256'], field)
        resource = read(path)
        require(resource.get('sourceId') == 'N1904' and resource.get('targetId') == target_id
                and resource.get('schemaVersion') == 1 and resource.get('book') in book_names,
                'Wrong review resource identity')
        require(isinstance(resource.get('verses'), dict) and resource['verses']
                and all(re.fullmatch(r'[1-9][0-9]*:[1-9][0-9]*', ref) for ref in resource['verses']),
                'Invalid review verse references')
        accepted.append((path, item, resource))
    require(accepted, 'At least one approved review resource is required')
    return accepted


def apply_reviews(books, approved, greek, concordance, shared):
    """Apply the actual shared compiler; validate global source ownership separately."""
    source_words = {book['name']: book['verses'] for book in concordance['books']}
    owners, explained, moved = collections.defaultdict(list), set(), {}
    local_source = set()
    counts = collections.Counter()
    for path, item, resource in approved:
        name = resource['book']
        for ref, entry in resource['verses'].items():
            chapter, verse = map(int, ref.split(':'))
            physical = {'chapter': chapter, 'verse': verse}
            reference = entry.get('sourceReference', physical)
            raw_ref = f"{reference['chapter']}:{reference['verse']}"
            require(ref not in books[name]['verses'], 'Review resources overlap the same target verse')
            require(raw_ref in greek[name] or entry.get('sourceAbsent'), 'Missing source requires an explicit absence review')
            require(ref in books[name]['_target'] or entry.get('targetAbsent'), 'Missing target requires an explicit absence review')
            source_text = greek[name].get(raw_ref, '')
            target_text = books[name]['_target'].get(ref, '')
            compiled = compiler.compile_verse(entry, source_text, target_text,
                                               source_verses=greek[name], reference=reference)
            compiler.validate_article_auxiliaries(entry, source_words[name], concordance['lemmas'], reference)
            compiled['review'].update(resource=path.name, sha256=item['sha256'])
            books[name]['verses'][ref] = compiled
            books[name]['unavailable'].pop(ref, None)
            tokens = list(re.finditer(r'\S+', source_text))
            local_source.update((name, raw_ref, i) for i in range(len(tokens)))
            counts.update(reviewedVerses=1, groups=len(entry['groups']))
            target_spans, linked_spans = [], []
            for group in entry['groups']:
                sr = group.get('sourceReference', reference)
                sr_ref = f"{sr['chapter']}:{sr['verse']}"
                for index in group['sourceTokens']:
                    owners[name, sr_ref, index].append(ref)
                spans = [compiler.phrase_range(target_text, phrase) for phrase in group['targetPhrases']]
                target_spans.extend(spans)
                linked_spans.extend(spans)
            for note in entry.get('unmappedSource', []):
                for index in note['tokens']:
                    require((name, raw_ref, index) not in explained, 'Duplicate source explanation')
                    explained.add((name, raw_ref, index))
            for note in entry.get('sourceMoved', []):
                to = note['targetReference']
                for index in note['tokens']:
                    key = (name, raw_ref, index)
                    require(key not in moved, 'Duplicate moved source declaration')
                    moved[key] = f"{to['chapter']}:{to['verse']}"
            for note in entry.get('unmappedTarget', []):
                target_spans.append(compiler.phrase_range(target_text, note))
            for word in re.finditer(r"[^\W_]+(?:['’][^\W_]+)*", target_text):
                require(sum(a <= word.start() and word.end() <= b for a, b in target_spans) == 1,
                        'Translation word must have exactly one linked or explained owner')
                counts['targetWords'] += 1
                counts['mappedTargetWords'] += any(a <= word.start() and word.end() <= b for a, b in linked_spans)
    require(isinstance(shared, dict), 'Malformed shared-source declarations')
    duplicates = {}
    for (name, ref, index), refs in owners.items():
        if len(refs) > 1:
            duplicates.setdefault(name, {})[f'{ref}:{index}'] = sorted(refs)
    declared = {}
    for name, keys in shared.items():
        require(name in books and isinstance(keys, dict) and keys, 'Malformed shared-source book')
        declared[name] = {}
        for key, refs in keys.items():
            require(isinstance(key, str) and re.fullmatch(r'[1-9][0-9]*:[1-9][0-9]*:[0-9]+', key)
                    and isinstance(refs, list) and len(refs) > 1 and all(isinstance(ref, str) for ref in refs)
                    and len(set(refs)) == len(refs), 'Malformed shared-source owners')
            declared[name][key] = sorted(refs)
    require(duplicates == declared, 'Unexpected shared source identities')
    for (name, ref, index), destination in moved.items():
        require(ref != destination and owners[name, ref, index] == [destination],
                'Moved source must have its exact exclusive destination counterpart')
    require(set(owners).isdisjoint(explained) and set(owners) | explained == local_source,
            'Actual Greek source words must be linked or explained exactly once')
    counts.update(sourceWords=len(local_source), mappedSourceWords=len(owners),
                  explainedSourceWords=len(explained), exclusiveMovedTokens=len(moved))
    counts['explainedTargetWords'] = counts['targetWords'] - counts['mappedTargetWords']
    return dict(counts)
