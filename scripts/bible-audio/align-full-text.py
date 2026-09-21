#!/usr/bin/env python3
"""Stage automatic MMS timings against complete BSB text, never rewrite Scripture.

Requires the separately licensed MMS model (CC-BY-NC 4.0), PyTorch/TorchAudio
2.8, NumPy and ffmpeg. Model and recordings are not bundled with the application.
The explicit --work/--output directories must be outside the repository.
"""
import argparse
import hashlib
import json
import math
import re
import subprocess
import time
import urllib.request
from pathlib import Path

MODEL_URL = 'https://dl.fbaipublicfiles.com/mms/torchaudio/ctc_alignment_mling_uroman/model.pt'
MODEL_SHA = '20ef12963ab4924bef49ac4fc7f58ad5da2ee43b2c11bc8c853c9b90ecdbc680'
SAMPLE_RATE = 16000


def sha(data):
    return hashlib.sha256(data).hexdigest()


def write(path, value):
    temp = path.with_suffix(path.suffix + '.tmp')
    temp.write_text(json.dumps(value, ensure_ascii=False, separators=(',', ':'), allow_nan=False) + '\n')
    temp.replace(path)


def tokens(text):
    return re.findall('[a-z0-9]+', text.lower().replace("'", '').replace('’', ''))


def assess(verses, records, duration):
    """Keep exact verse tokens; record conservative rejection reasons explicitly."""
    result, cursor = [], 0
    for verse in verses:
        words = tokens(verse['text'])
        subset = records[cursor:cursor + len(words)]
        cursor += len(words)
        if not words or [w['text'] for w in subset] != words:
            raise ValueError('Alignment words differ from the complete reference')
        reasons = []
        if any(not w.isalpha() for w in words):
            reasons.append('numeric-token-needs-review')
        if any(not all(math.isfinite(w[k]) for k in ['start', 'end', 'score'])
               or not 0 <= w['start'] < w['end'] <= duration or not 0 <= w['score'] <= 1
               for w in subset):
            reasons.append('invalid-span')
        if any(a['end'] > b['start'] + .001 for a, b in zip(subset, subset[1:])):
            reasons.append('word-overlap')
        score = sum(w['score'] for w in subset) / len(words)
        if score < .65 or subset[0]['score'] < .3 or subset[-1]['score'] < .3:
            reasons.append('low-confidence')
        start, end = subset[0]['start'], subset[-1]['end']
        if end <= start or not .25 <= len(words) / (end - start) <= 10:
            reasons.append('implausible-duration')
        result.append({'verse': verse['number'], 'text': ' '.join(words), 'start': start,
                       'end': end, 'score': score, 'words': subset, 'reasons': reasons})
    if cursor != len(records):
        raise ValueError('Extra aligned words')
    for a, b in zip(result, result[1:]):
        if a['end'] > b['start'] + .001:
            for row in (a, b):
                if 'verse-overlap' not in row['reasons']:
                    row['reasons'].append('verse-overlap')
    return result


def run(args):
    import numpy as np
    import torch
    import torchaudio
    if not torch.__version__.startswith('2.8.') or not torchaudio.__version__.startswith('2.8.'):
        raise ValueError('Use pinned PyTorch and TorchAudio 2.8')
    torch.set_num_threads(4)
    work, output = args.work.resolve(), args.output.resolve()
    repo = Path(__file__).resolve().parents[2]
    if (repo / 'package.json').exists() and any(p.is_relative_to(repo) for p in [work, output]):
        raise ValueError('Keep staged media/results outside the source repository')
    work.mkdir(parents=True, exist_ok=True)
    output.mkdir(parents=True, exist_ok=True)
    checkpoint = Path(torch.hub.get_dir()) / 'checkpoints/model.pt'
    if checkpoint.exists() and sha(checkpoint.read_bytes()) != MODEL_SHA:
        raise ValueError('Cached MMS model identity differs')
    bundle = torchaudio.pipelines.MMS_FA
    model = bundle.get_model().eval().to('cuda')
    if sha(checkpoint.read_bytes()) != MODEL_SHA:
        raise ValueError('Downloaded MMS model identity differs')
    tokenizer, aligner = bundle.get_tokenizer(), bundle.get_aligner()
    receptive, stride = 1, 1
    for layer in model.model.feature_extractor.conv_layers:
        conv = layer.conv
        receptive += (conv.kernel_size[0] - 1) * stride
        stride *= conv.stride[0]
    assert stride == 320 and receptive == 400 and bundle.sample_rate == SAMPLE_RATE
    provenance = {'engine': 'torchaudio MMS_FA', 'modelUrl': MODEL_URL, 'modelSha256': MODEL_SHA,
                  'modelLicense': 'CC-BY-NC-4.0', 'torch': torch.__version__, 'torchaudio': torchaudio.__version__,
                  'pipelineSha256': sha(Path(__file__).read_bytes()), 'precision': 'float32',
                  'coreSeconds': 30, 'contextSeconds': 1, 'frameStrideSamples': stride,
                  'receptiveFieldSamples': receptive, 'sampleRate': SAMPLE_RATE}
    write(output / 'model.json', provenance)
    references = json.loads(args.reference.read_text())
    errors = []
    for item in references:
        track = item['track']
        if args.track and track['id'] not in args.track:
            continue
        if args.stop_file and args.stop_file.exists():
            print('Stopped between recordings; staged results retained.', flush=True)
            return
        if not re.fullmatch(r'bsb-hays-\d{2}-\d{3}', track['id']):
            raise ValueError('Invalid track identifier')
        if not track['url'].startswith('https://openbible.com/audio/hays/'):
            raise ValueError('Unexpected recording origin')
        started = time.monotonic()
        result_path = output / (track['id'] + '.json')
        input_sha = sha(json.dumps(item, sort_keys=True, separators=(',', ':')).encode())
        try:
            if result_path.exists():
                saved = json.loads(result_path.read_text())
                if saved['inputSha256'] != input_sha or saved['model'] != provenance:
                    raise ValueError('Staged result source/model differs; use a separate output directory')
                if saved['verses'] != assess(item['verses'], [w for v in saved['verses'] for w in v['words']], track['duration']):
                    raise ValueError('Staged result failed revalidation')
                continue
            path = work / (track['id'] + '.mp3')
            if not path.exists() or path.stat().st_size != track['bytes']:
                temp = path.with_suffix('.mp3.part')
                with urllib.request.urlopen(track['url'], timeout=90) as response:
                    temp.write_bytes(response.read(track['bytes'] + 1))
                if temp.stat().st_size != track['bytes']:
                    raise ValueError('Recording byte count differs')
                temp.replace(path)
            media = path.read_bytes()
            if sha(media[:item['audioHeaderBytes']]) != item['audioHeaderSha256']:
                raise ValueError('Recording header identity differs')
            pcm = subprocess.check_output(['ffmpeg', '-v', 'error', '-i', str(path), '-f', 'f32le', '-ac', '1', '-ar', str(SAMPLE_RATE), '-'])
            waveform = torch.from_numpy(np.frombuffer(pcm, dtype=np.float32).copy()).unsqueeze(0)
            emissions, centers = [], []
            core, context, length = 30 * SAMPLE_RATE, SAMPLE_RATE, waveform.shape[1]
            if abs(length / SAMPLE_RATE - track['duration']) > .15:
                raise ValueError('Decoded recording duration differs')
            with torch.inference_mode():
                for offset in range(0, length, core):
                    start, end = max(0, offset - context), min(length, offset + core + context)
                    emission, _ = model(waveform[:, start:end].to('cuda'))
                    positions = start + torch.arange(emission.shape[1]) * stride + (receptive - 1) / 2
                    mask = (positions >= offset) & (positions < min(length, offset + core))
                    centers.extend((positions[mask] / SAMPLE_RATE).tolist())
                    emissions.append(emission[0].cpu()[mask])
                    del emission
            if any(not .019 < b - a < .021 for a, b in zip(centers, centers[1:])):
                raise ValueError('Discontinuous acoustic frames')
            words = [word for verse in item['verses'] for word in tokens(verse['text'])]
            # Star absorbs narrator headings. Numeric words remain rejected; never
            # silently delete a number or fabricate its spoken form in app text.
            normalized = ['*'] + [w if w.isalpha() else '*' for w in words] + ['*']
            with torch.inference_mode():
                spans = aligner(torch.cat(emissions), tokenizer(normalized))[1:-1]
            if len(spans) != len(words):
                raise ValueError('Word count differs')
            records = []
            for word, parts in zip(words, spans):
                records.append({'text': word, 'start': max(0, centers[parts[0].start] - .01),
                                'end': min(length / SAMPLE_RATE, centers[parts[-1].end - 1] + .01),
                                'score': sum(p.score * len(p) for p in parts) / sum(len(p) for p in parts)})
            verses = assess(item['verses'], records, track['duration'])
            write(result_path, {'schemaVersion': 1, 'track': track, 'inputSha256': input_sha,
                                'textSha256': item['textSha256'], 'audioSha256': sha(media),
                                'audioHeaderSha256': item['audioHeaderSha256'], 'model': provenance, 'verses': verses})
            print(json.dumps({'track': track['id'], 'verses': len(verses),
                              'accepted': sum(not v['reasons'] for v in verses),
                              'seconds': round(time.monotonic() - started, 1)}), flush=True)
        except Exception as error:
            errors.append({'track': track['id'], 'error': str(error)})
            write(output / 'errors.json', errors)
            print(json.dumps(errors[-1]), flush=True)
    write(output / 'errors.json', errors)
    if errors:
        raise SystemExit(f'{len(errors)} recordings failed; inspect staged errors.json')


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--reference', type=Path, required=True)
    parser.add_argument('--work', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--track', action='append')
    parser.add_argument('--stop-file', type=Path)
    run(parser.parse_args())
