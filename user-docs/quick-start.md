# Quick Start

## What This Server Does

The WordPress MCP server gives an MCP client two ways to work:

- low-level generated endpoint tools for WordPress and plugin REST routes
- higher-level workflow tools for posts, media, taxonomy, and Elementor operations

## Prerequisites

- Node.js 20+
- npm
- a WordPress site with REST API access
- a WordPress user with an Application Password

## Primary Path: Configure Your MCP Client With `npx`

For most users, the right starting point is to add this server to your MCP settings instead of cloning the repo.

Example configuration:

```toml
[mcp_servers.wordpress]
type = "stdio"
command = "npx"
args = ["--yes", "-p", "github:dpupek/word-press-mcp", "wordpress-mcp"]
startup_timeout_sec = 20
shutdown_timeout_sec = 5
tool_timeout_sec = 90
description = "WordPress MCP server with generated endpoint coverage and guarded Elementor workflows"

env = { "WP_SITE_URL" = "https://example.com", "WP_USERNAME" = "your-user", "WP_APP_PASSWORD" = "your-app-password", "WORDPRESS_MCP_SAFE_MODE" = "true" }
```

Use this extra setting only for test environments with untrusted certificates:

```toml
"WORDPRESS_MCP_ALLOW_INSECURE_TLS" = "true"
```

The first `npx` launch is expected to be slower than later launches because npm has to install dependencies and run the package `prepare` step before the MCP server starts.

## Required Environment

The required settings are:

- `WP_SITE_URL`
- `WP_USERNAME`
- `WP_APP_PASSWORD`

Recommended optional settings:

- `WORDPRESS_MCP_SAFE_MODE=true`
- `WORDPRESS_MCP_ALLOW_INSECURE_TLS=true` only for test environments with broken or self-signed TLS

## Alternative Path: Install And Run Locally

Use this when you want to develop, debug, or run the server from a checkout.

```powershell
git clone https://github.com/dpupek/word-press-mcp.git
cd word-press-mcp
npm install
```

Set environment variables in your shell:

```powershell
$env:WP_SITE_URL='https://example.com'
$env:WP_USERNAME='your-user'
$env:WP_APP_PASSWORD='your-app-password'
```

Optional for test environments with untrusted TLS:

```powershell
$env:WORDPRESS_MCP_ALLOW_INSECURE_TLS='true'
```

Run the server:

```powershell
node index.js
```

If you want to validate the same fresh-install path that git-based `npx` uses:

```powershell
npm run smoke:package
```

## Verify the Build

```powershell
npm test
npm run verify:parity
```

## Run the Live Smoke Test

```powershell
npm run smoke:live
```

This will:

- create a disposable published post
- clone an Elementor template draft
- create revisions
- run restore and media-import workflows
- delete disposable posts
- report if Elementor blocks template-kit cleanup

## First Workflow Tools To Use

- `health`
- `help`
- `tool_catalog`
- `workflow_list_menu_structure`
- `workflow_upsert_menu_item`
- `workflow_assign_menu_locations`
- `workflow_get_post_urls`
- `workflow_inspect_post`
- `workflow_taxonomy_reconcile`
- `workflow_draft_or_update_post`
- `workflow_inspect_elementor_document`
- `workflow_validate_elementor_document`

## Safe Default

For risky Elementor work, use this order:

1. inspect
2. validate
3. diff
4. restore if rollback is the goal
5. clone or media import
6. only then broader writes
