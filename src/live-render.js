import crypto from 'node:crypto';
import { Agent, request as undiciRequest } from 'undici';

function unique(values) {
  return [...new Set(values.filter(Boolean))];
}

export function hashContent(value) {
  return crypto.createHash('sha256').update(String(value || ''), 'utf8').digest('hex');
}

export function findTextMatches(text, markers = []) {
  const source = String(text || '');
  return unique((markers || []).filter((marker) => typeof marker === 'string' && marker && source.includes(marker)));
}

export function extractGeneratedCssUrls(html, baseUrl) {
  const source = String(html || '');
  const matches = [...source.matchAll(/<link[^>]+href=["']([^"']*elementor\/css\/[^"']+)["']/gi)];
  return unique(
    matches.map((match) => {
      const href = match[1];
      try {
        return new URL(href, baseUrl).toString();
      } catch {
        return href;
      }
    })
  );
}

export function inspectRenderedHtml(html, { expectedText = [], forbiddenText = [] } = {}) {
  return {
    htmlHash: hashContent(html),
    expectedTextFound: findTextMatches(html, expectedText),
    forbiddenTextFound: findTextMatches(html, forbiddenText)
  };
}

export function createLiveRenderReader(config, transport = {}) {
  const requestImpl = transport.request || undiciRequest;
  const AgentCtor = transport.Agent || Agent;
  const dispatcher = config.allowInsecureTls
    ? new AgentCtor({
        connect: {
          rejectUnauthorized: false
        }
      })
    : undefined;

  return {
    async read(url) {
      const response = await requestImpl(url, dispatcher ? { dispatcher } : {});
      const html = await response.body.text();
      return {
        url,
        statusCode: response.statusCode,
        html
      };
    }
  };
}
