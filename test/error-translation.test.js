import test from 'node:test';
import assert from 'node:assert/strict';
import { translateWpError } from '../src/error-translation.js';

test('translateWpError: maps authentication failures to actionable guidance', () => {
  // Arrange
  const error = {
    kind: 'auth_error',
    statusCode: 401,
    responseBody: { code: 'rest_not_logged_in', message: 'You are not currently logged in.' },
    requestUrl: 'https://example.com/wp-json/wp/v2/posts'
  };

  // Assert (initial)
  assert.equal(error.statusCode, 401);

  // Act
  const result = translateWpError(error, { route: '/wp/v2/posts', method: 'POST' });

  // Assert
  assert.equal(result.kind, 'auth_error');
  assert.match(result.actionable, /authenticated WordPress REST session/i);
});

test('translateWpError: maps permission failures separately from auth failures', () => {
  // Arrange
  const error = {
    kind: 'permission_error',
    statusCode: 403,
    responseBody: { code: 'rest_forbidden', message: 'Sorry, you are not allowed.' }
  };

  // Assert (initial)
  assert.equal(error.statusCode, 403);

  // Act
  const result = translateWpError(error, { route: '/wp/v2/posts', method: 'POST' });

  // Assert
  assert.equal(result.kind, 'permission_error');
  assert.match(result.actionable, /higher-privilege account/i);
});

test('translateWpError: maps network failures to actionable connectivity guidance', () => {
  // Arrange
  const error = {
    kind: 'network_error',
    message: 'connect ECONNRESET',
    code: 'ECONNRESET',
    requestUrl: 'https://example.com/wp-json/wp/v2/posts',
    attempts: [{ attempt: 1 }]
  };

  // Assert (initial)
  assert.equal(error.kind, 'network_error');

  // Act
  const result = translateWpError(error, { route: '/wp/v2/posts', method: 'GET' });

  // Assert
  assert.equal(result.kind, 'network_error');
  assert.match(result.actionable, /could not reach/i);
});

test('translateWpError: maps TLS failures to actionable certificate guidance', () => {
  // Arrange
  const error = {
    kind: 'tls_error',
    message: 'self signed certificate',
    code: 'DEPTH_ZERO_SELF_SIGNED_CERT',
    requestUrl: 'https://example.com/wp-json'
  };

  // Assert (initial)
  assert.equal(error.kind, 'tls_error');

  // Act
  const result = translateWpError(error, { route: '/', method: 'GET' });

  // Assert
  assert.equal(result.kind, 'tls_error');
  assert.match(result.actionable, /certificate chain/i);
});

test('translateWpError: recognizes Elementor kit delete confirmation HTML', () => {
  // Arrange
  const error = {
    kind: 'unexpected_html',
    message: 'Unexpected HTML response from DELETE /wp/v2/elementor_library/(?P<id>[\\d]+).',
    snippet: 'Are you sure you want to delete your Site Settings? force_delete_kit=1'
  };

  // Assert (initial)
  assert.match(error.snippet, /force_delete_kit/);

  // Act
  const result = translateWpError(error, {
    route: '/wp/v2/elementor_library/(?P<id>[\\d]+)',
    method: 'DELETE'
  });

  // Assert
  assert.equal(result.kind, 'elementor_kit_delete_confirmation');
  assert.match(result.actionable, /guarded Elementor kit cleanup workflow/);
});

test('translateWpError: recognizes Elementor kit delete confirmation when returned as a 500 body', () => {
  // Arrange
  const error = {
    statusCode: 500,
    responseBody:
      '<h4>Are you sure you want to delete your Site Settings?</h4><a href="?force_delete_kit=1">Delete</a>',
    wpCode: 'cant_delete_kit'
  };

  // Assert (initial)
  assert.equal(error.statusCode, 500);

  // Act
  const result = translateWpError(error, {
    route: '/wp/v2/elementor_library/(?P<id>[\\d]+)',
    method: 'DELETE'
  });

  // Assert
  assert.equal(result.kind, 'elementor_kit_delete_confirmation');
  assert.match(result.details.snippet, /force_delete_kit/);
});
