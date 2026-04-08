import fs from 'node:fs';
import path from 'node:path';

export function jsonResult(data) {
  return {
    content: [
      {
        type: 'text',
        mimeType: 'application/json',
        text: JSON.stringify(data, null, 2)
      }
    ]
  };
}

export function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

export function writeJson(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}

export function readTextIfExists(filePath, fallback = '') {
  try {
    return fs.readFileSync(filePath, 'utf8');
  } catch {
    return fallback;
  }
}

export function writeText(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, value, 'utf8');
}

export function uniqueBy(items, keyFn) {
  const seen = new Set();
  return items.filter((item) => {
    const key = keyFn(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function splitArgs(args, names) {
  const picked = {};
  const rest = {};
  for (const [key, value] of Object.entries(args || {})) {
    if (names.includes(key)) {
      picked[key] = value;
    } else {
      rest[key] = value;
    }
  }
  return { picked, rest };
}

export function sanitizeForLog(value) {
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') {
    if (value.length > 300) return `${value.slice(0, 300)}…`;
    return value;
  }
  if (Array.isArray(value)) return value.map((entry) => sanitizeForLog(entry));
  if (typeof value === 'object') {
    const out = {};
    for (const [key, entry] of Object.entries(value)) {
      if (/password|authorization|token|contentbase64/i.test(key)) {
        out[key] = '[redacted]';
      } else {
        out[key] = sanitizeForLog(entry);
      }
    }
    return out;
  }
  return value;
}
