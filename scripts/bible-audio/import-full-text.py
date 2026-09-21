#!/usr/bin/env python3
"""Validate a complete staged batch, then explicitly install its accepted spans."""
import argparse, collections, copy, hashlib, importlib.util, json, re
from pathlib import Path

root = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('alignment', Path(__file__).with_name('align-full-text.py'))
alignment = importlib.util.module_from_spec(spec)
spec.loader.exec_module(alignment)
sha = lambda value: hashlib.sha256(value).hexdigest()
read = lambda path: json.loads(path.read_text())

def validate(candidates, reference):
    catalog = read(root / 'src/data/bibleAudioCatalog.json')
    by_id = {t['id']: t for b in catalog['books'] for e in b['editions'] for t in e['tracks']}
    assert len(reference) == len(by_id) == 1189
    assert {row['track']['id'] for row in reference} == set(by_id)
    assert read(candidates / 'errors.json') == []
    pipeline = sha(Path(__file__).with_name('align-full-text.py').read_bytes())
    counts, books, receipts, models = collections.Counter(), {}, [], {}
    for item in reference:
        track = item['track']; current = copy.deepcopy(by_id[track['id']]); expected = copy.deepcopy(track)
        # Derived coverage counts may change on a repeat import; audio identity may not.
        current['bible'].pop('timedVerses', None); expected['bible'].pop('timedVerses', None)
        assert current == expected, f"Recording changed: {track['id']}"
        raw = (candidates / (track['id'] + '.json')).read_bytes(); candidate = json.loads(raw)
        assert candidate['track'] == track
        assert candidate['textSha256'] == item['textSha256']
        text_bytes = (root / 'public/data/translations/BSB' / (track['bible']['slug'] + '.json')).read_bytes()
        assert sha(text_bytes) == item['textSha256']
        chapter = next(c for c in json.loads(text_bytes)['chapters'] if c['number'] == track['bible']['chapter'])
        assert item['verses'] == [{'number': v['number'], 'text': v['text']} for v in chapter['verses']]
        assert candidate['inputSha256'] == sha(json.dumps(item, sort_keys=True, separators=(',', ':')).encode())
        assert candidate['model']['pipelineSha256'] in {pipeline, *alignment.COMPATIBLE_PIPELINES}
        assert candidate['model']['modelSha256'] == alignment.MODEL_SHA
        models[candidate['model']['pipelineSha256']] = candidate['model']
        assert candidate['audioHeaderSha256'] == item['audioHeaderSha256']
        assert re.fullmatch('[a-f0-9]{64}', candidate['audioSha256'])
        verses = candidate['verses']
        assert verses == alignment.assess(item['verses'], [w for v in verses for w in v['words']], track['duration'])
        accepted = [{key: v[key] for key in ['verse', 'start', 'end', 'text']} for v in verses if not v['reasons']]
        assert all(a['end'] <= b['start'] for a, b in zip(accepted, accepted[1:]))
        counts['total'] += len(verses); counts['accepted'] += len(accepted)
        for v in verses: counts.update(v['reasons'])
        book = books.setdefault(track['bible']['slug'], {'schemaVersion': 1, 'translation': 'BSB', 'book': track['bible']['book'], 'chapters': {}})
        book['chapters'][str(chapter['number'])] = {'totalVerses': len(verses), 'verses': accepted}
        receipts.append({'trackId': track['id'], 'candidateSha256': sha(raw), 'audioSha256': candidate['audioSha256'],
                         'pipelineSha256': candidate['model']['pipelineSha256'],
                         'textSha256': item['textSha256'], 'accepted': len(accepted),
                         'rejected': {str(v['verse']): v['reasons'] for v in verses if v['reasons']}})
    assert len(books) == 66 and counts['total'] == 31102
    return catalog, books, {'schemaVersion': 1, 'method': 'Complete BSB text forced alignment',
                            'models': list(models.values()), 'counts': dict(counts), 'chapters': receipts,
                            'humanListeningReview': False}

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--candidates', type=Path, required=True)
    parser.add_argument('--reference', type=Path, required=True)
    parser.add_argument('--install', action='store_true', help='Write validated spans and coverage to the app')
    args = parser.parse_args()
    catalog, books, audit = validate(args.candidates, read(args.reference))
    print(json.dumps(audit['counts']))
    if args.install:
        # Nothing is written until every chapter has passed all validation.
        for book in catalog['books']:
            data = books[book['bibleSlug']]
            for edition in book['editions']:
                for track in edition['tracks']:
                    track['bible']['timedVerses'] = len(data['chapters'][str(track['bible']['chapter'])]['verses'])
        combined = read(root / 'src/data/audioCatalog.json')
        combined['books'] = [b for b in combined['books'] if b.get('kind') != 'bible'] + catalog['books']
        outputs = {root / 'public/data/audio/bsb-hays' / (slug + '.json'): data for slug, data in books.items()}
        outputs.update({root / 'src/data/bibleAudioCatalog.json': catalog, root / 'src/data/audioCatalog.json': combined,
                        root / 'scripts/bible-audio/full-text-audit.json': audit})
        for path, data in outputs.items():
            text = json.dumps(data, ensure_ascii=False, indent=2 if path.name.endswith('Catalog.json') or path.name == 'full-text-audit.json' else None, separators=None if path.name.endswith('Catalog.json') or path.name == 'full-text-audit.json' else (',', ':')) + '\n'
            temp = path.with_suffix('.tmp'); temp.write_text(text); temp.replace(path)
        print('Installed all 66 books; Scripture and recording identities unchanged.')
