import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const root = 'android-release';
const metadata = JSON.parse(readFileSync(join(root, 'android-build.json'), 'utf8'));
const repository = process.env.GITHUB_REPOSITORY;
const revision = process.env.GITHUB_SHA;
if (!/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(repository || '') || !/^[a-f0-9]{40}$/.test(revision || '') || metadata.sourceRevision !== revision) throw Error('Invalid release source');
const version = metadata.versionName;
if (!/^\d+\.\d+\.\d+(?:-[a-z0-9.]+)?$/.test(version)) throw Error('Invalid release version');
const preview = version.includes('-');
if (process.env.GITHUB_REF !== 'refs/heads/main' && !preview) throw Error('Integration branches must use a labelled preview version');
const tag = `v${version}`;
const gh = args => execFileSync('gh', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
const api = (path, optional = false) => {
  try { return JSON.parse(gh(['api', `repos/${repository}/${path}`])); }
  catch (error) { if (optional && String(error.stderr).includes('HTTP 404')) return null; throw error; }
};
const ref = api(`git/ref/tags/${tag}`, true);
if (!ref) gh(['api', `repos/${repository}/git/refs`, '--method', 'POST', '-f', `ref=refs/tags/${tag}`, '-f', `sha=${revision}`]);
if (api(`commits/${tag}`).sha !== revision) throw Error('Release tag belongs to a different commit; refusing to replace it');
const files = [metadata.apk.name, 'android-build.json', 'SHA256SUMS'];
const expected = new Map(files.map(name => [name, {
  path: join(root, name),
  size: readFileSync(join(root, name)).length,
  digest: 'sha256:' + createHash('sha256').update(readFileSync(join(root, name))).digest('hex'),
}]));
const compare = release => {
  for (const asset of release.assets) {
    const wanted = expected.get(asset.name);
    if (wanted && (asset.size !== wanted.size || asset.digest !== wanted.digest)) throw Error(`Published asset differs: ${asset.name}; refusing to overwrite`);
  }
};
let release = api(`releases/tags/${tag}`, true);
if (release) {
  compare(release);
  if (release.prerelease !== preview) throw Error('Existing release channel differs');
  const missing = files.filter(name => !release.assets.some(asset => asset.name === name));
  if (missing.length) gh(['release', 'upload', tag, ...missing.map(name => expected.get(name).path), '--repo', repository]);
} else {
  const notesPath = join(root, 'release-notes.md');
  const notes = readFileSync(`docs/releases/android-${version}.md`, 'utf8');
  writeFileSync(notesPath, `${notes}\n\nBuilt from [${revision}](https://github.com/${repository}/commit/${revision}). The APK, SHA256SUMS and android-build.json describe the same verified build.\n`);
  gh(['release', 'create', tag, ...files.map(name => expected.get(name).path), '--repo', repository, '--verify-tag', '--title', `Heritage Community Android ${version}`, '--notes-file', notesPath, `--latest=${preview ? 'false' : 'true'}`, ...(preview ? ['--prerelease'] : [])]);
}
release = api(`releases/tags/${tag}`);
compare(release);
if (!files.every(name => release.assets.some(asset => asset.name === name))) throw Error('Release is incomplete');
if (api(`commits/${tag}`).sha !== revision) throw Error('Release tag changed during publication');
console.log(`Verified release: ${release.html_url}`);
