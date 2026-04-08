import test from 'node:test';
import assert from 'node:assert/strict';
import { getConfig } from '../src/config.js';

test('getConfig: defaults route capture to https and insecure TLS to false', () => {
  // Arrange
  const previousRouteCaptureUrl = process.env.WORDPRESS_MCP_ROUTE_CAPTURE_URL;
  const previousAllowInsecureTls = process.env.WORDPRESS_MCP_ALLOW_INSECURE_TLS;
  delete process.env.WORDPRESS_MCP_ROUTE_CAPTURE_URL;
  delete process.env.WORDPRESS_MCP_ALLOW_INSECURE_TLS;

  try {
    // Assert (initial)
    assert.equal(process.env.WORDPRESS_MCP_ROUTE_CAPTURE_URL, undefined);
    assert.equal(process.env.WORDPRESS_MCP_ALLOW_INSECURE_TLS, undefined);

    // Act
    const config = getConfig();

    // Assert
    assert.equal(config.routeCaptureUrl, 'https://test.nexportsolutions.com/wp-json');
    assert.equal(config.allowInsecureTls, false);
  } finally {
    if (previousRouteCaptureUrl === undefined) {
      delete process.env.WORDPRESS_MCP_ROUTE_CAPTURE_URL;
    } else {
      process.env.WORDPRESS_MCP_ROUTE_CAPTURE_URL = previousRouteCaptureUrl;
    }

    if (previousAllowInsecureTls === undefined) {
      delete process.env.WORDPRESS_MCP_ALLOW_INSECURE_TLS;
    } else {
      process.env.WORDPRESS_MCP_ALLOW_INSECURE_TLS = previousAllowInsecureTls;
    }
  }
});

test('getConfig: enables insecure TLS when the env flag is set', () => {
  // Arrange
  const previousAllowInsecureTls = process.env.WORDPRESS_MCP_ALLOW_INSECURE_TLS;
  process.env.WORDPRESS_MCP_ALLOW_INSECURE_TLS = 'true';

  try {
    // Assert (initial)
    assert.equal(process.env.WORDPRESS_MCP_ALLOW_INSECURE_TLS, 'true');

    // Act
    const config = getConfig();

    // Assert
    assert.equal(config.allowInsecureTls, true);
  } finally {
    if (previousAllowInsecureTls === undefined) {
      delete process.env.WORDPRESS_MCP_ALLOW_INSECURE_TLS;
    } else {
      process.env.WORDPRESS_MCP_ALLOW_INSECURE_TLS = previousAllowInsecureTls;
    }
  }
});
