#!/usr/bin/env python3
"""Offline local Whisper + exact seven-word anchors, using the bundled catalog.
Raw media/transcriptions stay in --work, never in published app data.
"""
import argparse, hashlib, importlib.metadata, json, os, subprocess, time, urllib.request
from pathlib import Path
from match import index_reference, match_recording
ROOT=Path(__file__).resolve().parents[2]
def sha(data):return hashlib.sha256(data).hexdigest()
def write_json(path,value):
    path.parent.mkdir(parents=True,exist_ok=True)
    temp=path.with_suffix(path.suffix+'.tmp');temp.write_text(json.dumps(value,ensure_ascii=False,separators=(',',':'))+'\n');temp.replace(path)
def run(args):
    import mlx_whisper
    work=args.work.resolve();work.mkdir(parents=True,exist_ok=True)
    model=args.model.resolve()
    if not model.is_dir():raise ValueError('Pass an existing local MLX Whisper model folder.')
    model_info={'engine':'mlx-whisper','version':importlib.metadata.version('mlx-whisper'),'modelFiles':{p.name:sha(p.read_bytes()) for p in model.iterdir() if p.suffix in ('.npz','.safetensors','.json')}}
    subprocess.run(['node',str(ROOT/'scripts/audiobook-alignment/export-reference.mjs'),str(work/'reference.json')],cwd=ROOT,check=True)
    refs={b['id']:b for b in json.loads((work/'reference.json').read_text())}
    catalog=json.loads((ROOT/'src/data/audioCatalog.json').read_text())
    books=[b for b in catalog['books'] if b['id'] in refs and (not args.book or b['id'] in args.book)]
    books.sort(key=lambda b:sum(t['duration'] for e in b['editions'] for t in e['tracks']))
    output=args.output.resolve() if args.output else ROOT/'public/data/audio/books';output.mkdir(parents=True,exist_ok=True)
    index_path=output/'index.json' if args.output else ROOT/'src/data/audiobookTextIndex.json'
    index=json.loads(index_path.read_text()) if index_path.exists() else {}
    errors=[]
    for book in books:
        reference=refs[book['id']]
        reference_index=index_reference(reference)
        result={'schemaVersion':1,'bookId':book['id'],'textSha256':reference['textSha256'],'textSourceUrl':reference['sourceUrl'],'method':'Unique exact seven-word anchors; automatic paragraph navigation, not word-perfect synchronization.', 'model':model_info,'paragraphs':{},'tracks':{}}
        for edition in book['editions']:
            for track in edition['tracks']:
                started=time.monotonic();prefix=work/track['id'];media=prefix.with_suffix('.mp3');transcript_file=prefix.with_suffix('.json')
                try:
                    if transcript_file.exists():
                        saved=json.loads(transcript_file.read_text())
                        if saved['url']!=track['url'] or saved['bytes']!=track['bytes'] or saved['model']!=model_info:raise ValueError('Existing transcript source or model differs; move it aside to rebuild.')
                    else:
                        if not media.exists() or media.stat().st_size!=track['bytes']:
                            temp=media.with_suffix('.mp3.part')
                            with urllib.request.urlopen(track['url'],timeout=90) as response, temp.open('wb') as f:
                                size=0
                                while chunk:=response.read(262144):
                                    size+=len(chunk)
                                    if size>track['bytes']:raise ValueError('Recording exceeds catalog size.')
                                    f.write(chunk)
                            if size!=track['bytes']:raise ValueError('Incomplete recording; retained for retry.')
                            temp.replace(media)
                        audio_hash=sha(media.read_bytes())
                        transcript=mlx_whisper.transcribe(str(media),path_or_hf_repo=str(model),language='en',word_timestamps=True,temperature=0,condition_on_previous_text=False,verbose=None)
                        saved={'url':track['url'],'bytes':track['bytes'],'audioSha256':audio_hash,'model':model_info,'transcription':transcript}
                        write_json(transcript_file,saved)
                    matched=match_recording(saved['transcription'],reference,track['duration'],reference_index)
                    result['paragraphs'].update(matched.pop('paragraphs'))
                    result['tracks'][track['id']]={'url':track['url'],'bytes':track['bytes'],'audioSha256':saved['audioSha256'],'duration':track['duration'],**matched}
                    write_json(output/(book['id']+'.json'),result)
                    index[book['id']]={'file':book['id']+'.json','textSha256':reference['textSha256'],'tracks':len(result['tracks'])}
                    write_json(index_path,index)
                    print(json.dumps({'book':book['id'],'track':track['title'],'seconds':round(time.monotonic()-started,1),'matchedSeconds':matched['matchedSeconds'],'duration':track['duration'],'spans':len(matched['spans'])}),flush=True)
                    if not args.keep_media:media.unlink(missing_ok=True)
                except Exception as error:
                    errors.append({'trackId':track['id'],'error':str(error)})
                    write_json(work/'errors.json',errors)
                    print(json.dumps(errors[-1]),flush=True)
        write_json(output/(book['id']+'.json'),result)
    write_json(work/'errors.json',errors)
    if errors:raise SystemExit(f'{len(errors)} recordings failed; see work/errors.json. Successful recordings retained.')
if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--work',type=Path,required=True);parser.add_argument('--model',type=Path,required=True);parser.add_argument('--book',action='append');parser.add_argument('--keep-media',action='store_true');parser.add_argument('--output',type=Path);run(parser.parse_args())
