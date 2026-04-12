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
startup_timeout_sec = 200
shutdown_timeout_sec = 5
tool_timeout_sec = 90
description = "WordPress MCP server with generated endpoint coverage and guarded Elementor workflows"
[mcp_servers.wordpress.env]
WP_SITE_URL = "https://example.com"
WP_USERNAME = "your-user"
WP_APP_PASSWORD = "your-app-password"
WORDPRESS_MCP_SAFE_MODE = "true"
```

Use this extra setting only for test environments with untrusted certificates:

```toml
WORDPRESS_MCP_ALLOW_INSECURE_TLS = "true"
```

The first `npx` launch is expected to be slower than later launches because npm has to install dependencies and run the package `prepare` step before the MCP server starts.

## GitHub-Based Version Selectors

Use these forms when you want to control which GitHub ref `npx` installs:

- default `main` branch:
  - `args = ["--yes", "-p", "github:dpupek/word-press-mcp", "wordpress-mcp"]`
- latest stable release:
  - `args = ["--yes", "-p", "github:dpupek/word-press-mcp#latest-release", "wordpress-mcp"]`
- latest beta release, once a prerelease tag exists:
  - `args = ["--yes", "-p", "github:dpupek/word-press-mcp#beta-release", "wordpress-mcp"]`
- exact version:
  - `args = ["--yes", "-p", "github:dpupek/word-press-mcp#v1.0.0", "wordpress-mcp"]`

Meaning:

- `main` is the moving development/default branch
- `latest-release` is the moving stable channel tag
- `beta-release` is the moving beta channel tag when a beta has been published
- `vX.Y.Z` and `vX.Y.Z-beta.N` are immutable version tags

For the detailed tagging process, see [GitHub Release Channels](github-release-channels.md).

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

To validate the classic menu workflows against a live site:

```powershell
npm run smoke:live:menus
```

This will:

- create a disposable classic menu
- add disposable custom menu items
- reorder the menu into a parent/child structure
- clone the menu
- report available menu locations in plan mode
- delete both disposable menus

## First Workflow Tools To Use

- `health`
- `workflow_get_site_identity`
- `help`
- `tool_catalog`
- `workflow_list_menu_structure`
- `workflow_upsert_menu_item`
- `workflow_assign_menu_locations`
- `workflow_reorder_menu_items`
- `workflow_clone_menu`
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
