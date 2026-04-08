import fs from 'node:fs';
import path from 'node:path';
import { Agent, request } from 'undici';
import { hasAuth } from './config.js';
import { routePatternToConcretePath } from './generator.js';
import { sanitizeForLog, splitArgs } from './utils.js';

function authHeader(config) {
  const pair = `${config.username}:${config.appPassword}`;
  return `Basic ${Buffer.from(pair, 'utf8').toString('base64')}`;
}

function withQuery(url, queryEntries) {
  const target = new URL(url);
  for (const [key, value] of Object.entries(queryEntries || {})) {
    if (value === undefined || value === null) continue;
    if (Array.isArray(value)) {
      for (const entry of value) target.searchParams.append(key, String(entry));
    } else {
      target.searchParams.set(key, String(value));
    }
  }
  return target.toString();
}

function isHtmlResponse(headers) {
  const contentType = headers['content-type'] || headers['Content-Type'];
  return typeof contentType === 'string' && contentType.includes('text/html');
}

async function parseResponse(response, operation) {
  const contentType = response.headers['content-type'] || '';
  const text = await response.body.text();
  if (isHtmlResponse(response.headers)) {
    throw {
      kind: 'unexpected_html',
      message: `Unexpected HTML response from ${operation.method} ${operation.route}.`,
      snippet: text.slice(0, 400),
      statusCode: response.statusCode,
      route: operation.route,
      method: operation.method
    };
  }
  if (!text.trim()) {
    return { data: null, raw: '', headers: response.headers };
  }
  if (contentType.includes('application/json')) {
    return { data: JSON.parse(text), raw: text, headers: response.headers };
  }
  try {
    return { data: JSON.parse(text), raw: text, headers: response.headers };
  } catch {
    return { data: text, raw: text, headers: response.headers };
  }
}

export function createWpClient(config, logger) {
  const dispatcher = config.allowInsecureTls
    ? new Agent({
        connect: {
          rejectUnauthorized: false
        }
      })
    : undefined;

  function requestOptions(overrides = {}) {
    return dispatcher ? { ...overrides, dispatcher } : overrides;
  }

  async function execute(operation, args) {
    const argNames = operation.args.map((arg) => arg.name);
    const { picked } = splitArgs(args, [...argNames, 'confirm']);
    const concretePath = routePatternToConcretePath(operation.route, picked);
    const pathParamNames = new Set(operation.pathParams);
    const payloadEntries = Object.fromEntries(
      Object.entries(picked).filter(([key]) => key !== 'confirm' && !pathParamNames.has(key))
    );

    const headers = {
      'User-Agent': config.userAgent,
      Accept: 'application/json'
    };

    if (hasAuth(config)) {
      headers.Authorization = authHeader(config);
    }

    let url = `${config.siteUrl}/wp-json${concretePath}`;
    const requestInit = {
      method: operation.method,
      headers
    };

    if (operation.requestStyle === 'query') {
      url = withQuery(url, payloadEntries);
    } else if (operation.requestStyle === 'media-upload') {
      const filePath = payloadEntries.filePath;
      const fileName = path.basename(filePath);
      requestInit.body = fs.readFileSync(filePath);
      requestInit.headers['Content-Disposition'] = `attachment; filename="${fileName}"`;
      requestInit.headers['Content-Type'] = 'application/octet-stream';
      const metadata = { ...payloadEntries };
      delete metadata.filePath;
      url = withQuery(url, metadata);
    } else if (Object.keys(payloadEntries).length > 0) {
      requestInit.body = JSON.stringify(payloadEntries);
      requestInit.headers['Content-Type'] = 'application/json';
    }

    logger.debug('wordpress request', sanitizeForLog({ url, method: operation.method, payloadEntries }));

    const response = await request(url, requestOptions(requestInit));
    const parsed = await parseResponse(response, operation);

    if (response.statusCode >= 400) {
      throw {
        statusCode: response.statusCode,
        responseBody: parsed.data,
        route: operation.route,
        method: operation.method
      };
    }

    return {
      statusCode: response.statusCode,
      headers: parsed.headers,
      data: parsed.data,
      route: concretePath,
      requestUrl: url
    };
  }

  async function healthCheck() {
    const base = `${config.siteUrl}/wp-json`;
    const indexResponse = await request(base, requestOptions({
      method: 'GET',
      headers: { Accept: 'application/json', 'User-Agent': config.userAgent }
    }));
    const routeIndex = await parseResponse(indexResponse, { method: 'GET', route: '/' });
    let auth = null;
    if (hasAuth(config)) {
      try {
        const authResponse = await request(`${config.siteUrl}/wp-json/wp/v2/users/me?context=edit`, requestOptions({
          method: 'GET',
          headers: {
            Accept: 'application/json',
            'User-Agent': config.userAgent,
            Authorization: authHeader(config)
          }
        }));
        const authBody = await parseResponse(authResponse, { method: 'GET', route: '/wp/v2/users/me' });
        auth = {
          ok: authResponse.statusCode < 400,
          statusCode: authResponse.statusCode,
          user: authBody.data?.slug || authBody.data?.name || null
        };
      } catch (error) {
        auth = {
          ok: false,
          statusCode: error.statusCode || null,
          message: error.message
        };
      }
    }

    return {
      siteUrl: config.siteUrl,
      routeCount: Object.keys(routeIndex.data?.routes || {}).length,
      namespaces: routeIndex.data?.namespaces || [],
      auth
    };
  }

  return {
    execute,
    healthCheck
  };
}
