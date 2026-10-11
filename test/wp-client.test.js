import test from 'node:test';
import assert from 'node:assert/strict';
import { createWpClient } from '../src/wp-client.js';

function fakeResponse({ statusCode = 200, headers = { 'content-type': 'application/json' }, body = {} }) {
  return {
    statusCode,
    headers,
    body: {
      async text() {
        return typeof body === 'string' ? body : JSON.stringify(body);
      }
    }
  };
}

function createLoggerSpy() {
  const entries = [];
  return {
    entries,
    debug(message, meta) {
      entries.push({ level: 'debug', message, meta });
    },
    info(message, meta) {
      entries.push({ level: 'info', message, meta });
    },
    warn(message, meta) {
      entries.push({ level: 'warn', message, meta });
    },
    error(message, meta) {
      entries.push({ level: 'error', message, meta });
    }
  };
}

const baseConfig = {
  siteUrl: 'http://example.com',
  username: 'test',
  appPassword: 'secret',
  userAgent: 'wordpress-mcp-test/1.0.0',
  allowInsecureTls: false
};

test('createWpClient: encodes array filters as PHP arrays and preserves scalar query values', async () => {
  const calls = [];
  const client = createWpClient(
    { ...baseConfig, siteUrl: 'https://example.com' },
    createLoggerSpy(),
    { request: async (url) => { calls.push(url); return fakeResponse({ body: [] }); } }
  );
  const operation = {
    toolName: 'wp_v2_posts_list', route: '/wp/v2/posts', method: 'GET', pathParams: [],
    args: ['include', 'exclude', 'categories', 'slug', 'per_page', 'search'].map((name) => ({ name })),
    requestStyle: 'query', mutation: false
  };
  await client.execute(operation, {
    include: ['196', '182'], exclude: ['10', '20'], categories: ['3', '4'],
    slug: ['one', 'two'], per_page: 10, search: 'Rapier & C&T'
  });
  const query = new URL(calls[0]).searchParams;
  for (const [key, expected] of Object.entries({ include: ['196', '182'], exclude: ['10', '20'], categories: ['3', '4'], slug: ['one', 'two'] })) {
    assert.deepEqual(query.getAll(`${key}[]`), expected);
    assert.equal(query.has(key), false);
  }
  assert.equal(query.get('per_page'), '10');
  assert.equal(query.get('search'), 'Rapier & C&T');
});

test('createWpClient: upgrades http auth failure to https automatically for safe reads', async () => {
  // Arrange
  const calls = [];
  const logger = createLoggerSpy();
  const client = createWpClient(
    baseConfig,
    logger,
    {
      request: async (url) => {
        calls.push(url);
        if (url.startsWith('http://')) {
          return fakeResponse({
            statusCode: 401,
            body: { code: 'rest_not_logged_in', message: 'You are not currently logged in.' }
          });
        }

        return fakeResponse({
          statusCode: 200,
          body: { id: 123, title: { rendered: 'Hello' } }
        });
      }
    }
  );
  const operation = {
    toolName: 'wp_v2_posts_id_get',
    route: '/wp/v2/posts/(?P<id>[\\d]+)',
    method: 'GET',
    pathParams: ['id'],
    args: [{ name: 'id', location: 'path' }],
    requestStyle: 'query',
    mutation: false
  };

  // Assert (initial)
  assert.equal(calls.length, 0);

  // Act
  const result = await client.execute(operation, { id: 123 });

  // Assert
  assert.equal(result.statusCode, 200);
  assert.equal(calls.length, 2);
  assert.match(calls[0], /^http:\/\//);
  assert.match(calls[1], /^https:\/\//);
  assert.equal(result.requestUrl, calls[1]);
});

test('createWpClient: retries transient safe-read failures once', async () => {
  // Arrange
  let attempts = 0;
  const logger = createLoggerSpy();
  const client = createWpClient(
    { ...baseConfig, siteUrl: 'https://example.com' },
    logger,
    {
      request: async () => {
        attempts += 1;
        if (attempts === 1) {
          return fakeResponse({
            statusCode: 503,
            body: { code: 'server_busy', message: 'Try again soon.' }
          });
        }

        return fakeResponse({
          statusCode: 200,
          body: { id: 55 }
        });
      }
    }
  );
  const operation = {
    toolName: 'wp_v2_posts_id_get',
    route: '/wp/v2/posts/(?P<id>[\\d]+)',
    method: 'GET',
    pathParams: ['id'],
    args: [{ name: 'id', location: 'path' }],
    requestStyle: 'query',
    mutation: false
  };

  // Assert (initial)
  assert.equal(attempts, 0);

  // Act
  const result = await client.execute(operation, { id: 55 });

  // Assert
  assert.equal(result.statusCode, 200);
  assert.equal(result.attempts, 2);
  assert.equal(attempts, 2);
});

test('createWpClient: does not retry transient failures for mutations', async () => {
  // Arrange
  let attempts = 0;
  const logger = createLoggerSpy();
  const client = createWpClient(
    { ...baseConfig, siteUrl: 'https://example.com' },
    logger,
    {
      request: async () => {
        attempts += 1;
        return fakeResponse({
          statusCode: 503,
          body: { code: 'server_busy', message: 'Try again soon.' }
        });
      }
    }
  );
  const operation = {
    toolName: 'wp_v2_posts_create',
    route: '/wp/v2/posts',
    method: 'POST',
    pathParams: [],
    args: [{ name: 'title', location: 'body' }],
    requestStyle: 'json',
    mutation: true
  };

  // Assert (initial)
  assert.equal(attempts, 0);

  // Act / Assert
  await assert.rejects(
    () => client.execute(operation, { title: 'Hello' }),
    (error) => {
      assert.equal(error.kind, 'transient_http_error');
      assert.equal(error.attempts.length, 1);
      return true;
    }
  );
  assert.equal(attempts, 1);
});

test('createWpClient: emits sanitized request and response debug logs', async () => {
  // Arrange
  const logger = createLoggerSpy();
  const client = createWpClient(
    { ...baseConfig, siteUrl: 'https://example.com' },
    logger,
    {
      request: async () =>
        fakeResponse({
          statusCode: 200,
          body: { id: 321, title: { rendered: 'Hello world' } }
        })
    }
  );
  const operation = {
    toolName: 'wp_v2_posts_id_get',
    route: '/wp/v2/posts/(?P<id>[\\d]+)',
    method: 'GET',
    pathParams: ['id'],
    args: [{ name: 'id', location: 'path' }],
    requestStyle: 'query',
    mutation: false
  };

  // Assert (initial)
  assert.equal(logger.entries.length, 0);

  // Act
  await client.execute(operation, { id: 321 });

  // Assert
  const requestLog = logger.entries.find((entry) => entry.message === 'wordpress request');
  const responseLog = logger.entries.find((entry) => entry.message === 'wordpress response');
  assert.ok(requestLog);
  assert.ok(responseLog);
  assert.equal(requestLog.meta.headers.Authorization, '[redacted]');
  assert.equal(responseLog.meta.statusCode, 200);
  assert.match(responseLog.meta.snippet, /Hello world/);
});
