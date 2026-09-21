"""Fetch public MP3 header metadata only. Requires ffprobe on PATH.
Usage: python3 scripts/bible-audio/fetch-metadata.py /path/to/private-working-cache
Review upstream changes before replacing the committed hays-metadata.json.
"""
from pathlib import Path
import concurrent.futures, hashlib, json, re, subprocess, sys, urllib.request
root = Path(sys.argv[1]); root.mkdir(parents=True, exist_ok=True)
with urllib.request.urlopen('https://openbible.com/audio/hays/', timeout=30) as response:
    index = response.read(2_000_000).decode('utf-8')
files = re.findall(r'href="(BSB_[0-9]{2}_[A-Za-z0-9]+_[0-9]{3}_H\.mp3)"', index)
if len(set(files)) != 1189: raise ValueError('Publisher catalog changed; inspect before proceeding')
def fetch(name):
    output = root / (name + '.json')
    if output.exists(): return json.loads(output.read_text())
    url = 'https://openbible.com/audio/hays/' + name
    with urllib.request.urlopen(urllib.request.Request(url, headers={'Range': 'bytes=0-65535'}), timeout=30) as response:
        if response.status != 206: raise ValueError('Server did not honor bounded Range request')
        data = response.read(65536); total = int(response.headers['Content-Range'].split('/')[-1])
        modified = response.headers.get('Last-Modified')
    header = root / (name + '.header'); header.write_bytes(data)
    probe = json.loads(subprocess.check_output(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'json', str(header)]))
    row = {'file': name, 'url': url, 'bytes': total, 'duration': float(probe['format']['duration']), 'lastModified': modified,
           'headerBytes': len(data), 'headerSha256': hashlib.sha256(data).hexdigest()}
    if row['duration'] <= 0: raise ValueError('Invalid MP3 duration')
    output.write_text(json.dumps(row, indent=2) + '\n'); return row
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
    rows = list(pool.map(fetch, files))
(root / 'hays-metadata.json').write_text(json.dumps(sorted(rows, key=lambda row: row['file']), indent=2) + '\n')
print(f'{len(rows)} chapter metadata records written; no full recordings downloaded')
