#!/usr/bin/env python3
"""Compile explicit verse-level correspondence reviews into checked offsets.

Compilation validates text/ranges/completeness, not the linguistic judgment.
The review attribution records assistant review; it is not human certification.
"""
import argparse, hashlib, json, re
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
DATA=ROOT/'public/data/original-languages'
def read(p):return json.loads(p.read_text())
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
def visible(t):
    return re.sub(r'</?b>','',re.sub(r'\s*\|\|\s*','\n',re.sub(r'\s+¶\s+','\n',re.sub(r'^\s*¶\s*','',t))))
def corpus(data):return {b['name']:{f"{c['number']}:{v['number']}":visible(v['text']) for c in b['chapters'] for v in c['verses']} for b in data['books']}
def phrase_range(text,phrase):
    matches=list(re.finditer(r'(?<!\w)'+re.escape(phrase['text'])+r'(?!\w)',text))
    n=phrase.get('occurrence',0)
    if not isinstance(n,int) or n<0 or n>=len(matches):raise ValueError(f"Phrase occurrence does not exist: {phrase}")
    return [matches[n].start(),matches[n].end()]
def merge(ranges):
    out=[]
    for a,b in sorted(ranges):
        if out and a<=out[-1][1]+1:out[-1][1]=max(out[-1][1],b)
        else:out.append([a,b])
    return out

def validate_article_auxiliaries(review,source_words,lemmas,reference):
    """An English verbal auxiliary cannot be attributed to a sole article.

    The actual source occurrence metadata distinguishes articles from accented
    lookalikes. A complete multiword constituent remains permitted; this check
    never guesses an alternative verb or edits a review automatically.
    """
    for group in review['groups']:
        if len(group['sourceTokens'])!=1:continue
        ref=group.get('sourceReference',reference)
        words=source_words[f"{ref['chapter']}:{ref['verse']}"]
        lemma=lemmas[words[group['sourceTokens'][0]][2]]
        if not any(str(strong).lstrip('0')=='3588' for strong in lemma['strongs']):continue
        assert not any(re.search(r'\b(?:is|are|was|were)\b',phrase['text'],re.I) for phrase in group['targetPhrases']), 'A sole Greek article cannot anchor an English verbal auxiliary. Link the actual predicate or explain a supplied copula.'

def compile_verse(review,source_text,target_text,allow_incomplete=False,source_verses=None,reference=None):
    assert review['sourceText']==source_text,'Reviewed Greek text differs from displayed witness'
    assert review['targetText']==target_text,'Reviewed translation differs from displayed edition'
    tokens=list(re.finditer(r'\S+',source_text));target_words=list(re.finditer(r"[^\W_]+(?:['’][^\W_]+)*",target_text))
    reference=reference or review.get('sourceReference')
    source_used=set();all_source_used=set();target_ranges=[];groups=[]
    for n,g in enumerate(review['groups']):
        indexes=g['sourceTokens']
        source_reference=g.get('sourceReference',reference)
        external=source_reference is not None and reference is not None and source_reference!=reference
        raw_source=source_text
        if external:
            assert source_verses is not None,'Cross-reference groups require the pinned source_verses lookup'
            raw_source=source_verses[f"{source_reference['chapter']}:{source_reference['verse']}"]
        actual_tokens=list(re.finditer(r'\S+',raw_source))
        assert indexes and len(set(indexes))==len(indexes) and all(isinstance(i,int) and 0<=i<len(actual_tokens) for i in indexes),'Invalid source token indices'
        ranges=merge([[actual_tokens[i].start(),actual_tokens[i].end()] for i in indexes])
        targets=merge([phrase_range(target_text,p) for p in g['targetPhrases']])
        assert targets,'A linked source requires an actual translated phrase'
        identifier=min(indexes)
        if external:identifier=1_000_000_000+source_reference['chapter']*1_000_000+source_reference['verse']*1000+identifier
        group={'id':identifier,'source':ranges[0],'target':targets[0],'method':'explicit-assistant-verse-review'}
        if len(ranges)>1:group['sourceRanges']=ranges
        if len(targets)>1:group['targetRanges']=targets
        if g.get('note'):group['note']=g['note']
        keys=[(source_reference['chapter'],source_reference['verse'],i) if source_reference else (0,0,i) for i in indexes]
        assert not any(key in all_source_used for key in keys),'Source token assigned to more than one review group; combine its targetPhrases instead'
        if source_reference:
            group['sourceAnchors']=[{**source_reference,'startOffset':a,'endOffset':b,'text':raw_source[a:b]} for a,b in ranges]
        assert not any(a<y and b>x for a,b in targets for x,y in target_ranges),'Overlapping target phrases in explicit review'
        groups.append(group);all_source_used.update(keys)
        if not external:source_used.update(indexes)
        target_ranges.extend(targets)
    source_notes=[];target_notes=[]
    for note in review.get('unmappedSource',[]):
        assert note['reason'].strip(),'Missing source-word explanation'
        for i in note['tokens']:
            assert isinstance(i,int) and 0<=i<len(tokens),'Invalid unmapped source index'
            assert i not in source_used,'Source word both mapped and unpaired'
            source_notes.append({**(reference or {}),'startOffset':tokens[i].start(),'endOffset':tokens[i].end(),'reason':note['reason']})
            source_used.add(i)
    moved=[]
    for note in review.get('sourceMoved',[]):
        assert reference and note.get('reason') and note.get('targetReference'),'Moved source words require both references and an explanation'
        for i in note['tokens']:
            assert isinstance(i,int) and 0<=i<len(tokens) and i not in source_used,'Invalid or duplicate moved source word'
            source_used.add(i)
            moved.append({**reference,'startOffset':tokens[i].start(),'endOffset':tokens[i].end(),'targetReference':note['targetReference'],'reason':note['reason']})
    for note in review.get('unmappedTarget',[]):
        assert note['reason'].strip(),'Missing translation-word explanation'
        span=phrase_range(target_text,note)
        assert not any(a<span[1] and b>span[0] for a,b in target_ranges),'Target word both mapped and unpaired'
        target_notes.append({'startOffset':span[0],'endOffset':span[1],'reason':note['reason']})
        target_ranges.append(span)
    missing_source=[i for i in range(len(tokens)) if i not in source_used]
    missing_target=[m[0] for m in target_words if not any(a<m.end() and b>m.start() for a,b in target_ranges)]
    if not allow_incomplete:
        assert not missing_source,f'Unaccounted Greek tokens: {[(i,tokens[i][0]) for i in missing_source]}'
        assert not missing_target,f'Unaccounted translation words: {missing_target}'
    result={'sourceText':source_text,'targetText':target_text,'groups':groups,'review':{**review.get('review',{}),'method':'Explicit phrase and occurrence review by coding assistant; pending reader verification. Text and offsets mechanically validated.','sourceNotes':source_notes,'targetNotes':target_notes,'completeAccounting':not(missing_source or missing_target)}}
    if reference:result['sourceReference']=reference
    if review.get('sourceAbsent'):
        assert not source_text and not groups,'An absent source cannot contain words or links'
        result['sourceAbsent']=True
    if review.get('targetAbsent'):
        assert not target_text and not groups,'An absent translation cannot contain words or links'
        result['targetAbsent']=True
    if moved:result['review']['sourceMoved']=moved
    return result

def main():
    p=argparse.ArgumentParser(description=__doc__);p.add_argument('--reviews',type=Path,default=ROOT/'scripts/original-languages/reviewed-lsv');p.add_argument('--input',type=Path,default=DATA/'lsv-word-links');p.add_argument('--output',type=Path,required=True);p.add_argument('--target',default='LSV');p.add_argument('--allow-incomplete',action='store_true');p.add_argument('--registry',type=Path);p.add_argument('--all-reviews',action='store_true');a=p.parse_args()
    greek_corpus=read(DATA/'greek-nt-n1904.json');greek=corpus(greek_corpus);target=corpus(read(ROOT/f'public/data/translations/{a.target}.json'))
    concordance=read(DATA/'greek-concordance.json')
    assert concordance['sourceSha256']==greek_corpus['sources'][0]['sha256'],'Review metadata belongs to a different Greek source'
    source_words={book['name']:book['verses'] for book in concordance['books']}
    registry=a.registry or a.reviews.parent/f'{a.target.lower()}-review-status.json'
    if a.output.resolve()==(DATA/f'{a.target.lower()}-word-links').resolve() and not registry.exists():
        raise ValueError('Canonical review output requires an accepted-resource registry')
    if (a.allow_incomplete or a.all_reviews) and a.output.resolve()==(DATA/f'{a.target.lower()}-word-links').resolve():
        raise ValueError('Unchecked review options may only write to a separate review output')
    if a.registry and not registry.exists():raise ValueError('Requested review registry is missing')
    accepted=[]
    if registry.exists() and not a.all_reviews:
        for item in read(registry)['resources']:
            if item['status']!='accepted':continue
            path=a.reviews/item['file']
            assert path.parent.resolve()==a.reviews.resolve(),'Review resource escaped its directory'
            assert sha(path)==item['sha256'],f'Review resource changed after independent review: {path.name}'
            accepted.append(item)
        resources=[a.reviews/item['file'] for item in accepted]
    else:resources=sorted(a.reviews.glob('*.json'))
    books={};manifest=read(a.input/'index.json');reviewed=0
    for path in resources:
        resource=read(path);book=resource['book']
        if book not in books:books[book]=read(a.input/manifest['books'][book]['file'])
        for ref,entry in resource['verses'].items():
            chapter,verse=map(int,ref.split(':'))
            source_ref=entry.get('sourceReference',{'chapter':chapter,'verse':verse})
            raw_ref=f"{source_ref['chapter']}:{source_ref['verse']}"
            assert raw_ref in greek[book] or entry.get('sourceAbsent'),'Missing source reference needs an explicit witness-absence review'
            assert ref in target[book] or entry.get('targetAbsent'),'Missing target reference needs an explicit witness-absence review'
            try:
                compiled=compile_verse(entry,greek[book].get(raw_ref,''),target[book].get(ref,''),a.allow_incomplete,greek[book],source_ref)
                validate_article_auxiliaries(entry,source_words[book],concordance['lemmas'],source_ref)
            except (AssertionError,ValueError) as e:raise ValueError(f'{path.name} {ref}: {e}') from e
            absolute=path.resolve()
            compiled['review']['resource']=absolute.relative_to(ROOT).as_posix() if absolute.is_relative_to(ROOT) else path.name
            compiled['review']['sha256']=sha(path)
            books[book]['verses'][ref]=compiled;books[book]['unavailable'].pop(ref,None);reviewed+=1
    # A moved-word explanation is only valid if its actual counterpart was
    # supplied at the stated English reference; it is not a convenient gap tag.
    for book,data in books.items():
        for entry in data['verses'].values():
            for moved in entry.get('review',{}).get('sourceMoved',[]):
                ref=moved['targetReference'];other=data['verses'].get(f"{ref['chapter']}:{ref['verse']}",{})
                assert any(anchor['chapter']==moved['chapter'] and anchor['verse']==moved['verse'] and anchor['startOffset']<=moved['startOffset'] and anchor['endOffset']>=moved['endOffset'] for group in other.get('groups',[]) for anchor in group.get('sourceAnchors',[])),f'Moved word has no actual counterpart: {book} {moved}'
    a.output.mkdir(parents=True,exist_ok=True)
    for book,meta in manifest['books'].items():
        data=books.get(book) or read(a.input/meta['file']);out=a.output/meta['file'];out.write_text(json.dumps(data,ensure_ascii=False,separators=(',',':'))+'\n')
        meta.update(sha256=sha(out),linkedVerses=len(data['verses']),unlinkedVerses=len(data['unavailable']),groups=sum(len(v['groups']) for v in data['verses'].values()))
    manifest['reviewedVerseCount']=reviewed
    manifest['reviewedResources']=[{'file':path.name,'sha256':sha(path)} for path in resources]
    (a.output/'index.json').write_text(json.dumps(manifest,ensure_ascii=False,separators=(',',':'))+'\n')
    print(json.dumps({'resources':len(resources),'reviewedVerses':reviewed}))
if __name__=='__main__':main()
