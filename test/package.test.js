import test from 'node:test';
import assert from 'node:assert/strict';
import pkg from '../package.json' with { type: 'json' };
import fs from 'node:fs';
import path from 'node:path';
import { PATHS } from '../src/paths.js';

test('package metadata: ships skills and both native manifests using the same directory', () => {
  for (const entry of ['skills/', '.codex-plugin/', '.claude-plugin/', '.mcp.json', 'THIRD_PARTY_NOTICES.md']) {
    assert.ok(pkg.files.includes(entry), entry);
  }
  for (const manifest of ['.codex-plugin/plugin.json', '.claude-plugin/plugin.json']) {
    const data = JSON.parse(fs.readFileSync(path.join(PATHS.root, manifest)));
    assert.equal(data.skills, './skills/');
    assert.equal(data.mcpServers, './.mcp.json');
    assert.equal(data.version, pkg.version);
  }
  const mcp = JSON.parse(fs.readFileSync(path.join(PATHS.root, '.mcp.json')));
  assert.equal(mcp.mcpServers.wordpress.command, 'node');
  assert.equal(mcp.mcpServers.wordpress.env.WORDPRESS_MCP_SAFE_MODE, 'true');
  assert.equal(mcp.mcpServers.wordpress.env.WORDPRESS_MCP_DEBUG, 'false');
});

test('package metadata: git-based npx contract is explicit', () => {
  // Arrange
  const files = pkg.files || [];

  // Assert (initial)
  assert.equal(pkg.name, 'wordpress-mcp');

  // Act
  const result = {
    prepare: pkg.scripts?.prepare,
    build: pkg.scripts?.build,
    smoke: pkg.scripts?.['smoke:package'],
    nodeEngine: pkg.engines?.node,
    bin: pkg.bin?.['wordpress-mcp'],
    hasSrc: files.includes('src/'),
    hasSpec: files.includes('spec/'),
    hasDocs: files.includes('docs/')
  };

  // Assert
  assert.equal(result.prepare, 'npm run build');
  assert.equal(result.build, 'npm run generate');
  assert.equal(result.smoke, 'node ./scripts/smoke-package-install.js');
  assert.equal(result.nodeEngine, '>=20');
  assert.equal(result.bin, './index.js');
  assert.equal(result.hasSrc, true);
  assert.equal(result.hasSpec, true);
  assert.equal(result.hasDocs, true);
});
