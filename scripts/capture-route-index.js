import { Agent, request } from 'undici';
import { PATHS } from '../src/paths.js';
import { getConfig } from '../src/config.js';
import { writeJson } from '../src/utils.js';

const config = getConfig();
const dispatcher = config.allowInsecureTls
  ? new Agent({
      connect: {
        rejectUnauthorized: false
      }
    })
  : undefined;

const response = await request(config.routeCaptureUrl, {
  method: 'GET',
  ...(dispatcher ? { dispatcher } : {}),
  headers: {
    Accept: 'application/json',
    'User-Agent': config.userAgent
  }
});

const body = await response.body.json();
writeJson(PATHS.liveSpec, body);
console.log(`Captured ${Object.keys(body.routes || {}).length} routes to ${PATHS.liveSpec}`);
