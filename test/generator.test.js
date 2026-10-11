import test from 'node:test';
import assert from 'node:assert/strict';
import { buildOperationsFromRouteIndex, loadOperations, routePatternToConcretePath } from '../src/generator.js';

test('routePatternToConcretePath: replaces nested template ID patterns without leftover regex', () => {
  const operations = loadOperations().filter((operation) =>
    operation.route.startsWith('/wp/v2/templates/(?P<') ||
    operation.route.startsWith('/wp/v2/template-parts/(?P<')
  );
  assert.ok(operations.length > 0);
  for (const operation of operations) {
    const args = Object.fromEntries(operation.pathParams.map((name) => [name, name === 'id' ? 'theme//header' : 'theme//parent']));
    const concrete = routePatternToConcretePath(operation.route, args);
    const collection = operation.route.startsWith('/wp/v2/templates/') ? 'templates' : 'template-parts';
    const suffix = operation.route.match(/\/(autosaves|revisions)(?:\/\(\?P<id>.*)?$/)?.[1];
    const parent = operation.pathParams.includes('parent') ? 'theme%2F%2Fparent' : 'theme%2F%2Fheader';
    const expected = `/wp/v2/${collection}/${parent}${suffix ? `/${suffix}` : ''}${operation.pathParams.includes('parent') && operation.pathParams.includes('id') ? '/theme%2F%2Fheader' : ''}`;
    assert.equal(concrete, expected, operation.route);
  }
});

test('routePatternToConcretePath: handles parentheses in classes and escaped literals', () => {
  const route = String.raw`/plugin/v1/(?P<key>[()]|\([a-z]+\)|(?:outer(?:inner)))/(?P<id>[\d]+)`;
  assert.equal(routePatternToConcretePath(route, { key: '(outer inner)', id: 42 }), '/plugin/v1/(outer%20inner)/42');
});

test('routePatternToConcretePath: rejects unclosed parameter groups', () => {
  assert.throws(
    () => routePatternToConcretePath('/plugin/v1/(?P<id>(?:[a-z]+)', { id: 'example' }),
    (error) => error.kind === 'validation_error' && /Unclosed path parameter/.test(error.message)
  );
});

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

test('buildOperationsFromRouteIndex: collapses exact duplicate endpoints into one operation', () => {
  // Arrange
  const routeIndex = {
    routes: {
      '/elementor/v1/onboarding/pro-install-screen': {
        namespace: 'elementor/v1',
        endpoints: [
          { methods: ['GET'], args: {} },
          { methods: ['GET'], args: {} }
        ]
      }
    }
  };

  // Assert (initial)
  assert.equal(routeIndex.routes['/elementor/v1/onboarding/pro-install-screen'].endpoints.length, 2);

  // Act
  const operations = buildOperationsFromRouteIndex(routeIndex);

  // Assert
  assert.equal(operations.length, 1);
  assert.equal(operations[0].toolName, 'elementor_v1_onboarding_pro_install_screen_list');
});

test('loadOperations: generated manifest keeps tool names unique', () => {
  // Arrange
  const operations = loadOperations();
  const counts = new Map();

  // Assert (initial)
  assert.ok(operations.length > 0);

  // Act
  for (const operation of operations) {
    counts.set(operation.toolName, (counts.get(operation.toolName) || 0) + 1);
  }
  const duplicates = [...counts.entries()].filter(([, count]) => count > 1);

  // Assert
  assert.deepEqual(duplicates, []);
});
