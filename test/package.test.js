import test from 'node:test';
import assert from 'node:assert/strict';
import pkg from '../package.json' with { type: 'json' };

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
    hasDocs: files.includes('docs/')
  };

  // Assert
  assert.equal(result.prepare, 'npm run build');
  assert.equal(result.build, 'npm run generate');
  assert.equal(result.smoke, 'node ./scripts/smoke-package-install.js');
  assert.equal(result.nodeEngine, '>=20');
  assert.equal(result.bin, './index.js');
  assert.equal(result.hasSrc, true);
  assert.equal(result.hasDocs, true);
});
