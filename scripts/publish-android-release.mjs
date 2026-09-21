import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const digest = data => 'sha256:' + createHash('sha256').update(data).digest('hex');
const numericVersion = version => {
  const match = /^v?(\d+)\.(\d+)\.(\d+)(?:-[a-z0-9.]+)?$/.exec(version || '');
  if (!match) throw Error('Invalid Android update version');
  const parts = match.slice(1).map(Number);
  if (!parts.every(Number.isSafeInteger)) throw Error('Invalid Android update version');
  return parts;
};

// Installed readers ignore preview suffixes. Keep updates discoverable without
// requiring an updater update first.
export function assertDiscoverableVersion(version, latest) {
  const next = numericVersion(version);
  if (!latest) return;
  const previous = numericVersion(latest.tag_name);
  if (`v${version}` === latest.tag_name) return; // Identical, verified release retry.
  const different = next.findIndex((part, index) => part !== previous[index]);
  if (different === -1 || next[different] < previous[different]) {
    throw Error(`Increase the numeric Android version beyond ${latest.tag_name}; installed update checkers ignore preview suffixes. Refusing an invisible update or downgrade.`);
  }
}

export function publishAndroidRelease({
  root = 'android-release', notesDirectory = 'docs/releases',
  repository = process.env.GITHUB_REPOSITORY,
  revision = process.env.GITHUB_SHA, refName = process.env.GITHUB_REF,
  gh = args => execFileSync('gh', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }),
} = {}) {
  const metadata = JSON.parse(readFileSync(join(root, 'android-build.json'), 'utf8'));
  if (!/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(repository || '') || !/^[a-f0-9]{40}$/.test(revision || '') || metadata.sourceRevision !== revision) throw Error('Invalid release source');
  const version = metadata.versionName;
  if (!/^\d+\.\d+\.\d+(?:-[a-z0-9.]+)?$/.test(version || '')) throw Error('Invalid release version');
  if (refName !== 'refs/heads/main' && !version.includes('-')) throw Error('Integration branches must use a labelled preview version');
  if (!Number.isSafeInteger(metadata.versionCode) || metadata.versionCode < 1 || metadata.applicationId !== 'faith.heritage.app') throw Error('Invalid Android package identity');
  const tag = `v${version}`;
  if (metadata.apk?.name !== `heritage-study-bible-${version}-debug.apk` || basename(metadata.apk.name) !== metadata.apk.name) throw Error('Invalid APK asset name');
  const files = [metadata.apk.name, 'android-build.json', 'SHA256SUMS'];
  const expected = new Map(files.map(name => {
    const data = readFileSync(join(root, name));
    return [name, { path: join(root, name), size: data.length, digest: digest(data) }];
  }));
  const apk = expected.get(metadata.apk.name);
  if (apk.size !== metadata.apk.size || apk.digest !== `sha256:${metadata.apk.sha256}`) throw Error('APK differs from verified build metadata');
  const checksumText = `${metadata.apk.sha256}  ${metadata.apk.name}\n${expected.get('android-build.json').digest.slice(7)}  android-build.json\n`;
  if (readFileSync(join(root, 'SHA256SUMS'), 'utf8') !== checksumText) throw Error('Release checksums differ from verified files');
  const api = (path, optional = false) => {
    try { return JSON.parse(gh(['api', `repos/${repository}/${path}`])); }
    catch (error) { if (optional && String(error.stderr).includes('HTTP 404')) return null; throw error; }
  };
  // Resolve tags through GitHub (including annotated tags), but do not pipe
  // the entire commit diff into execFileSync's bounded stdout buffer.
  const tagRevision = () => gh(['api', `repos/${repository}/commits/${tag}`, '--jq', '.sha']).trim();
  const checkUpgrade = () => {
    const latest = api('releases/latest', true);
    assertDiscoverableVersion(version, latest);
    if (!latest || latest.tag_name === tag) return;
    const previousAsset = latest.assets.find(asset => asset.name === 'android-build.json');
    let previous = metadata.previousRelease;
    if (previousAsset) {
      if (!Number.isSafeInteger(previousAsset.id) || !/^sha256:[a-f0-9]{64}$/.test(previousAsset.digest || '')) throw Error('Latest build metadata cannot be verified');
      const data = gh(['api', `repos/${repository}/releases/assets/${previousAsset.id}`, '-H', 'Accept: application/octet-stream']);
      if (digest(data) !== previousAsset.digest) throw Error('Latest build metadata digest differs');
      previous = JSON.parse(data);
      if (previous.applicationId !== metadata.applicationId || previous.signerSha256 !== metadata.signerSha256) throw Error('APK cannot update the latest package identity/signer');
    }
    if (!previous || `v${previous.versionName}` !== latest.tag_name || !Number.isSafeInteger(previous.versionCode) || metadata.versionCode <= previous.versionCode) throw Error('Android versionCode must exceed the latest published APK');
  };
  const compare = release => {
    for (const asset of release.assets) {
      const wanted = expected.get(asset.name);
      if (wanted && (asset.size !== wanted.size || asset.digest !== wanted.digest)) throw Error(`Published asset differs: ${asset.name}; refusing to overwrite`);
    }
  };
  const findRelease = () => {
    const published = api(`releases/tags/${tag}`, true);
    if (published) return published;
    // GitHub's tag endpoint documents published releases only. Authenticated
    // listing also includes drafts, so interrupted uploads remain resumable.
    const draft = gh(['api', `repos/${repository}/releases?per_page=100`, '--paginate', '--jq', `.[] | select(.tag_name == "${tag}")`]).trim();
    return draft ? JSON.parse(draft) : null;
  };
  checkUpgrade();
  let release = findRelease();
  if (release) compare(release);
  const notes = release ? null : readFileSync(join(notesDirectory, `android-${version}.md`), 'utf8');
  const ref = api(`git/ref/tags/${tag}`, true);
  if (!ref) gh(['api', `repos/${repository}/git/refs`, '--method', 'POST', '-f', `ref=refs/tags/${tag}`, '-f', `sha=${revision}`]);
  if (tagRevision() !== revision) throw Error('Release tag belongs to a different commit; refusing to replace it');
  if (release) {
    const missing = files.filter(name => !release.assets.some(asset => asset.name === name));
    if (missing.length) gh(['release', 'upload', tag, ...missing.map(name => expected.get(name).path), '--repo', repository]);
  } else {
    const notesPath = join(root, 'release-notes.md');
    writeFileSync(notesPath, `${notes}\n\nAvailable through Heritage's Android update checker. A preview label describes development status; published APKs use the normal GitHub update feed.\n\nBuilt from [${revision}](https://github.com/${repository}/commit/${revision}). The APK, SHA256SUMS and android-build.json describe the same verified build.\n`);
    // Do not expose a new release through /latest before every asset is ready.
    gh(['release', 'create', tag, ...files.map(name => expected.get(name).path), '--repo', repository, '--verify-tag', '--title', `Heritage Community Android ${version}`, '--notes-file', notesPath, '--draft', '--latest=false']);
  }
  release = findRelease();
  if (!release) throw Error('Created release cannot be found');
  compare(release);
  if (!files.every(name => release.assets.some(asset => asset.name === name && asset.state === 'uploaded' && asset.browser_download_url))) throw Error('Release is incomplete');
  if (tagRevision() !== revision) throw Error('Release tag changed during publication');
  checkUpgrade(); // A retry or concurrent publisher must not roll /latest back.
  gh(['release', 'edit', tag, '--repo', repository, '--draft=false', '--prerelease=false', '--latest=true']);
  release = api('releases/latest');
  if (release.tag_name !== tag || release.draft || release.prerelease) throw Error('Published APK is not discoverable through the installed Android update checker');
  compare(release);
  if (!files.every(name => release.assets.some(asset => asset.name === name && asset.state === 'uploaded' && asset.browser_download_url))) throw Error('Latest release is incomplete');
  if (tagRevision() !== revision) throw Error('Release tag changed after publication');
  console.log(`Verified Android update feed: ${release.html_url}`);
  return release;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) publishAndroidRelease();
