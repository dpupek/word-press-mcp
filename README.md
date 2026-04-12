# WordPress MCP Server

A Model Context Protocol (MCP) server that lets **Codex** and other MCP clients work directly with **WordPress REST APIs**, including strong support for **Elementor-aware workflows**, **input validation**, and **actionable error handling**.

This project is designed for two realities at once:

- generic WordPress installs that expose the standard `wp/v2` API surface
- real, plugin-heavy production sites where routes, permissions, TLS, and editor behavior are messy

The result is an MCP server that gives agents both:

- broad low-level endpoint coverage generated from live route data
- higher-level workflow tools for the operations people actually need to complete

---

## Why This Server

Most WordPress automation falls into one of two bad patterns:

- a thin wrapper around raw REST calls with weak validation
- a highly opinionated site script that breaks outside one environment

This server is meant to sit in the middle:

- **Generated parity layer** for broad WordPress and plugin route coverage
- **Guarded workflow tools** for posts, media, taxonomy, and Elementor document operations
- **Strong preflight validation** before writes
- **Safe-mode mutation gating** with `confirm: true`
- **Actionable MCP error envelopes** instead of opaque API failures

---

## What You Get

- 501 generated endpoint tools from the current captured live route surface
- static help and generated tool catalog resources
- workflow tools for:
  - post drafting and updating
  - featured image/media assignment
  - taxonomy reconciliation
  - post inspection
  - Elementor inspection and validation
  - Elementor revision/autosave inspection
  - Elementor document diffing
  - Elementor clone
  - guarded Elementor restore
  - guarded Elementor document media import
  - NexPort-specific publishing conventions
- live smoke validation script for disposable end-to-end testing

---

## Elementor Support

Elementor is not treated as a magic black box. The server understands the practical signals that matter:

- `_elementor_edit_mode`
- `_elementor_template_type`
- `_elementor_data`
- `_elementor_page_settings`
- `_elementor_conditions`

It can inspect, validate, diff, clone, restore, and re-import media for Elementor-backed documents without assuming undocumented save behavior is safe.

This project also captures site-specific lessons from live testing:

- application-password auth may work over `https` and fail over plain `http`
- some environments require explicit insecure-TLS opt-in for test certificates
- some Elementor routes still return `403` even for admin users
- deleting Elementor kits can trigger an HTML confirmation flow instead of normal REST JSON

---

## Quick Start

### Prerequisites

- Node.js 20+
- npm
- a WordPress account with Application Password support
- an MCP client such as Codex

### Configure Your MCP Client With `npx`

For most users, this is the fastest way to start. Add a server entry like this to your MCP settings:

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

If you need the current test-site behavior with an untrusted certificate chain, add:

```toml
WORDPRESS_MCP_ALLOW_INSECURE_TLS = "true"
```

Use that only for development or test environments.

The first `npx` run from GitHub is slower than later runs because npm installs dev dependencies and runs the package `prepare` step before the server starts.

### GitHub Release Channels For `npx`

This repo follows four GitHub-based install patterns:

- default branch build:
  - `npx --yes -p github:dpupek/word-press-mcp wordpress-mcp`
- latest stable release:
  - `npx --yes -p github:dpupek/word-press-mcp#latest-release wordpress-mcp`
- latest beta release, once a prerelease tag exists:
  - `npx --yes -p github:dpupek/word-press-mcp#beta-release wordpress-mcp`
- exact version:
  - `npx --yes -p github:dpupek/word-press-mcp#v1.0.0 wordpress-mcp`

Recommended meaning of each selector:

- `main`:
  current branch state, useful for development and immediate fixes
- `latest-release`:
  moving tag pointing to the newest stable release commit
- `beta-release`:
  moving tag pointing to the newest beta/prerelease commit when a beta has been published
- `vX.Y.Z` or `vX.Y.Z-beta.N`:
  immutable version tags for exact reproducibility

See [GitHub Release Channels](user-docs/github-release-channels.md) for the exact tagging pattern.

### Environment Variables

| Variable | Required | Purpose |
| --- | --- | --- |
| `WP_SITE_URL` | yes | Base site URL, for example `https://example.com` |
| `WP_USERNAME` | yes for authenticated reads/writes | WordPress username |
| `WP_APP_PASSWORD` | yes for authenticated reads/writes | WordPress Application Password |
| `WORDPRESS_MCP_SAFE_MODE` | optional | Defaults to enabled; mutating tools require `confirm: true` |
| `WORDPRESS_MCP_ALLOW_INSECURE_TLS` | optional | Explicit opt-in for self-signed/untrusted test certificates |
| `WORDPRESS_MCP_DEBUG` | optional | Enables additional stderr logging for startup and tool execution |
| `WORDPRESS_MCP_LOG_FILE` | optional | Appends structured logs to a file in addition to stderr |
| `WORDPRESS_MCP_ROUTE_CAPTURE_URL` | optional | Route-capture URL used by generator scripts |

### Alternative: Install And Run Locally

If you want to develop or run the server directly from a checkout:

```powershell
git clone https://github.com/dpupek/word-press-mcp.git
cd word-press-mcp
npm install
```

### Run in development

```powershell
node index.js
```

### Run the live smoke test

```powershell
$env:WP_SITE_URL='https://example.com'
$env:WP_USERNAME='your-user'
$env:WP_APP_PASSWORD='your-app-password'
npm run smoke:live
```

That script creates disposable content, exercises guarded Elementor workflows, and reports cleanup results.

### Packaging Smoke Check

To validate the fresh-install path used by git-based `npx` installs:

```powershell
npm run smoke:package
```

That command copies the repo to a temp directory, runs a fresh `npm install`, verifies the generated runtime artifacts exist, starts the MCP server briefly, and confirms it does not write protocol-breaking output to `stdout`.

---

## Project Layout

- [`src/`](src) — runtime, generator, client, workflows, error translation
- [`scripts/`](scripts) — route capture, generation, parity verification, live smoke
- [`spec/`](spec) — vendored route/source artifacts
- [`docs/`](docs) — generated catalog, helper docs, shaping docs
- [`user-docs/`](user-docs) — quick-start and operator-focused documentation
- [`test/`](test) — offline AAAA-style tests

---

## User Docs

Start here:

- [Quick Start](user-docs/quick-start.md)
- [Elementor Workflows](user-docs/elementor-workflows.md)
- [GitHub Release Channels](user-docs/github-release-channels.md)
- [Live Validation](user-docs/live-validation.md)
- [Troubleshooting](user-docs/troubleshooting.md)
- [Agent Test Checklist](user-docs/agent-mcp-test.md)

## Skills Library

This repo includes a curated skill library under [`skills-library/`](skills-library). The WordPress MCP setup skill lives here:

- [`skills-library/wordpress-mcp-agent-setup`](skills-library/wordpress-mcp-agent-setup)

---

## Validation

```powershell
npm test
npm run verify:parity
npm run smoke:live
```

---

## License

[MIT](LICENSE)
