"""Conservative, exact-phrase paragraph anchors. Does not rewrite book text."""
import collections, math, re

def tokens(text):
    return re.findall(r'[a-z0-9]+', re.sub(r'\[\d+\]', '', text.lower().replace("'", '').replace('’', '')))

def index_reference(book):
    phrases = collections.defaultdict(list)
    paragraphs = {}
    for c, chapter in enumerate(book['chapters']):
        for p, text in enumerate(chapter['paragraphs']):
            key = f'{c}:{p}'
            words = tokens(text)
            paragraphs[key] = {'chapterIndex': c, 'paragraphIndex': p, 'text': text, 'title': chapter['title']}
            for i in range(len(words)-6):
                phrases[tuple(words[i:i+7])].append((key, i))
    return {phrase: positions[0] for phrase, positions in phrases.items() if len(positions)==1}, paragraphs

def coalesce_anchors(anchors):
    # Whisper can repeat a phrase across adjacent segments. Merge overlapping
    # anchors to the same paragraph, regardless of its repeated word offset.
    # A connected overlap group naming different paragraphs is ambiguous.
    spans=[]; cluster=[]; end=-1
    def finish():
        if cluster and len({a['paragraph'] for a in cluster})==1:
            spans.append({'start':cluster[0]['start'],'end':max(a['end'] for a in cluster),'paragraph':cluster[0]['paragraph']})
    for anchor in sorted(anchors,key=lambda a:(a['start'],a['end'])):
        if cluster and anchor['start']>=end:
            finish();cluster=[];end=-1
        cluster.append(anchor);end=max(end,anchor['end'])
    finish()
    return spans

def match_recording(transcription, book, duration, reference_index=None):
    phrases, paragraphs = reference_index if reference_index is not None else index_reference(book)
    words = []
    for segment in transcription.get('segments', []):
        # Silence/hallucinated or very low-likelihood speech has no destination.
        if segment.get('no_speech_prob', 0)>0.6 or segment.get('avg_logprob', 0)<-1: continue
        for word in segment.get('words', []):
            for token in tokens(word['word']): words.append({**word, 'token': token})
    anchors=[]
    for i in range(len(words)-6):
        group=words[i:i+7]
        found=phrases.get(tuple(w['token'] for w in group))
        if not found: continue
        start=group[0]['start'];end=group[-1]['end']
        if not all(math.isfinite(w.get('start', math.nan)) and math.isfinite(w.get('end', math.nan)) and w['end']>w['start'] for w in group): continue
        if start<0 or end>duration or not 1<end-start<15:continue
        if any(b['start']<a['end']-0.05 or b['start']-a['end']>2 for a,b in zip(group,group[1:])): continue
        if sum(w.get('probability',0) for w in group)/len(group)<0.7:continue
        key,_=found
        anchors.append({'start':round(start,3),'end':round(end,3),'paragraph':key})
    spans=coalesce_anchors(anchors)
    used={s['paragraph'] for s in spans}
    return {'spans':spans,'paragraphs':{key:paragraphs[key] for key in used},'recognizedWords':len(words),
            'matchedSeconds':round(sum(s['end']-s['start'] for s in spans),2)}
