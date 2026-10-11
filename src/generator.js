import fs from 'node:fs';
import path from 'node:path';
import { PATHS } from './paths.js';
import { readJson, uniqueBy } from './utils.js';

const CORE_NAMESPACES = new Set(readJson(path.join(PATHS.spec, 'core-namespaces.json')));
const PATH_PARAM_REGEX = /\(\?P<([^>]+)>[^)]+\)/g;

function slugify(segment) {
  return segment
    .replace(PATH_PARAM_REGEX, '$1')
    .replace(/[()]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .replace(/_+/g, '_')
    .toLowerCase();
}

function extractPathParams(route) {
  return [...route.matchAll(PATH_PARAM_REGEX)].map((match) => match[1]);
}

function normalizeRouteSegments(route) {
  return route
    .split('/')
    .filter(Boolean)
    .map((segment) => slugify(segment))
    .filter(Boolean);
}

function classifyAction(method, pathParamNames) {
  const upper = method.toUpperCase();
  const hasPathParam = pathParamNames.length > 0;
  if (upper === 'GET') return hasPathParam ? 'get' : 'list';
  if (upper === 'DELETE') return 'delete';
  if (upper === 'POST' && !hasPathParam) return 'create';
  if (upper === 'POST' || upper === 'PUT' || upper === 'PATCH') return hasPathParam ? 'update' : 'create';
  return upper.toLowerCase();
}

function buildToolName(namespace, route, method, pathParamNames) {
  const routeSegments = normalizeRouteSegments(route);
  const nsSegments = normalizeRouteSegments(namespace || 'root');
  const action = classifyAction(method, pathParamNames);
  const segments = uniqueBy([...nsSegments, ...routeSegments], (value) => value);
  return [...segments, action].filter(Boolean).join('_');
}

function namespaceRouteNeedsFilePath(method, route, name) {
  return method.toUpperCase() === 'POST' && route === '/wp/v2/media' && name === 'filePath';
}

function operationSignature(operation) {
  return JSON.stringify({
    namespace: operation.namespace,
    route: operation.route,
    method: operation.method,
    action: operation.action,
    mutation: operation.mutation,
    requestStyle: operation.requestStyle,
    pathParams: operation.pathParams,
    args: operation.args,
    isCore: operation.isCore,
    source: operation.source,
    description: operation.description
  });
}

function dedupeOperations(operations) {
  return uniqueBy(operations, (operation) => operationSignature(operation));
}

function assignUniqueToolNames(operations) {
  const collisions = new Map();
  for (const operation of operations) {
    collisions.set(operation.toolName, (collisions.get(operation.toolName) || 0) + 1);
  }

  const seenPerToolName = new Map();
  return operations.map((operation) => {
    if ((collisions.get(operation.toolName) || 0) === 1) {
      return operation;
    }

    const methodKey = `${operation.toolName}:${operation.method.toLowerCase()}`;
    const sameMethodIndex = (seenPerToolName.get(methodKey) || 0) + 1;
    seenPerToolName.set(methodKey, sameMethodIndex);

    const sameMethodCount = operations.filter(
      (candidate) => candidate.toolName === operation.toolName && candidate.method === operation.method
    ).length;

    return {
      ...operation,
      toolName:
        sameMethodCount === 1
          ? `${operation.toolName}_${operation.method.toLowerCase()}`
          : `${operation.toolName}_${operation.method.toLowerCase()}_${sameMethodIndex}`
    };
  });
}

function normalizeArgSchema(name, schema = {}, pathParamNames, method, route) {
  const type = Array.isArray(schema.type) ? 'mixed' : schema.type || (pathParamNames.includes(name) ? 'string' : 'mixed');
  return {
    name,
    type,
    required: Boolean(schema.required),
    enum: Array.isArray(schema.enum) ? schema.enum : null,
    minimum: schema.minimum ?? null,
    maximum: schema.maximum ?? null,
    format: schema.format ?? null,
    minLength: schema.minLength ?? null,
    description: schema.description ?? null,
    location: pathParamNames.includes(name) ? 'path' : method === 'GET' || method === 'DELETE' ? 'query' : 'body',
    isFilePath: namespaceRouteNeedsFilePath(method, route, name) || false
  };
}

export function buildOperationsFromRouteIndex(routeIndex) {
  const routes = routeIndex.routes || {};
  const operations = [];

  for (const [route, routeMeta] of Object.entries(routes)) {
    const namespace = routeMeta.namespace || '';
    const endpoints = routeMeta.endpoints || [];
    const pathParams = extractPathParams(route);
    for (const endpoint of endpoints) {
      for (const method of endpoint.methods || []) {
        const rawArgs = endpoint.args && !Array.isArray(endpoint.args) ? endpoint.args : {};
        const args = Object.entries(rawArgs).map(([name, schema]) =>
          normalizeArgSchema(name, schema, pathParams, method, route)
        );

        if (method.toUpperCase() === 'POST' && route === '/wp/v2/media' && !args.find((arg) => arg.name === 'filePath')) {
          args.unshift({
            name: 'filePath',
            type: 'string',
            required: true,
            enum: null,
            minimum: null,
            maximum: null,
            format: null,
            minLength: 1,
            description: 'Local file path for the media payload.',
            location: 'body',
            isFilePath: true
          });
        }

        const toolName = buildToolName(namespace, route, method, pathParams);
        operations.push({
          toolName,
          namespace,
          route,
          method: method.toUpperCase(),
          action: classifyAction(method, pathParams),
          mutation: ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method.toUpperCase()),
          requestStyle:
            method.toUpperCase() === 'POST' && route === '/wp/v2/media'
              ? 'media-upload'
              : method.toUpperCase() === 'GET'
                ? 'query'
                : 'json',
          pathParams,
          args,
          isCore: CORE_NAMESPACES.has(namespace),
          source: CORE_NAMESPACES.has(namespace) ? 'core' : 'site',
          description: `${method.toUpperCase()} ${route}`
        });
      }
    }
  }

  return assignUniqueToolNames(dedupeOperations(operations)).sort((a, b) => a.toolName.localeCompare(b.toolName));
}

export function loadRouteIndex() {
  return readJson(PATHS.liveSpec);
}

export function loadOperations() {
  return readJson(PATHS.generatedOperations);
}

export function summarizeOperations(operations) {
  const summary = {
    total: operations.length,
    mutations: operations.filter((operation) => operation.mutation).length,
    reads: operations.filter((operation) => !operation.mutation).length,
    core: operations.filter((operation) => operation.source === 'core').length,
    site: operations.filter((operation) => operation.source === 'site').length,
    namespaces: {}
  };

  for (const operation of operations) {
    const key = operation.namespace || 'root';
    summary.namespaces[key] = (summary.namespaces[key] || 0) + 1;
  }

  return summary;
}

export function verifyOperationsAgainstRouteIndex(operations, routeIndex) {
  const regenerated = buildOperationsFromRouteIndex(routeIndex);
  return {
    ok: JSON.stringify(regenerated) === JSON.stringify(operations),
    regeneratedCount: regenerated.length,
    existingCount: operations.length
  };
}

export function routePatternToConcretePath(route, args) {
  // Parse complete groups here without changing existing generated tool names.
  const groupStart = /\(\?P<([^>]+)>/g;
  let concrete = '';
  let cursor = 0;
  let match;
  while ((match = groupStart.exec(route))) {
    let depth = 1;
    let inClass = false;
    let end = groupStart.lastIndex;
    for (; end < route.length; end += 1) {
      const character = route[end];
      if (character === '\\') {
        end += 1;
        continue;
      }
      if (inClass) {
        if (character === ']') inClass = false;
        continue;
      }
      if (character === '[') inClass = true;
      else if (character === '(') depth += 1;
      else if (character === ')' && --depth === 0) break;
    }
    if (depth !== 0) {
      throw { kind: 'validation_error', message: `Unclosed path parameter group in route: ${route}` };
    }
    concrete += route.slice(cursor, match.index) + encodeURIComponent(String(args[match[1]]));
    cursor = end + 1;
    groupStart.lastIndex = cursor;
  }
  return concrete + route.slice(cursor);
}

export function fileExistsArg(operation) {
  return operation.args.find((arg) => arg.isFilePath);
}

export function ensureGeneratedDirectory() {
  fs.mkdirSync(PATHS.generatedDir, { recursive: true });
}
