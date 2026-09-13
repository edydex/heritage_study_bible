#!/usr/bin/env python3
"""Verify the built Android preview against its source, tests and previous signer."""
import argparse, hashlib, json, os, pathlib, re, shutil, subprocess, zipfile
import xml.etree.ElementTree as ET

root = pathlib.Path(__file__).resolve().parent.parent
p = argparse.ArgumentParser()
p.add_argument('--previous-apk', required=True)
p.add_argument('--output', default='android-release')
a = p.parse_args()
apk = root / 'android/app/build/outputs/apk/debug/app-debug.apk'
output = root / a.output
sdk = pathlib.Path(os.environ['ANDROID_HOME']) / 'build-tools/36.0.0'

def sha(path):
    with path.open('rb') as stream: return hashlib.file_digest(stream, 'sha256').hexdigest()
def identity(path):
    text = subprocess.check_output([str(sdk/'aapt'), 'dump', 'badging', str(path)], text=True)
    package = re.search(r"package: name='([^']+)' versionCode='(\d+)' versionName='([^']+)'", text)
    assert package, 'APK package metadata is missing'
    signature = subprocess.check_output([str(sdk/'apksigner'), 'verify', '--verbose', '--print-certs', str(path)], text=True)
    signers = re.findall(r'Signer #\d+ certificate SHA-256 digest: ([a-fA-F0-9]{64})', signature)
    assert len(signers) == 1, 'Expected one verified APK signer'
    return {'applicationId':package[1], 'versionCode':int(package[2]), 'versionName':package[3], 'signerSha256':signers[0].lower()}

current = identity(apk)
previous = pathlib.Path(a.previous_apk)
assert sha(previous) == '9107e7e64a35a5a0495caec08fa7bda1261679bfd9fbc7ab91145a02a4ba88cf', 'Previous release APK differs from the audited v1.1.32 asset'
old = identity(previous)
assert current['applicationId'] == old['applicationId'] == 'faith.heritage.app'
assert current['versionCode'] > old['versionCode'], 'Version code must allow an update'
assert current['signerSha256'] == old['signerSha256'], 'The APK cannot update the prior signed app'
assert re.fullmatch(r'\d+\.\d+\.\d+(?:-[a-z0-9.]+)?', current['versionName'])
source = subprocess.check_output(['git','rev-parse','HEAD'], cwd=root, text=True).strip()
assert source == os.environ['GITHUB_SHA'], 'Build source differs from workflow source'
assets = {}
with zipfile.ZipFile(apk) as archive:
    assert len(archive.namelist()) == len(set(archive.namelist())), 'Duplicate ZIP entries'
    for path in sorted((root/'dist').rglob('*')):
        if not path.is_file(): continue
        assert not path.is_symlink()
        relative = path.relative_to(root/'dist').as_posix()
        data = path.read_bytes()
        assert archive.read('assets/public/'+relative) == data, 'Bundled web asset mismatch: '+relative
        assets[relative] = hashlib.sha256(data).hexdigest()
assert len(assets) > 10
expected = {'packagedCommunityScreensAndMemberLinkWorkOffline', 'secureStorageUsesNativeKeystoreAndSurvivesActivityRestart', 'encryptedValuesCannotBeSubstitutedForAnotherStorageKey'}
found = set()
for report in (root/'android/app/build/outputs/androidTest-results/connected').rglob('*.xml'):
    for case in ET.parse(report).iter('testcase'):
        if case.get('classname') != 'faith.heritage.app.CommunityIntegrationTest': continue
        assert not any(case.find(name) is not None for name in ['failure','error','skipped']), 'Android test did not pass'
        found.add(case.get('name'))
assert found == expected, 'Missing native acceptance results: '+repr(expected-found)
output.mkdir(parents=True, exist_ok=True)
name = f"heritage-study-bible-{current['versionName']}-debug.apk"
shutil.copyfile(apk, output/name)
record = {'schemaVersion':1, 'sourceRevision':source, **current, 'apk':{'name':name,'size':apk.stat().st_size,'sha256':sha(apk)}, 'previousRelease':{'versionName':old['versionName'],'versionCode':old['versionCode'],'sha256':sha(previous)}, 'webAssets':{'count':len(assets),'manifestSha256':hashlib.sha256(json.dumps(assets,sort_keys=True,separators=(',',':')).encode()).hexdigest()}, 'nativeTests':sorted(found)}
metadata = output/'android-build.json'
metadata.write_text(json.dumps(record, indent=2)+'\n')
(output/'SHA256SUMS').write_text(f"{sha(output/name)}  {name}\n{sha(metadata)}  android-build.json\n")
print(json.dumps(record,indent=2))
