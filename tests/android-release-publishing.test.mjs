import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { publishAndroidRelease, assertDiscoverableVersion } from '../scripts/publish-android-release.mjs';

const hash = data => createHash('sha256').update(data).digest('hex');
const revision = 'a'.repeat(40);
function fixture(t, options = {}) {
  const root = mkdtempSync(join(tmpdir(), 'heritage-release-test-'));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const version = options.version || '1.1.34-preview.1';
  const name = `heritage-study-bible-${version}-debug.apk`;
  const apk = Buffer.from('test-only APK bytes');
  const metadata = {
    sourceRevision: revision, versionName: version, versionCode: options.versionCode || 37,
    applicationId: 'faith.heritage.app', signerSha256: 'b'.repeat(64),
    apk: { name, size: apk.length, sha256: hash(apk) },
    previousRelease: { versionName: '1.1.32', versionCode: 34 },
  };
  writeFileSync(join(root, name), apk);
  writeFileSync(join(root, 'android-build.json'), JSON.stringify(metadata)+'\n');
  writeFileSync(join(root, 'SHA256SUMS'), `${hash(apk)}  ${name}\n${hash(readFileSync(join(root, 'android-build.json')))}  android-build.json\n`);
  writeFileSync(join(root, `android-${version}.md`), 'Development preview. Physical acceptance remains.\n');
  const files = [name, 'android-build.json', 'SHA256SUMS'];
  const assets = files.map((file, i) => ({ id: i+100, name: file, size: readFileSync(join(root,file)).length, digest: 'sha256:'+hash(readFileSync(join(root,file))), state: 'uploaded', browser_download_url: `https://github.com/edydex/heritage_study_bible/releases/download/v${version}/${file}` }));
  const state = {
    calls: [], latest: { tag_name: 'v1.1.32', assets: [], draft: false, prerelease: false },
    release: null, tagRevision: revision, latestReads: 0, ...options.state,
  };
  function gh(args) {
    state.calls.push(args);
    if (args[0] === 'api') {
      const path = args[1].replace('repos/edydex/heritage_study_bible/', '');
      if (path === 'releases/latest') {
        state.latestReads++;
        if (options.onLatest) options.onLatest(state);
        return JSON.stringify(state.latest);
      }
      if (path.startsWith('releases/assets/')) return state.previousData;
      if (path.startsWith('git/ref/')) return JSON.stringify({object:{sha:state.tagRevision}});
      if (path.startsWith('commits/')) {
        if (args.at(-2) !== '--jq' || args.at(-1) !== '.sha') {
          throw Object.assign(Error('Large merge diff exceeds stdout buffer'), {code:'ENOBUFS'});
        }
        return state.tagRevision + '\n';
      }
      if (path.startsWith('releases?')) return state.release ? JSON.stringify(state.release) : '';
      if (path.startsWith('releases/tags/')) {
        if (!state.release || state.release.draft) throw Object.assign(Error('not found'), {stderr:'HTTP 404'});
        return JSON.stringify(state.release);
      }
      throw Error('Unexpected API call: '+path);
    }
    if (args[1] === 'create') {
      assert.ok(args.includes('--draft'), 'Upload privately before promoting');
      assert.ok(args.includes('--latest=false'));
      state.release = {tag_name:`v${version}`, draft:true, prerelease:false, assets:structuredClone(assets), html_url:`https://github.com/edydex/heritage_study_bible/releases/tag/v${version}`};
      return state.release.html_url;
    }
    if (args[1] === 'upload') {
      for (const asset of assets) if (args.includes(join(root,asset.name))) state.release.assets.push(asset);
      return '';
    }
    if (args[1] === 'edit') {
      assert.ok(args.includes('--latest=true'));
      assert.ok(args.includes('--prerelease=false'));
      assert.ok(args.includes('--draft=false'));
      assert.equal(state.release.assets.length,3);
      state.release.draft=false; state.release.prerelease=false;
      if (!options.ignorePromotion) state.latest=state.release;
      return '';
    }
    throw Error('Unexpected command: '+args.join(' '));
  }
  return {root,metadata,assets,state,run:()=>publishAndroidRelease({root,notesDirectory:root,repository:'edydex/heritage_study_bible',revision,refName:'refs/heads/codex/unified-live-service',gh})};
}
function noMutations(state) { assert.equal(state.calls.filter(c=>c[0]==='release').length,0); }

test('a labelled preview is uploaded completely, promoted to normal Latest, and discoverable by the installed checker', async t => {
  const f=fixture(t), release=f.run();
  assert.equal(release.prerelease,false);
  assert.equal(release.draft,false);
  assert.equal(release.tag_name,'v1.1.34-preview.1');
  assert.ok(f.state.latestReads>=3);
  const source=readFileSync(new URL('../src/services/appUpdates.js',import.meta.url),'utf8').replace("import { getNativeAppInfo, openNativeExternalUrl } from './androidControls'", `const getNativeAppInfo=async()=>({versionName:'1.1.33-preview.2'}); const openNativeExternalUrl=async()=>false; const fetch=async()=>({ok:true,status:200,json:async()=>(${JSON.stringify(release)})});`);
  const updater=await import('data:text/javascript,'+encodeURIComponent(source));
  const result=await updater.checkForApkUpdate();
  assert.equal(result.status,'update-available');
  assert.equal(result.assetName,f.metadata.apk.name);
});

test('retry of the promoted Preview 2 keeps its exact assets', t => {
  const f=fixture(t,{version:'1.1.33-preview.2',versionCode:36});
  f.state.release={tag_name:'v1.1.33-preview.2',draft:false,prerelease:false,assets:f.assets,html_url:'https://example.test/release'};
  f.state.latest=f.state.release;
  f.run();
  assert.equal(f.state.calls.some(c=>c[0]==='release'&&['create','upload'].includes(c[1])),false);
});

test('an existing prerelease with identical bytes can join the update feed', t => {
  const f=fixture(t);
  f.state.release={tag_name:'v1.1.34-preview.1',draft:false,prerelease:true,assets:f.assets,html_url:'https://example.test/release'};
  assert.equal(f.run().prerelease,false);
});

test('preview-only version bump is rejected before release mutations', t => {
  const f=fixture(t,{version:'1.1.33-preview.3'});
  f.state.latest={tag_name:'v1.1.33-preview.2',assets:[]};
  assert.throws(f.run,/ignore preview suffixes/); noMutations(f.state);
});

test('old build cannot roll the update feed backwards', t => {
  const f=fixture(t);
  f.state.latest={tag_name:'v1.1.35-preview.1',assets:[]};
  assert.throws(f.run,/downgrade/); noMutations(f.state);
});

for (const [version, latest] of [['1.1.33','v1.1.33-preview.2'],['1.1.33-preview.10','v1.1.33-preview.2']]) {
  test(`${version} cannot masquerade as an update from ${latest}`,()=>assert.throws(()=>assertDiscoverableVersion(version,{tag_name:latest}),/Increase the numeric/));
}

test('numeric comparison handles patch 10 after patch 9',()=>assert.doesNotThrow(()=>assertDiscoverableVersion('1.1.10-preview.1',{tag_name:'v1.1.9'})));

function addPrevious(f, overrides={}) {
  const previous={...f.metadata,versionName:'1.1.33-preview.2',versionCode:36,...overrides};
  f.state.previousData=JSON.stringify(previous)+'\n';
  f.state.latest={tag_name:'v1.1.33-preview.2',assets:[{name:'android-build.json',id:77,digest:'sha256:'+hash(f.state.previousData)}]};
}

test('numeric bump must also install over the latest Android versionCode',t=>{
  const f=fixture(t,{versionCode:36}); addPrevious(f);
  assert.throws(f.run,/versionCode must exceed/); noMutations(f.state);
});

test('latest package signer is checked, not only the older baseline signer',t=>{
  const f=fixture(t); addPrevious(f,{signerSha256:'c'.repeat(64)});
  assert.throws(f.run,/identity\/signer/); noMutations(f.state);
});

test('latest metadata digest must match before considering the upgrade',t=>{
  const f=fixture(t); addPrevious(f); f.state.previousData+=' ';
  assert.throws(f.run,/metadata digest differs/); noMutations(f.state);
});

test('compatible numeric version and native versionCode pass',t=>{
  const f=fixture(t); addPrevious(f); assert.equal(f.run().tag_name,'v1.1.34-preview.1');
});

test('a changed published APK is never overwritten',t=>{
  const f=fixture(t);
  f.state.release={tag_name:'v1.1.34-preview.1',assets:[{...f.assets[0],digest:'sha256:'+ '0'.repeat(64)}]};
  assert.throws(f.run,/refusing to overwrite/); noMutations(f.state);
});

test('local bytes must still match verified build metadata',t=>{
  const f=fixture(t); writeFileSync(join(f.root,f.metadata.apk.name),'different APK');
  assert.throws(f.run,/differs from verified build/); assert.equal(f.state.calls.length,0);
});

test('tag belonging to a different build is preserved',t=>{
  const f=fixture(t); f.state.tagRevision='d'.repeat(40);
  assert.throws(f.run,/different commit/); noMutations(f.state);
});

test('missing assets are uploaded before promoting an existing draft',t=>{
  const f=fixture(t);
  f.state.release={tag_name:'v1.1.34-preview.1',draft:true,assets:[f.assets[0]],html_url:'https://example.test/release'};
  const result=f.run();
  assert.equal(result.assets.length,3); assert.equal(result.draft,false);
});

test('an unready asset cannot reach the installed checker',t=>{
  const f=fixture(t);
  f.state.release={tag_name:'v1.1.34-preview.1',draft:true,assets:f.assets.map(a=>({...a,state:'starter'}))};
  assert.throws(f.run,/incomplete/);
  assert.equal(f.state.calls.some(c=>c[0]==='release'&&c[1]==='edit'),false);
});

test('a newer publisher winning before promotion leaves this draft unpromoted',t=>{
  const f=fixture(t,{onLatest:state=>{if(state.latestReads===2)state.latest={tag_name:'v1.1.35-preview.1',assets:[]};}});
  assert.throws(f.run,/downgrade/);
  assert.equal(f.state.release.draft,true);
  assert.equal(f.state.calls.some(c=>c[0]==='release'&&c[1]==='edit'),false);
});

test('publication is not reported successful unless the actual Latest endpoint changed',t=>{
  const f=fixture(t,{ignorePromotion:true}); assert.throws(f.run,/not discoverable/);
});

test('large merge commits resolve to a bounded SHA before, during and after publication', t => {
  const f=fixture(t); f.run();
  const reads=f.state.calls.filter(c=>c[0]==='api' && c[1].includes('/commits/'));
  assert.equal(reads.length,3);
  for (const args of reads) assert.deepEqual(args.slice(-2),['--jq','.sha']);
});
