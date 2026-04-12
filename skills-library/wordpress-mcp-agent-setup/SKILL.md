---
name: wordpress-mcp-agent-setup
description: Install and configure the WordPress MCP server for Codex agents, including dependency setup with winget/npm, config.toml MCP entries with per-site naming conventions, environment variable guidance, and discovery of help/resources. Use when an agent needs to onboard or reconfigure WordPress MCP access.
---

# WordPress MCP Agent Setup

## Overview

Install required dependencies, add a per-site MCP entry to the Codex config, and validate that the help and orientation resources load correctly.

## Workflow

### 1. Install dependencies (Windows)

Use winget to install Node.js and Git, then verify `node` and `npm`:

```powershell
winget install --id OpenJS.NodeJS.LTS -e
winget install --id Git.Git -e
node -v
npm -v
```

If `npx` is missing after install, close and reopen the terminal so PATH refreshes.

### 2. Choose a per-site MCP name

Use one MCP entry per WordPress site. Recommended naming:

- `nexport_solutions_wordpress`
- `dg_wordpress`
- `test_wordpress`
- `<org>_wordpress`

### 3. Prepare config.toml block

Create a block using a separate `env` section. Increase startup time for GitHub-based `npx` installs.

```toml
[mcp_servers.nexport_solutions_wordpress]
type = "stdio"
command = "npx"
args = ["--yes", "-p", "github:dpupek/word-press-mcp#latest-release", "wordpress-mcp"]
startup_timeout_sec = 200
shutdown_timeout_sec = 5
tool_timeout_sec = 90
description = "WordPress MCP server with generated endpoint coverage and guarded Elementor workflows"

[mcp_servers.nexport_solutions_wordpress.env]
WP_SITE_URL = "https://example.com/"
WP_USERNAME = "your-user"
WP_APP_PASSWORD = "your-app-password"
WORDPRESS_MCP_SAFE_MODE = "true"
WORDPRESS_MCP_DEBUG = "1"
WORDPRESS_MCP_ALLOW_INSECURE_TLS = "true"
```

Notes:

- Use `WORDPRESS_MCP_ALLOW_INSECURE_TLS` only for test environments with self-signed TLS.
- Keep `WORDPRESS_MCP_SAFE_MODE` enabled unless explicitly told to disable safety gating.

### 4. Offer to open config.toml

Ask the user if they want the file opened for editing. If yes:

- VS Code: `code "$env:USERPROFILE\\.codex\\config.toml"`
- Notepad fallback: `notepad "$env:USERPROFILE\\.codex\\config.toml"`

### 5. Validate MCP help and docs

After the MCP entry is set:

1. Call `help` to confirm the help resource loads.
2. Call `agent_bootstrap` for first-time orientation steps.
3. If needed, reference local docs:
   - `user-docs/quick-start.md`
   - `user-docs/github-release-channels.md`
   - `docs/agent-bootstrap.md`

### 6. Optional: smoke sanity

Run a quick check:

- `workflow_get_site_identity`
- `wp_v2_pages_list` (small page size)
- `wp_v2_posts_list` (small page size)

If calls fail with TLS errors, confirm `WORDPRESS_MCP_ALLOW_INSECURE_TLS` is set for the site.
