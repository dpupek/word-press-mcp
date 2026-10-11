# Bundled WordPress skills

This package includes 19 WordPress/agent-skills skills at the revision recorded
in `skills/upstream.json`, plus the MIT-licensed `wordpress-mcp-operations` skill.
Upstream files retain GPL-2.0-or-later notices; see `THIRD_PARTY_NOTICES.md`.

## Through an existing MCP connection

Reconnect after upgrading the server. No separate skills server is required.

1. Call `list_skills` for names, descriptions, and compatibility requirements.
2. Call `read_skill` with `name: "wordpress-mcp-operations"` for remote-site work.
3. Load another skill when relevant, for example `name: "wp-rest-api"`.
4. Read supporting files using `read_skill_file`, for example:
   `{"name":"wp-rest-api","file":"references/authentication.md"}`.

The read tools return content rather than relying on server-local filesystem
paths. Only files already in the bundled catalog are accessible. They cannot
read arbitrary files, install software, or execute the bundled scripts.

The server also advertises `io.modelcontextprotocol/skills` under
`capabilities.extensions`, implements `skills/list` and `skills/get`, and exposes
all manifest files through `resources/read`. URIs follow
`skill://wordpress-mcp/<skill-name>/<relative-file-path>`. Every manifest entry
includes its byte size and SHA-256 digest. Runtime content is captured when the
server starts, so digests and reads refer to the same snapshot.

## Native plugins

The repository and npm package include `.codex-plugin/plugin.json`,
`.claude-plugin/plugin.json`, and a shared `.mcp.json`, all using the same
`skills/` directory. Install the package as a local plugin through the host's
plugin installation flow. Node.js and dependencies must be installed in that
plugin directory (`npm ci` for a checkout, or npm package installation).

The MCP launch configuration uses `${CLAUDE_PLUGIN_ROOT}` to locate `index.js`;
the host must support plugin-root substitution. Configure `WP_SITE_URL`,
`WP_USERNAME`, and `WP_APP_PASSWORD` securely in the host/server environment.
Existing standalone MCP entries are independent of a new plugin entry; avoid
enabling two connections to the same site unintentionally. Do not put credentials
in committed plugin manifests. Native activation depends on the host; it is
separate from MCP resource delivery.

## Bounded OpenAI import profile

Set `WORDPRESS_MCP_SKILL_CATALOG=import` in the server environment before scanning
for plugin import. `skills/list` then lists exactly these five skills:

- `wordpress-mcp-operations`
- `wordpress-router`
- `wp-project-triage`
- `wp-rest-api`
- `wp-wpcli-and-ops`

The default `all` profile lists the full catalog with pagination. In either
profile, `skills/get`, `resources/read`, and fallback tools still serve every
bundled skill. References to skills outside the five-skill imported snapshot
must be fetched through the fallback tools or supplied by the full native plugin.

OpenAI's documented importer uses a submission-time snapshot, with a five-skill
limit. Rescan and submit a new plugin version after updating the bundle. This
server currently uses stdio; public submission requires a separately deployed
HTTPS MCP endpoint. Implementing the extension does not deploy that endpoint.

This implementation targets the static discovery/resource subset documented at
https://developers.openai.com/plugins/build/mcp-server#import-skills-from-the-mcp-server
on 2026-10-11. It does not claim newer protocol discovery, optional directory
methods, skill execution, or universal host activation support.

## Updating the pinned source

Clone WordPress/agent-skills to a temporary checkout and choose a reviewed full
commit SHA. From this repository run:

```powershell
node scripts/vendor-wordpress-skills.js C:/path/to/agent-skills FULL_COMMIT_SHA
```

The script reads Git blobs at that commit, rather than executing upstream code
or copying local modifications. It does not remove obsolete files: compare
the resulting directory with the new source when updating, and deliberately
remove obsolete upstream files or skills. Update the notice and run the skill
tests, full suite, spec parity, audit, and package smoke before release.

Upstream development workflows often need local WordPress source, Bash, PHP,
or WP-CLI. These are requirements to check, not capabilities supplied by this
REST server. Resolve `skills/<name>/...` references through the catalog;
materialize reviewed scripts in the host environment only when execution is
authorized and their tooling is available.
