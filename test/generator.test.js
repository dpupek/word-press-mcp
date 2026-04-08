import test from 'node:test';
import assert from 'node:assert/strict';
import { buildOperationsFromRouteIndex } from '../src/generator.js';

test('buildOperationsFromRouteIndex: produces stable operation names', () => {
  // Arrange
  const routeIndex = {
    routes: {
      '/wp/v2/posts': {
        namespace: 'wp/v2',
        endpoints: [{ methods: ['GET', 'POST'], args: {} }]
      },
      '/wp/v2/posts/(?P<id>[\\d]+)': {
        namespace: 'wp/v2',
        endpoints: [{ methods: ['GET', 'POST', 'DELETE'], args: { id: { type: 'integer' } } }]
      }
    }
  };

  // Assert (initial)
  assert.equal(Object.keys(routeIndex.routes).length, 2);

  // Act
  const operations = buildOperationsFromRouteIndex(routeIndex);

  // Assert
  assert.ok(operations.find((operation) => operation.toolName === 'wp_v2_posts_list'));
  assert.ok(operations.find((operation) => operation.toolName === 'wp_v2_posts_create'));
  assert.ok(operations.find((operation) => operation.toolName === 'wp_v2_posts_id_get'));
  assert.ok(operations.find((operation) => operation.toolName === 'wp_v2_posts_id_update'));
  assert.ok(operations.find((operation) => operation.toolName === 'wp_v2_posts_id_delete'));
});
