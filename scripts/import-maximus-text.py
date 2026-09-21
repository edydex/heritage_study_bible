#!/usr/bin/env python3
"""Import Hefele/Clark section 303 from the pinned public-domain DjVu OCR.

Usage: python3 scripts/import-maximus-text.py /work/volume5.xml
Download URL and scan links are recorded in the generated source manifest.
Corrections are checked against the 1896 page images, not against Whisper.
"""
from pathlib import Path
import hashlib
import json
import re
import sys
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
SOURCE_HASH = 'd4be7f3be65dea42efec40fa899ca9ab9a41735289ff6ac9e26f3029f63fcec3'
ARCHIVE = 'https://archive.org/details/ahistoryofthecou05hefeuoft'
DOWNLOAD = 'https://archive.org/download/ahistoryofthecou05hefeuoft/ahistoryofthecou05hefeuoft_djvu.xml'

def extract(source):
    if hashlib.sha256(source).hexdigest() != SOURCE_HASH:
        raise ValueError('Source changed. Review the scan and corrections before importing.')
    pages = ET.fromstring(source).findall('.//OBJECT')
    corrections = json.loads((ROOT / 'scripts/audiobook-sources/maximus-corrections.json').read_text())
    chunks = []
    for page_no in range(92, 109):
        paragraphs = pages[page_no].findall('.//PARAGRAPH')
        selected = [2] if page_no == 92 else [1, 2, 3] if page_no == 93 else [1]
        raw = '\n\n'.join('\n'.join(' '.join(''.join(word.itertext()).strip()
            for word in line.findall('WORD')) for line in paragraphs[i].findall('LINE')) for i in selected)
        for old, new in corrections[str(page_no)]:
            if old not in raw:
                raise ValueError(f'Scan page {page_no}: missing correction anchor {old!r}')
            raw = raw.replace(old, new)
        chunks.append(raw)
    # Pages continue the same paragraph. Preserve printed paragraph divisions;
    # remove only line-wrap hyphenation (real compound words are retained above).
    text = re.sub(r'(?<=\w)-\n(?=\w)', '', '\n'.join(chunks))
    text = '\n\n'.join(re.sub(r'\s+', ' ', p).strip() for p in text.split('\n\n'))
    # Printed dialogue runs across fourteen pages as one paragraph. A line break
    # at each speaker makes phone reading/following possible without rewriting it.
    text = re.sub(r'\s+(?=(?:[MP]\.\s*"|Maximus replied :|Pyrrhus :))', '\n\n', text)
    text = text.replace(' Thus ended this disputation', '\n\nThus ended this disputation')
    text = re.sub(r'\s+([,;:?!])', r'\1', text)
    if not text.startswith('In the meantime the Abbot Maximus') or not text.endswith('united himself again with the Church.'):
        raise ValueError('Unexpected section boundaries')
    if any(marker in text for marker in ['Mansi,', 'SEC. 304.', 'HISTORY OF THE COUNCILS']):
        raise ValueError('Unexpected footnote, header or following section')
    return 'SECTION 303. Abbot Maximus and his Disputation with Pyrrhus\n\n' + text + '\n'

def main():
    source = Path(sys.argv[1]).read_bytes()
    text = extract(source)
    target = ROOT / 'public/data/books/maximus-disputation-clark.txt'
    target.write_text(text)
    manifest = {
        'bookId': 'maximus-cosmic-mystery',
        'title': 'Abbot Maximus and his Disputation with Pyrrhus',
        'author': 'Charles Joseph Hefele',
        'translator': 'William R. Clark',
        'edition': 'A History of the Councils of the Church, Volume V, 1896, section 303, pp. 73–89',
        'sourceUrl': ARCHIVE + '/page/n92/mode/1up',
        'sourceDownloadUrl': DOWNLOAD,
        'sourceSha256': SOURCE_HASH,
        'printedPages': [73, 89],
        'scanPages': [92, 108],
        'textPath': 'data/books/' + target.name,
        'textSha256': hashlib.sha256(text.encode()).hexdigest(),
        'rights': 'Public-domain 1896 edition; Internet Archive metadata: NOT_IN_COPYRIGHT.',
        'recordingSourceUrl': 'https://librivox.org/the-early-church-collection-volume-5-by-various/',
        'recordingId': 'lv-b61af91e3bbc5c0154f8cc06',
        'editorialChanges': [
            'Section 303 only; headers, running page numbers and scholarly footnotes omitted (available in source scan).',
            'OCR repaired against printed pages; Greek restored from scan, line-wrap hyphenation joined; historical wording retained.',
            'Paragraph breaks added at speaker changes and before closing narrative; no AI translation or transcript substituted for source text.'
        ]
    }
    (target.parent / 'maximus-disputation-source.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({'paragraphs': len(text.split('\n\n'))-1, 'textSha256': manifest['textSha256']}))

if __name__ == '__main__':
    main()
