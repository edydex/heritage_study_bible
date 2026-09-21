#!/usr/bin/env python3
"""Verify the built Android preview against its source, tests and previous signer."""
import argparse, hashlib, json, os, pathlib, re, shutil, struct, subprocess, zipfile
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
web_metadata = {}
with zipfile.ZipFile(apk) as archive:
    assert len(archive.namelist()) == len(set(archive.namelist())), 'Duplicate ZIP entries'
    catalog = (root/'src/data/audioCatalog.json').read_bytes()
    assert archive.read('assets/audio-catalog.json') == catalog, 'Native car catalog differs from the reader catalog'
    for path in sorted((root/'dist').rglob('*')):
        if not path.is_file(): continue
        assert not path.is_symlink()
        relative = path.relative_to(root/'dist').as_posix()
        data = path.read_bytes()
        # AAPT omits this hidden, website-only directory. Validate its app-link
        # identity against the APK signer instead of expecting it inside the APK.
        if relative == '.well-known/assetlinks.json':
            associations = json.loads(data)
            assert any(
                entry.get('target', {}).get('namespace') == 'android_app'
                and entry.get('target', {}).get('package_name') == current['applicationId']
                and 'delegate_permission/common.handle_all_urls' in entry.get('relation', [])
                and current['signerSha256'] in [fingerprint.replace(':', '').lower()
                    for fingerprint in entry.get('target', {}).get('sha256_cert_fingerprints', [])]
                for entry in associations
            ), 'Website app-link identity does not match the APK signer'
            web_metadata[relative] = hashlib.sha256(data).hexdigest()
            continue
        assert archive.read('assets/public/'+relative) == data, 'Bundled web asset mismatch: '+relative
        assets[relative] = hashlib.sha256(data).hexdigest()
assert len(assets) > 10
assert '.well-known/assetlinks.json' in web_metadata, 'Website app-link metadata is missing'
required = {
    'CommunityIntegrationTest': {'packagedCommunityScreensAndMemberLinkWorkOffline', 'secureStorageUsesNativeKeystoreAndSurvivesActivityRestart', 'encryptedValuesCannotBeSubstitutedForAnotherStorageKey', 'automaticSyncSettingSurvivesRestartAndBibleOpensOffline'},
    'AudioStorageIntegrationTest': {'deleteOfflineAudioThroughInternalStorage', 'interruptedTransferCanBeRemovedWithoutTouchingNotes'},
    'AudioPlaybackIntegrationTest': {'carLibraryAndSavedQueueLoadWithoutOpeningTheBible', 'legacyCarBrowserCanDiscoverTheLibraryWithoutOpeningTheReader', 'appAndCarSharePlaybackWhichContinuesAfterTheReaderCloses', 'offlineResolverRejectsTraversalAndUnrelatedAppFiles', 'ezekielVerseHighlightsFollowTheNativeClockAtRealBoundaries'},
}
expected = {name+'.'+test for name, tests in required.items() for test in tests}
found = set()
for report in (root/'android/app/build/outputs/androidTest-results/connected').rglob('*.xml'):
    for case in ET.parse(report).iter('testcase'):
        classname = case.get('classname', '').removeprefix('faith.heritage.app.')
        if classname not in required: continue
        assert not any(case.find(name) is not None for name in ['failure','error','skipped']), 'Android test did not pass'
        found.add(classname+'.'+case.get('name'))
assert found == expected, 'Missing native acceptance results: '+repr(expected-found)
screenshots = root / 'android/app/build/native-acceptance/screenshots'
for name in ['community-home', 'sermon-archive', 'member-sign-in', 'automatic-sync']:
    matches = list(screenshots.rglob(name+'.png'))
    assert len(matches) == 1, 'Missing or duplicate native screenshot: '+name
    data = matches[0].read_bytes()
    assert data[:8] == b'\x89PNG\r\n\x1a\n' and data[12:16] == b'IHDR', 'Invalid screenshot: '+name
    width, height = struct.unpack('>II', data[16:24])
    assert width >= 320 and height >= 640, 'Unexpected native screenshot size: '+name
latency_files = list(screenshots.rglob('ezekiel-highlight-latency.json'))
assert len(latency_files) == 1, 'Missing or duplicate native audio latency evidence'
latencies = json.loads(latency_files[0].read_text())
assert len(latencies) == 6 and {row['rate'] for row in latencies} == {.75, 1, 2}, 'Missing playback-speed coverage'
assert all(-110 < row['observedUpperLatencyMs'] < 300 for row in latencies), 'Native reading marker missed its boundary'
output.mkdir(parents=True, exist_ok=True)
name = f"heritage-study-bible-{current['versionName']}-debug.apk"
shutil.copyfile(apk, output/name)
record = {'schemaVersion':1, 'sourceRevision':source, **current, 'apk':{'name':name,'size':apk.stat().st_size,'sha256':sha(apk)}, 'previousRelease':{'versionName':old['versionName'],'versionCode':old['versionCode'],'sha256':sha(previous)}, 'webAssets':{'count':len(assets),'manifestSha256':hashlib.sha256(json.dumps(assets,sort_keys=True,separators=(',',':')).encode()).hexdigest()}, 'websiteOnlyMetadata':web_metadata, 'nativeAudioCatalogSha256':hashlib.sha256(catalog).hexdigest(), 'nativeTests':sorted(found)}
record['nativeAudioHighlightLatency'] = {'chapter':'Ezekiel 42', 'clock':'ExoPlayer service', 'audio':'generated PCM fixture', 'measurements':latencies}
metadata = output/'android-build.json'
metadata.write_text(json.dumps(record, indent=2)+'\n')
(output/'SHA256SUMS').write_text(f"{sha(output/name)}  {name}\n{sha(metadata)}  android-build.json\n")
print(json.dumps(record,indent=2))
