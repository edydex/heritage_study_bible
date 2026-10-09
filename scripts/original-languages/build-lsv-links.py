#!/usr/bin/env python3
"""Apply reviewed edition repairs and conservatively transfer shared BSB phrases to LSV.

Run after generateOriginalLanguages.py --all-nt-links. No synonym guesses or
untrusted USFM Strong tags are used. Every entry pins both displayed texts.
"""
import hashlib, json, re
from pathlib import Path
ROOT = Path(__file__).resolve().parents[2]
DATA = ROOT/'public/data/original-languages'
read = lambda path: json.loads(path.read_text())
sha = lambda path: hashlib.sha256(path.read_bytes()).hexdigest()
def write(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, separators=(',', ':'))+'\n')
def visible(text):
    text = re.sub(r'^\s*¶\s*', '', text)
    text = re.sub(r'\s+¶\s+', '\n', text)
    return re.sub(r'</?b>', '', re.sub(r'\s*\|\|\s*', '\n', text))
def words(text):
    return [(m.group().lower().replace('’', "'"), m.start(), m.end()) for m in re.finditer(r"[^\W_]+(?:['’][^\W_]+)*", text)]
def verses(corpus):
    return {b['name']: {f"{c['number']}:{v['number']}":visible(v['text']) for c in b['chapters'] for v in c['verses']} for b in corpus['books']}
bsb = verses(read(ROOT/'public/data/translations/BSB.json'))
lsv_path = ROOT/'public/data/translations/LSV.json'
lsv = verses(read(lsv_path))
greek = verses(read(DATA/'greek-nt-n1904.json'))
# Token indexes in the pinned Nestle 1904 witness, reviewed against the source
# morphology and published interlinear. English order differs from Greek order.
PHILIPPIANS_REVIEW = {
    'BSB': [(0,'I know',0),(2,'how to live humbly',0),(4,'and',0),(3,'I know',1),(5,'how to abound',0),
            (11,'I am accustomed',0),(6,'to',2),(7,'any',0),(8,'and',1),(10,'every situation',0),
            (13,'to being filled',0),(14,'and',2),(15,'being hungry',0),(17,'to having plenty',0),(18,'and',3),(19,'having need',0)],
    'LSV': [(0,'I have known',0),(1,'both',0),(2,'to be abased',0),(4,'and',0),(3,'I have known',1),(5,'to abound',0),
            (6,'in',0),(7,'everything',0),(8,'and',1),(9,'in',1),(10,'all things',0),(11,'I have been initiated',0),
            (12,'both',1),(13,'to be full',0),(14,'and',2),(15,'to be hungry',0),(16,'both',2),(17,'to abound',1),(18,'and',3),(19,'to be in want',0)],
}
REVIEW = {
    ('Philippians', '4:12'): {
        'reference': 'https://biblehub.com/interlinear/philippians/4-12.htm', 'groups': PHILIPPIANS_REVIEW,
    },
    ('Romans', '1:3'): {
        'reference': 'https://biblehub.com/interlinear/romans/1-3.htm',
        'groups': {'LSV': [(0,'concerning',0),(3,'His',0),(2,'Son',0),(4,'who',0),(5,'has come',0),
                           (6,'of',0),(7,'the seed',0),(8,'David',0),(9,'according to',0),(10,'the flesh',0)]},
    },
    ('Romans', '1:12'): {
        'reference': 'https://biblehub.com/interlinear/romans/1-12.htm',
        'groups': {'LSV': [(1,'and',0),(0,'that',0),(2,'is',0),(3,'that I may be comforted together',0),
                           (4,'among',0),(5,'you',0),(6,'through',0),(10,'faith',0),(8,'in',0),
                           (9,'one another',0),(12,'both',0),(11,'yours',0),(13,'and',1),(14,'mine',0)]},
    },
}
def reviewed(target, book, ref):
    source_text, target_text = greek[book][ref], (bsb if target=='BSB' else lsv)[book][ref]
    tokens = list(re.finditer(r'\S+', source_text))
    groups = []
    for token, phrase, occurrence in REVIEW[(book, ref)]['groups'][target]:
        candidates = list(re.finditer(r'(?<!\w)'+re.escape(phrase)+r'(?!\w)', target_text))
        match = candidates[occurrence]
        word = tokens[token]
        # Exclude punctuation, retaining the source's actual character offsets.
        end = word.end()
        while not source_text[end-1].isalpha(): end -= 1
        groups.append({'id': token, 'source': [word.start(), end], 'target': [match.start(), match.end()]})
    return {'sourceText':source_text,'targetText':target_text,'groups':groups,
            'review': {'method':'Explicit phrase and occurrence mapping; no USFM tag transfer.', 'reference':REVIEW[(book, ref)]['reference']}}
# BSB repair only modifies this verse, never weakens whole-verse edition checks.
path = DATA/'bsb-word-links/philippians.json'; item = read(path)
item['verses']['4:12'] = reviewed('BSB', 'Philippians', '4:12'); item['unavailable'].pop('4:12', None); write(path,item)
index_path = DATA/'bsb-word-links/index.json'; index = read(index_path)
index['books']['Philippians'].update(sha256=sha(path),linkedVerses=len(item['verses']),unlinkedVerses=len(item['unavailable']),groups=sum(len(v['groups']) for v in item['verses'].values()))
index_path.write_text(json.dumps(index, ensure_ascii=False, indent=2)+'\n')
STOP = set('a an the and or but for to of in on at by as with from into is are was were be been being am i me my we us our you your he him his she her it its they them their this that these those who whom which what when where how not no all any every both each have has had do does did so if than then also'.split())
folder = DATA/'lsv-word-links'; folder.mkdir(exist_ok=True)
manifest = {}; provenance = {'url':'https://ebible.org/find/details.php?id=englsv','license':'CC BY-SA 4.0','licenseUrl':'https://creativecommons.org/licenses/by-sa/4.0/','attribution':'LSV © 2020 Covenant Press; alignment adaptation for Heritage Study Bible.', 'targetSha256':sha(lsv_path),'greekSha256':index['provenance']['greekSha256'],'bsbMappingManifestSha256':sha(index_path)}
for name, meta in index['books'].items():
    original = read(DATA/'bsb-word-links'/meta['file']); aligned = {}; unavailable = {}
    for ref, source_text in greek[name].items():
        target_text = lsv[name].get(ref, '')
        assert all(ord(c) <= 0xffff for c in source_text + target_text), 'Review UTF-16 offsets before mapping non-BMP text.'
        entry = original['verses'].get(ref)
        groups = []
        if entry and entry['sourceText'] == source_text and entry['targetText']==bsb[name].get(ref):
            target_words = words(target_text); bsb_words = words(entry['targetText'])
            for group in entry['groups']:
                phrase = [w[0] for w in words(entry['targetText'][slice(*group['target'])])]
                if not phrase or not any(w not in STOP for w in phrase): continue
                # A repeated phrase cannot establish which occurrence it links.
                if sum([w[0] for w in bsb_words[i:i+len(phrase)]]==phrase for i in range(len(bsb_words)))!=1: continue
                starts = [i for i in range(len(target_words)) if [w[0] for w in target_words[i:i+len(phrase)]]==phrase]
                if len(starts)!=1: continue
                pos = starts[0]; target = [target_words[pos][1],target_words[pos+len(phrase)-1][2]]
                groups.append({'id':group['id'],'source':group['source'],'target':target})
            # Refuse overlap rather than choosing an arbitrary phrase assignment.
            groups = [g for g in groups if not any(h is not g and h['target'][0]<g['target'][1] and h['target'][1]>g['target'][0] for h in groups)]
        if groups: aligned[ref]={'sourceText':source_text,'targetText':target_text,'groups':groups}
        else: unavailable[ref]=original['unavailable'].get(ref,'no-unambiguous-shared-phrase')
    for (book, ref), review in REVIEW.items():
        if book == name and 'LSV' in review['groups']:
            aligned[ref]=reviewed('LSV', book, ref); unavailable.pop(ref,None)
    value={'schemaVersion':1,'book':name,'sourceId':'N1904','targetId':'LSV','provenance':provenance,
           'method':'Partial automatic links: identical whole-word BSB phrases occurring once in each displayed verse, transferred from pinned publisher Greek links. Function-only phrases, repeats, overlaps and Greek edition differences omitted. Philippians 4:12 and Romans 1:3, 1:12 use explicit reviewed mappings. No inferred synonyms or USFM Strong tags.',
           'verses':aligned,'unavailable':unavailable}
    path=folder/meta['file'];write(path,value)
    manifest[name]={'file':path.name,'sha256':sha(path),'linkedVerses':len(aligned),'unlinkedVerses':len(unavailable),'groups':sum(len(v['groups']) for v in aligned.values())}
write(folder/'index.json',{'schemaVersion':1,'sourceId':'N1904','targetId':'LSV','provenance':provenance,'books':manifest})
print(json.dumps({'linkedVerses':sum(b['linkedVerses'] for b in manifest.values()),'groups':sum(b['groups'] for b in manifest.values())}))
