import test from 'node:test';
import assert from 'node:assert/strict';
import { translateWpError } from '../src/error-translation.js';

test('translateWpError: maps auth failures to actionable guidance', () => {
  // Arrange
  const error = { statusCode: 403, responseBody: { code: 'rest_forbidden', message: 'Sorry, you are not allowed.' } };

  // Assert (initial)
  assert.equal(error.statusCode, 403);

  // Act
  const result = translateWpError(error, { route: '/wp/v2/posts', method: 'POST' });

  // Assert
  assert.equal(result.kind, 'auth_error');
  assert.match(result.actionable, /WP_USERNAME/);
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
  assert.match(result.actionable, /special-case operation/);
});

test('translateWpError: recognizes Elementor kit delete confirmation when returned as a 500 body', () => {
  // Arrange
  const error = {
    statusCode: 500,
    responseBody:
      '<h4>Are you sure you want to delete your Site Settings?</h4><a href=\"?force_delete_kit=1\">Delete</a>',
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
