"""Conservative, exact-phrase paragraph anchors. Does not rewrite book text."""
import collections, math, re

def tokens(text):
    return re.findall(r'[a-z0-9]+', re.sub(r'\[\d+\]', '', text.lower().replace("'", '').replace('’', '')))

def index_reference(book):
    phrases = collections.defaultdict(list)
    paragraphs = {}; sentences = {}
    for c, chapter in enumerate(book['chapters']):
        for p, text in enumerate(chapter['paragraphs']):
            key = f'{c}:{p}'
            words = tokens(text)
            paragraphs[key] = {'chapterIndex': c, 'paragraphIndex': p, 'text': text, 'title': chapter['title']}
            sentences[key] = chapter.get('sentenceRanges', [[] for _ in chapter['paragraphs']])[p]
            for i in range(len(words)-6):
                phrases[tuple(words[i:i+7])].append((key, i))
    return {phrase: positions[0] for phrase, positions in phrases.items() if len(positions)==1}, paragraphs, sentences

def sentence_spans(matches):
    # A spoken word may be proved by several overlapping seven-word anchors.
    # Keep only agreement about its destination, then join nearby words of the
    # same sentence. Never divide paragraph durations into invented timestamps.
    unique = []
    for candidates in matches.values():
        if len({(c['paragraph'],c['textStart'],c['textEnd']) for c in candidates}) == 1:
            unique.append(candidates[0])
    clusters = []; cluster = []; end = -1
    for word in sorted(unique, key=lambda w:(w['start'],w['end'])):
        if cluster and word['start'] >= end:
            clusters.append(cluster); cluster=[];end=-1
        cluster.append(word);end=max(end,word['end'])
    if cluster:clusters.append(cluster)
    accepted=[]
    for cluster in clusters:
        if len({(w['paragraph'],w['textStart'],w['textEnd']) for w in cluster})!=1:continue
        word={**cluster[0], 'end':max(w['end'] for w in cluster)}
        previous=accepted[-1] if accepted else None
        if previous and all(previous[k]==word[k] for k in ('paragraph','textStart','textEnd')) and 0<=word['start']-previous['end']<=2:
            previous['end']=word['end']
        else:accepted.append(word)
    return accepted

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
    phrases, paragraphs, sentences = reference_index if reference_index is not None else index_reference(book)
    words = []
    for segment in transcription.get('segments', []):
        # Silence/hallucinated or very low-likelihood speech has no destination.
        if segment.get('no_speech_prob', 0)>0.6 or segment.get('avg_logprob', 0)<-1: continue
        for word in segment.get('words', []):
            for token in tokens(word['word']): words.append({**word, 'token': token})
    anchors=[]; sentence_words=collections.defaultdict(list)
    for i in range(len(words)-6):
        group=words[i:i+7]
        found=phrases.get(tuple(w['token'] for w in group))
        if not found: continue
        start=group[0]['start'];end=group[-1]['end']
        if not all(math.isfinite(w.get('start', math.nan)) and math.isfinite(w.get('end', math.nan)) and w['end']>w['start'] for w in group): continue
        if start<0 or end>duration or not 1<end-start<15:continue
        if any(b['start']<a['end']-0.05 or b['start']-a['end']>2 for a,b in zip(group,group[1:])): continue
        if sum(w.get('probability',0) for w in group)/len(group)<0.7:continue
        key,offset=found
        anchors.append({'start':round(start,3),'end':round(end,3),'paragraph':key})
        for j,word in enumerate(group):
            sentence=next((s for s in sentences[key] if s['tokenStart']<=offset+j<s['tokenEnd']),None)
            if sentence and word.get('probability',0)>=.7:
                sentence_words[i+j].append({'start':round(word['start'],3),'end':round(word['end'],3),'paragraph':key,
                    'textStart':sentence['textStart'],'textEnd':sentence['textEnd']})
    spans=coalesce_anchors(anchors)
    used={s['paragraph'] for s in spans}
    sentences=sentence_spans(sentence_words)
    used.update(s['paragraph'] for s in sentences)
    return {'spans':spans,'sentenceSpans':sentences,'paragraphs':{key:paragraphs[key] for key in used},'recognizedWords':len(words),
            'matchedSeconds':round(sum(s['end']-s['start'] for s in spans),2)}
