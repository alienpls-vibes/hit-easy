/**
 * The release people have on their phones right now, as files on disk.
 *
 * The upgrade journey serves it first, so the device gets that release's
 * service worker, cache and data - then swaps in this tree under the same URL.
 *
 * Which release: E2E_BASELINE_REF if set; otherwise the newest `v*` tag that
 * is not this tree's own version (on a release commit, the tag for this very
 * version already exists and the baseline is the one before it).
 *
 * Extracted with `git archive`, which reads the object database only: the
 * working tree, the index and the branch are untouched.
 */

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export function baselineRef(repo) {
  if (process.env.E2E_BASELINE_REF) return process.env.E2E_BASELINE_REF;
  const version = fs.readFileSync(path.join(repo, 'src/version.js'), 'utf8').match(/APP_VERSION\s*=\s*'([^']+)'/)[1];
  let tags = [];
  try {
    tags = execFileSync('git', ['tag', '--list', 'v*', '--sort=-v:refname'], { cwd: repo, encoding: 'utf8' })
      .split('\n').map((s) => s.trim()).filter(Boolean);
  } catch {
    throw new Error('git is needed to find the previous release (or set E2E_BASELINE_REF)');
  }
  const ref = tags.find((tag) => tag !== 'v' + version);
  if (!ref) {
    throw new Error('no release tag to upgrade from. In CI, check out with fetch-depth: 0 so the tags come along.');
  }
  return ref;
}

/** Extracts `ref` to a temp folder; returns { dir, ref, version, cleanup }. */
export function extractBaseline(repo, ref = baselineRef(repo)) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hit-easy-baseline-'));
  // Through a file, not a pipe: Windows' bsdtar does not take the archive on
  // stdin from Node. And by a RELATIVE path from inside the folder: GNU tar
  // (Git Bash's) reads "C:\..." as a remote host.
  const archive = dir + '.tar';
  execFileSync('git', ['archive', '--format=tar', '--output=' + archive, ref], { cwd: repo });
  try {
    execFileSync('tar', ['-x', '-f', path.join('..', path.basename(archive))], { cwd: dir });
  } finally {
    fs.rmSync(archive, { force: true });
  }
  const version = fs.readFileSync(path.join(dir, 'src/version.js'), 'utf8').match(/APP_VERSION\s*=\s*'([^']+)'/)[1];
  return {
    dir,
    ref,
    version,
    cleanup: () => fs.rmSync(dir, { recursive: true, force: true }),
  };
}
