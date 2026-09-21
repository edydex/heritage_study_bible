#!/usr/bin/env python3
"""Match retained Whisper output to a named text edition without re-running ASR.
Only complete books are written. Original model/audio provenance is preserved.
"""
import argparse, json, re
from pathlib import Path
from generate import write_json, ROOT
from match import index_reference, match_recording

def run(args):
    refs={book['id']:book for book in json.loads(args.reference.read_text())}
    catalog=json.loads((args.catalog or ROOT/'src/data/audioCatalog.json').read_text())
    output=args.output.resolve()
    index_path=output/'index.json'
    index=json.loads(index_path.read_text()) if index_path.exists() else {}
    for book_id in args.book:
        book=next(book for book in catalog['books'] if book['id']==book_id)
        reference=refs[book.get('textBookId',book_id)]
        reference_index=index_reference(reference)
        result={'schemaVersion':1,'bookId':book_id,'textBookId':reference['id'],
            'textSha256':reference['textSha256'],'textSourceUrl':reference['sourceUrl'],
            'method':'Unique exact seven-word anchors; automatic paragraph navigation, not word-perfect synchronization.',
            'paragraphs':{},'tracks':{}}
        for edition in book['editions']:
            for track in edition['tracks']:
                saved=json.loads((args.work/(track['id']+'.json')).read_text())
                if saved['url']!=track['url'] or saved['bytes']!=track['bytes'] or not re.fullmatch('[a-f0-9]{64}',saved['audioSha256']):
                    raise ValueError('Cached recording identity does not match the catalog.')
                if not saved.get('model',{}).get('modelFiles'):raise ValueError('Missing original model provenance.')
                if 'model' in result and result['model']!=saved['model']:raise ValueError('Mixed model provenance.')
                result['model']=saved['model']
                matched=match_recording(saved['transcription'],reference,track['duration'],reference_index)
                result['paragraphs'].update(matched.pop('paragraphs'))
                result['tracks'][track['id']]={'url':track['url'],'bytes':track['bytes'],'audioSha256':saved['audioSha256'],'duration':track['duration'],**matched}
        write_json(output/(book_id+'.json'),result)
        index[book_id]={'file':book_id+'.json','textSha256':reference['textSha256'],'tracks':len(result['tracks'])}
        write_json(index_path,index)
        duration=sum(track['duration'] for track in result['tracks'].values())
        print(json.dumps({'book':book_id,'tracks':len(result['tracks']),'matchedPercent':round(sum(track['matchedSeconds'] for track in result['tracks'].values())/duration*100,2)}))

if __name__=='__main__':
    parser=argparse.ArgumentParser()
    parser.add_argument('--work',type=Path,required=True)
    parser.add_argument('--reference',type=Path,required=True)
    parser.add_argument('--output',type=Path,required=True)
    parser.add_argument('--catalog',type=Path,help='Reader catalog when running on a separate compute machine')
    parser.add_argument('--book',action='append',required=True)
    run(parser.parse_args())
