#!/usr/bin/env python3
"""Import a pinned WLC/OSHB witness, preserving readings and explicit BSB refs."""
import argparse, collections, hashlib, json, subprocess, xml.etree.ElementTree as ET
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
REVISION = '3d15126fb1ef74867fc1434be1942e837932691f'
NS = '{http://www.bibletechnologies.net/2003/OSIS/namespace}'
CODES = 'Gen Exod Lev Num Deut Josh Judg Ruth 1Sam 2Sam 1Kgs 2Kgs 1Chr 2Chr Ezra Neh Esth Job Ps Prov Eccl Song Isa Jer Lam Ezek Dan Hos Joel Amos Obad Jonah Mic Nah Hab Zeph Hag Zech Mal'.split()
sha = lambda data: hashlib.sha256(data).hexdigest()

def source_units(verse):
    """Only direct written words; qere is a separate reading, never duplicated."""
    units = []
    for child in verse:
        tag = child.tag.removeprefix(NS)
        if tag == 'w':
            units.append({'text': (child.text or '').replace('/', ''), 'id': child.get('id'), 'language': 'arc' if (child.get('morph') or '').startswith('A') else 'he', 'variants': []})
        elif tag == 'seg' and units:
            # Maqqef/punctuation stays with its preceding word. Paragraph letters
            # are structure marks, not words to append to the Scripture text.
            if child.get('type') in ('x-maqqef', 'x-sof-pasuq', 'x-paseq', 'x-reversednun'):
                units[-1]['text'] += child.text or ''
        elif tag == 'note' and child.get('type') == 'variant' and units:
            for reading in child.findall(f'{NS}rdg'):
                if reading.get('type') == 'x-qere':
                    text = ' '.join((w.text or '').replace('/', '') for w in reading.findall(f'{NS}w'))
                    if text: units[-1]['variants'].append({'written': units[-1]['text'], 'reading': text})
    if not units: raise ValueError('Empty source verse')
    return units

def render(parts):
    units = [unit for _, part in parts for unit in part]
    text = ''
    for unit in units:
        if text and not text.endswith('־'): text += ' '
        text += unit['text']
    return {'text': text, 'direction': 'rtl', 'languages': sorted({u['language'] for u in units}),
            'sourceRefs': [ref for ref, _ in parts], 'variants': [v for u in units for v in u['variants']]}

def generate(source):
    if subprocess.check_output(['git', '-C', str(source), 'rev-parse', 'HEAD'], text=True).strip() != REVISION:
        raise ValueError('OSHB revision differs from the reviewed source')
    # Dirty source inputs are rejected even if HEAD remains the pinned revision.
    paths = [f'wlc/{code}.xml' for code in CODES] + ['wlc/VerseMap.xml', 'LICENSE.md']
    for path in paths:
        committed = subprocess.check_output(['git', '-C', str(source), 'show', f'{REVISION}:{path}'])
        if committed != (source/path).read_bytes(): raise ValueError(f'Modified source: {path}')
    rows = ET.parse(source/'wlc/VerseMap.xml').findall('.//{http://www.APTBibleTools.com/namespace}verse')
    full = {row.get('wlc'): row.get('kjv') for row in rows if row.get('type') == 'full'}
    sources, order = {}, {}
    for code in CODES:
        for verse in ET.parse(source/f'wlc/{code}.xml').findall(f'.//{NS}verse'):
            ref = verse.get('osisID')
            if not ref: continue
            if ref in sources: raise ValueError('Duplicate source verse')
            order[ref] = len(order); sources[ref] = source_units(verse)
    mapped = collections.defaultdict(list)
    for ref, units in sources.items():
        # BSB 1Kgs18:33–34,20:2–3,22:21–22 keep the WLC boundaries, unlike KJV.
        if ref == '1Kgs.22.44': target = '1Kgs.22.43'
        else: target = full.get(ref, ref)
        if ref == 'Isa.63.19':
            # Boundary before לוּא, including עֲלֵיהֶם in 63:19 (nine direct words).
            if units[9]['id'] != '23sJ1' or units[9]['text'] != 'לוּא־': raise ValueError('Isaiah boundary changed')
            mapped['Isa.63.19'].append((ref+'a', units[:9])); mapped['Isa.64.1'].append((ref+'b', units[9:])); continue
        if ref == 'Ps.13.6':
            if not units[6]['text'].startswith('אָשִׁ֥ירָה'): raise ValueError('Psalm boundary changed')
            mapped['Ps.13.5'].append((ref+'a', units[:6])); mapped['Ps.13.6'].append((ref+'b', units[6:])); continue
        mapped[target].append((ref, units))
    superscriptions = collections.defaultdict(list)
    for target, parts in list(mapped.items()):
        if target.startswith('Ps.') and len(parts) > 1:
            parts.sort(key=lambda part: order[part[0]])
            # Numbered Hebrew title verse(s) precede the first body verse. Keep
            # them as a separate source heading, not English verse 1 content.
            superscriptions['.'.join(target.split('.')[:2])] = parts[:-1]
            mapped[target] = parts[-1:]
    allowed_merges = {'1Sam.20.42', '1Kgs.22.43', '1Chr.12.4', 'Num.26.1'}
    for ref, parts in mapped.items():
        if len(parts)>1 and ref not in allowed_merges: raise ValueError('Unreviewed merge '+ref)
        parts.sort(key=lambda part: order.get(part[0], 0))
    index = json.loads((ROOT/'public/data/translations/BSB/index.json').read_text())['books'][:39]
    expected = set(); missing = []; records = 0; languages = collections.Counter(); out = ROOT/'public/data/original-languages/hebrew'; out.mkdir(exist_ok=True)
    source_metadata = {'id': 'WLC-OSHB', 'name': 'Westminster Leningrad Codex · Open Scriptures Hebrew Bible', 'edition': 'WLC 4.20 as maintained by OSHB', 'revision': REVISION,
      'url': f'https://github.com/openscriptures/morphhb/tree/{REVISION}/wlc', 'license': 'WLC text: public domain; OSHB metadata: CC BY 4.0', 'licenseUrl': 'https://creativecommons.org/licenses/by/4.0/',
      'attribution': 'Original work of the Open Scriptures Hebrew Bible available at https://github.com/openscriptures/morphhb',
      'adaptation': 'Direct written readings, separate qere notes, morphology-based language labels, and explicit BSB reference mapping. No Unicode normalization.',
      'files': {p: sha((source/p).read_bytes()) for p in paths}}
    output_index = {'schemaVersion': 1, 'source': source_metadata, 'books': [], 'missing': missing}
    for code, meta in zip(CODES,index):
        bsb = json.loads((ROOT/'public/data/translations/BSB'/meta['file']).read_text()); chapters=[]
        for chapter in bsb['chapters']:
            verses=[]
            for verse in chapter['verses']:
                ref=f"{code}.{chapter['number']}.{verse['number']}"; expected.add(ref)
                if ref not in mapped:
                    if ref!='Neh.7.68': raise ValueError('Unexpected missing reference '+ref)
                    missing.append(ref); continue
                row={'number':verse['number'], **render(mapped[ref])}
                languages.update(row['languages']); verses.append(row); records+=1
            result={'number':chapter['number'],'verses':verses}
            header=superscriptions.get(f"{code}.{chapter['number']}")
            if header: result['superscription']=render(header)
            chapters.append(result)
        book={'name':bsb['name'],'sourceId':'WLC-OSHB','chapters':chapters}
        payload={'schemaVersion':1,'translation':'ORIGINAL','sourceId':'WLC-OSHB','books':[book]}
        (out/meta['file']).write_text(json.dumps(payload,ensure_ascii=False,separators=(',',':'))+'\n')
        output_index['books'].append({'name':bsb['name'],'file':meta['file'],'chapters':len(chapters),'sha256':sha((out/meta['file']).read_bytes())})
    if set(mapped)-expected: raise ValueError('Unexpected extra references: '+str(set(mapped)-expected))
    # Every written source word appears once (including separately shown titles).
    used=[unit['id'] for parts in list(mapped.values())+list(superscriptions.values()) for _, units in parts for unit in units]
    original=[unit['id'] for units in sources.values() for unit in units]
    if collections.Counter(used)!=collections.Counter(original): raise ValueError('Source words lost or duplicated')
    output_index['counts']={'sourceVerses':len(sources),'displayedVerses':records,'superscriptionChapters':len(superscriptions),'languages':dict(languages),'sourceWords':len(original)}
    (out/'index.json').write_text(json.dumps(output_index,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps(output_index['counts']), 'missing', missing)

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--oshb',required=True,type=Path);generate(parser.parse_args().oshb)
