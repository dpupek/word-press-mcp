import test from 'node:test';
import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { z } from 'zod';
import { PATHS } from '../src/paths.js';

test('server stdio: discovers skills and reads supporting resources without WordPress credentials', { timeout: 20000 }, async () => {
  const client = new Client({ name: 'wordpress-skills-smoke', version: '1.0.0' });
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [PATHS.root + '/index.js'],
    cwd: PATHS.root,
    stderr: 'pipe',
    env: {
      WP_SITE_URL: 'https://example.com', WP_USERNAME: '', WP_APP_PASSWORD: '',
      WORDPRESS_MCP_DEBUG: 'false', WORDPRESS_MCP_LOG_FILE: '', WORDPRESS_MCP_SKILL_CATALOG: 'import'
    }
  });
  try {
    await client.connect(transport);
    assert.ok(client.getServerCapabilities().extensions['io.modelcontextprotocol/skills']);
    const skills = await client.request({ method: 'skills/list', params: {} }, z.object({ skills: z.array(z.any()) }));
    assert.equal(skills.skills.length, 5);
    const tools = await client.listTools();
    for (const name of ['list_skills', 'read_skill', 'read_skill_file']) {
      assert.equal(tools.tools.find((tool) => tool.name === name).annotations.readOnlyHint, true);
    }
    const result = await client.callTool({ name: 'read_skill', arguments: { name: 'wordpress-mcp-operations' } });
    assert.equal(JSON.parse(result.content[0].text).ok, true);
    const uri = 'skill://wordpress-mcp/wp-rest-api/references/authentication.md';
    assert.match((await client.readResource({ uri })).contents[0].text, /auth/i);
  } finally {
    await client.close();
    await transport.close();
  }
});
