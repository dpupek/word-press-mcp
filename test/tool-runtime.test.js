import test from 'node:test';
import assert from 'node:assert/strict';
import { enforceMutationConfirmation } from '../src/tool-runtime.js';

test('enforceMutationConfirmation: rejects mutating tools without confirm when safe mode is enabled', () => {
  // Arrange
  const operation = { toolName: 'wp_v2_posts_id_update', mutation: true, method: 'POST', route: '/wp/v2/posts/(?P<id>[\\d]+)' };
  const config = { safeMode: true };

  // Assert (initial)
  assert.equal(config.safeMode, true);

  // Act / Assert
  assert.throws(
    () => enforceMutationConfirmation(operation, config, {}),
    (error) => error.kind === 'confirmation_required' && /requires confirm=true/.test(error.message)
  );
});

test('enforceMutationConfirmation: allows mutating tools with confirm', () => {
  // Arrange
  const operation = { toolName: 'wp_v2_posts_id_update', mutation: true, method: 'POST', route: '/wp/v2/posts/(?P<id>[\\d]+)' };
  const config = { safeMode: true };

  // Assert (initial)
  assert.equal(operation.mutation, true);

  // Act
  enforceMutationConfirmation(operation, config, { confirm: true });

  // Assert
  assert.ok(true);
});
