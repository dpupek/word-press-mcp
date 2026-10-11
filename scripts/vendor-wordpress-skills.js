import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { PATHS } from '../src/paths.js';

// Read Git blobs, never execute upstream scripts or copy a working tree's edits.
const [source, commit] = process.argv.slice(2);
if (!source || !/^[a-f0-9]{40}$/.test(commit || '')) {
  throw new Error('Usage: node scripts/vendor-wordpress-skills.js <local-upstream-checkout> <full-commit-sha>');
}
const git = (...args) => execFileSync('git', ['-C', source, ...args]);
const tree = git('ls-tree', '-r', commit, '--', 'skills').toString('utf8').trim().split('\n');
const files = {};
const skills = new Set();
fs.mkdirSync(PATHS.skills, { recursive: true });
for (const line of tree) {
  const match = /^(100644|100755) blob ([a-f0-9]+)\t(skills\/[^\t]+)$/.exec(line);
  if (!match) throw new Error(`Unsupported upstream tree entry: ${line}`);
  const relative = match[3].slice('skills/'.length);
  if (relative.startsWith('wordpress-mcp-operations/')) throw new Error('Upstream skill collides with the project-owned operating skill.');
  if (!/^[a-z0-9-]+\//.test(relative) || relative.split('/').some((part) => part === '..' || part.includes('\\'))) {
    throw new Error(`Unsafe upstream path: ${relative}`);
  }
  const bytes = git('cat-file', 'blob', match[2]);
  const destination = path.join(PATHS.skills, relative);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.writeFileSync(destination, bytes);
  files[relative] = crypto.createHash('sha256').update(bytes).digest('hex');
  if (relative.endsWith('/SKILL.md')) skills.add(relative.split('/')[0]);
}
const license = git('show', `${commit}:LICENSE`);
fs.writeFileSync(path.join(PATHS.skills, 'LICENSE.wordpress'), license);
for (const name of skills) {
  fs.writeFileSync(path.join(PATHS.skills, name, 'LICENSE.wordpress'), license);
  const copying = path.join(PATHS.skills, 'COPYING.wordpress');
  if (fs.existsSync(copying)) fs.copyFileSync(copying, path.join(PATHS.skills, name, 'COPYING.wordpress'));
}
fs.writeFileSync(path.join(PATHS.skills, 'upstream.json'), JSON.stringify({
  repository: 'https://github.com/WordPress/agent-skills', commit,
  license: 'GPL-2.0-or-later', skills: [...skills].sort(), files
}, null, 2) + '\n');
console.log(JSON.stringify({ commit, skills: skills.size, files: Object.keys(files).length }));
