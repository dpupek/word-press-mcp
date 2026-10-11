import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { z } from 'zod';
import { PATHS } from '../src/paths.js';
import { createSkillCatalog, registerSkillSurfaces } from '../src/skills.js';

test('skill catalog: preserves pinned upstream files and exposes every file with a matching digest', () => {
  const provenance = JSON.parse(fs.readFileSync(path.join(PATHS.skills, 'upstream.json')));
  assert.match(provenance.commit, /^[a-f0-9]{40}$/);
  for (const [file, digest] of Object.entries(provenance.files)) {
    const bytes = fs.readFileSync(path.join(PATHS.skills, file));
    assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'), digest, file);
  }
  const catalog = createSkillCatalog();
  assert.equal(catalog.entries.length, provenance.skills.length + 1);
  for (const entry of catalog.entries) {
    assert.equal(entry.uri, `skill://wordpress-mcp/${entry.frontmatter.name}/SKILL.md`);
    assert.ok(entry.resources.some((resource) => resource.uri === entry.uri));
    for (const resource of entry.resources) {
      const content = catalog.read(resource.uri);
      const bytes = 'text' in content ? Buffer.from(content.text) : Buffer.from(content.blob, 'base64');
      assert.equal(resource.digest, `sha256:${crypto.createHash('sha256').update(bytes).digest('hex')}`);
      assert.equal(resource.size, bytes.length);
    }
  }
});

test('skill catalog: bounds import listing, paginates full listing, and rejects unknown or escaping paths', () => {
  const catalog = createSkillCatalog({ profile: 'import' });
  assert.equal(catalog.list().skills.length, 5);
  assert.ok(catalog.get('skill://wordpress-mcp/wpds/SKILL.md'));
  const full = createSkillCatalog();
  const uris = [];
  let cursor;
  do {
    const page = full.list({ cursor });
    uris.push(...page.skills.map((skill) => skill.uri));
    cursor = page.nextCursor;
  } while (cursor);
  assert.equal(new Set(uris).size, full.entries.length);
  for (const invalid of ['../LICENSE', 'references/../../upstream.json', 'references\\..\\SKILL.md', '/etc/passwd']) {
    assert.throws(() => full.readFile('wp-rest-api', invalid));
  }
  assert.throws(() => full.readFile('../wp-rest-api', 'SKILL.md'));
  assert.throws(() => full.read('file:///etc/passwd'));
  assert.throws(() => full.list({ cursor: 'skills:999999' }));
  assert.throws(() => createSkillCatalog({ profile: 'invalid' }));
});

test('skill protocol: negotiates extension and serves identical content through protocol and fallback tools', async () => {
  const server = new McpServer({ name: 'skills-test', version: '1.0.0' });
  registerSkillSurfaces(server, { profile: 'import' });
  const client = new Client({ name: 'skills-test-client', version: '1.0.0' });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  try {
    await client.connect(clientTransport);
    assert.ok(client.getServerCapabilities().extensions['io.modelcontextprotocol/skills']);
    assert.ok(client.getServerCapabilities().resources);
    const list = await client.request({ method: 'skills/list', params: {} }, z.object({ skills: z.array(z.any()) }));
    assert.equal(list.skills.length, 5);
    const uri = 'skill://wordpress-mcp/wp-rest-api/SKILL.md';
    const get = await client.request({ method: 'skills/get', params: { uri } }, z.object({ skill: z.any() }));
    assert.deepEqual(get.skill, list.skills.find((skill) => skill.uri === uri));
    const resource = await client.readResource({ uri });
    const tool = await client.callTool({ name: 'read_skill', arguments: { name: 'wp-rest-api' } });
    assert.equal(JSON.parse(tool.content[0].text).content.text, resource.contents[0].text);
    const fileUri = get.skill.resources.find((file) => file.uri.endsWith('/references/authentication.md')).uri;
    const file = await client.callTool({ name: 'read_skill_file', arguments: { name: 'wp-rest-api', file: 'references/authentication.md' } });
    assert.deepEqual(JSON.parse(file.content[0].text).content, (await client.readResource({ uri: fileUri })).contents[0]);
    const fallback = await client.callTool({ name: 'list_skills', arguments: {} });
    assert.equal(JSON.parse(fallback.content[0].text).skills.length, 20);
    const rejected = await client.callTool({ name: 'read_skill_file', arguments: { name: 'wp-rest-api', file: '../upstream.json' } });
    assert.equal(rejected.isError, true);
    await assert.rejects(() => client.request({ method: 'skills/get', params: { uri: 'skill://wordpress-mcp/missing/SKILL.md' } }, z.any()));
  } finally {
    await client.close();
    await server.close();
  }
});
