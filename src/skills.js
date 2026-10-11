import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { TextDecoder } from 'node:util';
import { parse } from 'yaml';
import { z } from 'zod';
import { McpError, ErrorCode } from '@modelcontextprotocol/sdk/types.js';
import { PATHS } from './paths.js';
import { jsonResult } from './utils.js';

const IMPORT_SKILLS = new Set([
  'wordpress-mcp-operations', 'wordpress-router', 'wp-project-triage', 'wp-rest-api', 'wp-wpcli-and-ops'
]);
const PAGE_SIZE = 5;
const invalid = (message) => new McpError(ErrorCode.InvalidParams, message);

export function createSkillCatalog({ root = PATHS.skills, profile = 'all' } = {}) {
  if (!['all', 'import'].includes(profile)) throw invalid('Skill catalog must be all or import.');
  const resources = new Map();
  const entries = [];
  function addFiles(directory, name, relative = '') {
    const manifest = [];
    for (const file of fs.readdirSync(directory, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
      if (file.isSymbolicLink()) throw invalid('Packaged skills cannot contain symbolic links.');
      const filePath = path.join(directory, file.name);
      const resourcePath = relative ? `${relative}/${file.name}` : file.name;
      if (file.isDirectory()) {
        manifest.push(...addFiles(filePath, name, resourcePath));
      } else if (file.isFile()) {
        const bytes = fs.readFileSync(filePath);
        const uri = `skill://wordpress-mcp/${name}/${resourcePath}`;
        const extension = path.extname(file.name);
        let content;
        try {
          const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
          const mimeType = { '.md': 'text/markdown', '.json': 'application/json', '.mjs': 'text/javascript', '.js': 'text/javascript', '.yaml': 'application/yaml', '.yml': 'application/yaml' }[extension] || 'text/plain';
          content = { uri, mimeType, text };
          // Preserve a UTF-8 BOM, if present, so the returned bytes match the digest.
          if (!Buffer.from(text).equals(bytes)) content = { uri, mimeType: 'application/octet-stream', blob: bytes.toString('base64') };
        } catch {
          content = { uri, mimeType: 'application/octet-stream', blob: bytes.toString('base64') };
        }
        resources.set(uri, content);
        manifest.push({ uri, digest: `sha256:${crypto.createHash('sha256').update(bytes).digest('hex')}`, size: bytes.length });
      }
    }
    return manifest;
  }
  for (const directory of fs.readdirSync(root, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
    if (directory.isSymbolicLink()) throw invalid('Packaged skills cannot contain symbolic links.');
    if (!directory.isDirectory()) continue;
    const skillPath = path.join(root, directory.name, 'SKILL.md');
    if (!fs.existsSync(skillPath)) continue;
    const markdown = fs.readFileSync(skillPath, 'utf8');
    const match = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(markdown);
    if (!match) throw invalid(`Missing frontmatter for ${directory.name}.`);
    const frontmatter = parse(match[1]);
    if (!frontmatter || frontmatter.name !== directory.name || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(directory.name) || typeof frontmatter.description !== 'string') {
      throw invalid(`Invalid skill metadata for ${directory.name}.`);
    }
    entries.push({ uri: `skill://wordpress-mcp/${directory.name}/SKILL.md`, frontmatter, resources: addFiles(path.dirname(skillPath), directory.name) });
  }
  const byUri = new Map(entries.map((entry) => [entry.uri, entry]));
  const listed = profile === 'import' ? entries.filter((entry) => IMPORT_SKILLS.has(entry.frontmatter.name)) : entries;
  if (profile === 'import' && listed.length !== IMPORT_SKILLS.size) throw invalid('Import catalog is incomplete.');
  return {
    entries,
    list({ cursor } = {}) {
      const offset = cursor === undefined ? 0 : /^skills:[1-9]\d*$/.test(cursor) ? Number(cursor.slice(7)) : NaN;
      if (!Number.isSafeInteger(offset) || (cursor !== undefined && offset >= listed.length)) throw invalid('Invalid skills cursor.');
      const skills = listed.slice(offset, offset + PAGE_SIZE);
      return { skills, ...(offset + PAGE_SIZE < listed.length ? { nextCursor: `skills:${offset + PAGE_SIZE}` } : {}) };
    },
    get(uri) {
      const entry = byUri.get(uri);
      if (!entry) throw invalid('Unknown skill URI.');
      return entry;
    },
    read(uri) {
      const content = resources.get(uri);
      if (!content) throw invalid('Unknown skill resource URI.');
      return content;
    },
    readFile(name, file) {
      // Exact catalog lookup only: no caller-controlled filesystem access.
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name) || file.split('/').some((segment) => !segment || segment === '.' || segment === '..') || file.includes('\\')) {
        throw invalid('Invalid skill file path.');
      }
      return this.read(`skill://wordpress-mcp/${name}/${file}`);
    }
  };
}

export function registerSkillSurfaces(server, options = {}) {
  const catalog = createSkillCatalog(options);
  server.server.registerCapabilities({ extensions: { 'io.modelcontextprotocol/skills': {} } });
  server.server.setRequestHandler(z.object({ method: z.literal('skills/list'), params: z.object({ cursor: z.string().optional() }).passthrough().optional() }), async ({ params }) => catalog.list(params));
  server.server.setRequestHandler(z.object({ method: z.literal('skills/get'), params: z.object({ uri: z.string() }).passthrough() }), async ({ params }) => ({ skill: catalog.get(params.uri) }));
  for (const entry of catalog.entries) {
    for (const resource of entry.resources) {
      const content = catalog.read(resource.uri);
      server.registerResource(resource.uri === entry.uri ? entry.frontmatter.name : resource.uri, resource.uri, {
        mimeType: content.mimeType,
        ...(resource.uri === entry.uri ? { description: entry.frontmatter.description } : {})
      }, async () => ({ contents: [content] }));
    }
  }
  function tool(name, description, inputSchema, handler) {
    server.registerTool(name, { description, inputSchema, annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: false } }, async (args) => {
      try { return jsonResult({ ok: true, ...handler(args) }); }
      catch (error) { return { ...jsonResult({ ok: false, error: error.message }), isError: true }; }
    });
  }
  tool('list_skills', 'Discover bundled WordPress skills and their requirements. Returns metadata only; load relevant guidance with read_skill.', {}, () => ({ skills: catalog.entries.map((entry) => ({ uri: entry.uri, ...entry.frontmatter })) }));
  tool('read_skill', 'Read a bundled WordPress skill and its supporting-file manifest. Reading guidance does not grant permissions or execute scripts.', { name: z.string() }, ({ name }) => {
    const skill = catalog.get(`skill://wordpress-mcp/${name}/SKILL.md`);
    return { skill, content: catalog.read(skill.uri) };
  });
  tool('read_skill_file', 'Read one cataloged supporting file using its skill name and relative path. No scripts are executed.', { name: z.string(), file: z.string() }, ({ name, file }) => ({ content: catalog.readFile(name, file) }));
  return catalog;
}
