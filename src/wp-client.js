import fs from 'node:fs';
import path from 'node:path';
import { Agent, request as undiciRequest } from 'undici';
import { hasAuth } from './config.js';
import { routePatternToConcretePath } from './generator.js';
import { sanitizeForLog, splitArgs } from './utils.js';

const RETRYABLE_STATUS_CODES = new Set([408, 429, 500, 502, 503, 504]);
const RETRYABLE_NETWORK_CODES = new Set([
  'ECONNABORTED',
  'ECONNREFUSED',
  'ECONNRESET',
  'EHOSTUNREACH',
  'ENETDOWN',
  'ENETRESET',
  'ENETUNREACH',
  'ETIMEDOUT',
  'UND_ERR_CONNECT_TIMEOUT',
  'UND_ERR_HEADERS_TIMEOUT',
  'UND_ERR_SOCKET'
]);
const TLS_ERROR_CODES = new Set([
  'CERT_HAS_EXPIRED',
  'DEPTH_ZERO_SELF_SIGNED_CERT',
  'ERR_TLS_CERT_ALTNAME_INVALID',
  'SELF_SIGNED_CERT_IN_CHAIN',
  'UNABLE_TO_GET_ISSUER_CERT',
  'UNABLE_TO_VERIFY_LEAF_SIGNATURE'
]);

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

function safeSnippet(value) {
  return typeof value === 'string' ? value.slice(0, 400) : '';
}

function responseSnippet(value) {
  const source = typeof value === 'string' ? value : JSON.stringify(value);
  return source.replace(/\s+/g, ' ').slice(0, 200) || '<empty>';
}

function extractErrorCode(error) {
  return error?.code || error?.cause?.code || error?.socket?.code || '';
}

function buildHttpsVariant(url) {
  const next = new URL(url);
  if (next.protocol !== 'http:') return null;
  next.protocol = 'https:';
  return next.toString();
}

function shouldRetryWithHttps(config, error, url) {
  if (!hasAuth(config)) return false;
  if (!url.startsWith('http://')) return false;

  const wpCode = error?.wpCode || error?.responseBody?.code || '';
  const message = error?.responseBody?.message || error?.message || '';
  const snippet = error?.snippet || '';
  const combined = `${wpCode} ${message} ${snippet}`.toLowerCase();

  return error?.statusCode === 401 && /rest_not_logged_in|application password|authorization/i.test(combined);
}

function shouldRetryTransient(error, safeToRetry) {
  if (!safeToRetry) return false;
  if (error?.kind === 'network_error') return true;
  return RETRYABLE_STATUS_CODES.has(error?.statusCode);
}

async function parseResponse(response, operation, requestUrl) {
  const contentType = response.headers['content-type'] || '';
  const text = await response.body.text();
  if (isHtmlResponse(response.headers)) {
    throw {
      kind: 'unexpected_html',
      message: `Unexpected HTML response from ${operation.method} ${operation.route}.`,
      snippet: safeSnippet(text),
      statusCode: response.statusCode,
      route: operation.route,
      method: operation.method,
      requestUrl
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

function normalizeHttpError(operation, requestUrl, statusCode, responseBody) {
  const wpCode = responseBody?.code;
  const message = responseBody?.message || `WordPress request failed with status ${statusCode}.`;
  let kind = 'unexpected_error';

  if (statusCode === 400) kind = 'bad_request';
  else if (statusCode === 401) kind = 'auth_error';
  else if (statusCode === 403) kind = 'permission_error';
  else if (statusCode === 404) kind = 'not_found';
  else if (RETRYABLE_STATUS_CODES.has(statusCode)) kind = 'transient_http_error';
  else if (statusCode >= 500) kind = 'server_error';

  return {
    kind,
    message,
    statusCode,
    responseBody,
    wpCode,
    route: operation.route,
    method: operation.method,
    requestUrl
  };
}

function normalizeTransportError(error, operation, requestUrl) {
  if (error?.route && error?.method) {
    return {
      ...error,
      requestUrl: error.requestUrl || requestUrl
    };
  }

  const code = extractErrorCode(error);
  const kind = TLS_ERROR_CODES.has(code) ? 'tls_error' : 'network_error';

  return {
    kind,
    message: error?.message || 'WordPress request failed before the server returned a response.',
    route: operation.route,
    method: operation.method,
    requestUrl,
    code
  };
}

export function createWpClient(config, logger, transport = {}) {
  const requestImpl = transport.request || undiciRequest;
  const AgentCtor = transport.Agent || Agent;
  const dispatcher = config.allowInsecureTls
    ? new AgentCtor({
        connect: {
          rejectUnauthorized: false
        }
      })
    : undefined;

  function requestOptions(overrides = {}) {
    return dispatcher ? { ...overrides, dispatcher } : overrides;
  }

  function buildHeaders(includeAuth = true) {
    const headers = {
      'User-Agent': config.userAgent,
      Accept: 'application/json'
    };

    if (includeAuth && hasAuth(config)) {
      headers.Authorization = authHeader(config);
    }

    return headers;
  }

  async function performJsonRequest(operation, requestUrl, requestInit, options = {}) {
    const { safeToRetry = false, allowHttpsUpgrade = false } = options;
    const attempts = [];
    let currentUrl = requestUrl;

    while (true) {
      const attemptNumber = attempts.length + 1;
      logger.debug(
        'wordpress request',
        sanitizeForLog({
          url: currentUrl,
          method: operation.method,
          attempt: attemptNumber,
          headers: requestInit.headers,
          hasBody: requestInit.body !== undefined,
          bodyPreview:
            typeof requestInit.body === 'string'
              ? requestInit.body
              : requestInit.body instanceof Buffer
                ? `<buffer:${requestInit.body.byteLength}>`
                : undefined
        })
      );

      try {
        const response = await requestImpl(currentUrl, requestOptions(requestInit));
        const parsed = await parseResponse(response, operation, currentUrl);

        logger.debug(
          'wordpress response',
          sanitizeForLog({
            url: currentUrl,
            method: operation.method,
            attempt: attemptNumber,
            statusCode: response.statusCode,
            snippet: responseSnippet(parsed.raw)
          })
        );

        if (response.statusCode >= 400) {
          throw normalizeHttpError(operation, currentUrl, response.statusCode, parsed.data);
        }

        return {
          statusCode: response.statusCode,
          headers: parsed.headers,
          data: parsed.data,
          route: operation.route,
          requestUrl: currentUrl,
          attempts: attemptNumber
        };
      } catch (error) {
        const normalized = normalizeTransportError(error, operation, currentUrl);
        attempts.push({
          attempt: attemptNumber,
          requestUrl: currentUrl,
          kind: normalized.kind,
          statusCode: normalized.statusCode || null,
          code: normalized.code || null
        });

        if (allowHttpsUpgrade && shouldRetryWithHttps(config, normalized, currentUrl)) {
          const httpsUrl = buildHttpsVariant(currentUrl);
          if (httpsUrl && httpsUrl !== currentUrl) {
            logger.info(
              'wordpress request retrying with https',
              sanitizeForLog({
                fromUrl: currentUrl,
                toUrl: httpsUrl,
                method: operation.method,
                reason: normalized.wpCode || normalized.kind
              })
            );
            currentUrl = httpsUrl;
            continue;
          }
        }

        if (attempts.length === 1 && shouldRetryTransient(normalized, safeToRetry)) {
          logger.warn(
            'wordpress request retrying after transient failure',
            sanitizeForLog({
              url: currentUrl,
              method: operation.method,
              kind: normalized.kind,
              statusCode: normalized.statusCode || null,
              code: normalized.code || null
            })
          );
          continue;
        }

        logger.warn(
          'wordpress request failed',
          sanitizeForLog({
            url: currentUrl,
            method: operation.method,
            kind: normalized.kind,
            statusCode: normalized.statusCode || null,
            code: normalized.code || null,
            wpCode: normalized.wpCode || null,
            message: normalized.message
          })
        );

        throw {
          ...normalized,
          attempts
        };
      }
    }
  }

  async function execute(operation, args) {
    const argNames = operation.args.map((arg) => arg.name);
    const { picked } = splitArgs(args, [...argNames, 'confirm']);
    const concretePath = routePatternToConcretePath(operation.route, picked);
    const pathParamNames = new Set(operation.pathParams);
    const payloadEntries = Object.fromEntries(
      Object.entries(picked).filter(([key]) => key !== 'confirm' && !pathParamNames.has(key))
    );

    let url = `${config.siteUrl}/wp-json${concretePath}`;
    const requestInit = {
      method: operation.method,
      headers: buildHeaders(true)
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

    const result = await performJsonRequest(operation, url, requestInit, {
      safeToRetry: !operation.mutation,
      allowHttpsUpgrade: true
    });

    return {
      ...result,
      route: concretePath
    };
  }

  async function healthCheck() {
    const routeIndex = await performJsonRequest(
      { method: 'GET', route: '/' },
      `${config.siteUrl}/wp-json`,
      {
        method: 'GET',
        headers: buildHeaders(false)
      },
      {
        safeToRetry: true,
        allowHttpsUpgrade: false
      }
    );

    let auth = null;
    if (hasAuth(config)) {
      try {
        const authResponse = await performJsonRequest(
          { method: 'GET', route: '/wp/v2/users/me' },
          `${config.siteUrl}/wp-json/wp/v2/users/me?context=edit`,
          {
            method: 'GET',
            headers: buildHeaders(true)
          },
          {
            safeToRetry: true,
            allowHttpsUpgrade: true
          }
        );

        auth = {
          ok: true,
          statusCode: authResponse.statusCode,
          user: authResponse.data?.slug || authResponse.data?.name || null
        };
      } catch (error) {
        auth = {
          ok: false,
          statusCode: error.statusCode || null,
          kind: error.kind || 'unexpected_error',
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
