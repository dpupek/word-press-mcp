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

## Install

```powershell
git clone https://github.com/dpupek/word-press-mcp.git
cd word-press-mcp
npm install
```

## Required Environment

```powershell
$env:WP_SITE_URL='https://example.com'
$env:WP_USERNAME='your-user'
$env:WP_APP_PASSWORD='your-app-password'
```

Optional for test environments with untrusted TLS:

```powershell
$env:WORDPRESS_MCP_ALLOW_INSECURE_TLS='true'
```

## Run the Server

```powershell
node index.js
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
