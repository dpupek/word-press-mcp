# GitHub Release Channels

This project supports GitHub-based `npx` installs without publishing to npm.

## Supported Selectors

- default branch:
  - `npx --yes -p github:dpupek/word-press-mcp wordpress-mcp`
- latest stable:
  - `npx --yes -p github:dpupek/word-press-mcp#latest-release wordpress-mcp`
- latest beta, once a prerelease tag exists:
  - `npx --yes -p github:dpupek/word-press-mcp#beta-release wordpress-mcp`
- exact stable:
  - `npx --yes -p github:dpupek/word-press-mcp#v1.0.0 wordpress-mcp`
- exact beta:
  - `npx --yes -p github:dpupek/word-press-mcp#v1.1.0-beta.1 wordpress-mcp`

## Tag Pattern

Use these refs consistently:

- `main`
  - moving development/default branch
- `latest-release`
  - moving tag that always points to the newest stable release commit
- `beta-release`
  - moving tag that always points to the newest beta release commit
- `vX.Y.Z`
  - immutable stable version tag
- `vX.Y.Z-beta.N`
  - immutable beta version tag

## Recommended Release Flow

### Stable release

1. update `package.json` version to the stable version
2. commit the release changes
3. create the immutable version tag:
   - `git tag v1.0.0`
4. move the stable channel tag to the same commit:
   - `git tag -f latest-release`
5. push branch and tags:
   - `git push origin main`
   - `git push origin v1.0.0`
   - `git push origin -f latest-release`

### Beta release

1. update `package.json` version to the beta version
2. commit the beta release changes
3. create the immutable beta tag:
   - `git tag v1.1.0-beta.1`
4. move the beta channel tag to the same commit:
   - `git tag -f beta-release`
5. push branch and tags:
   - `git push origin main`
   - `git push origin v1.1.0-beta.1`
   - `git push origin -f beta-release`

## Important Rules

- Treat `vX.Y.Z` and `vX.Y.Z-beta.N` tags as immutable.
- Only `latest-release` and `beta-release` should move.
- Keep the version in `package.json` aligned with the immutable release tag created for that commit.
- Do not rely on `main` for reproducible installs; use an immutable version tag instead.
- Use `latest-release` and `beta-release` for channel-based installs only.
- If no beta has been published yet, `beta-release` should not exist.

## Suggested Client Configs

### Latest stable

```toml
[mcp_servers.wordpress]
type = "stdio"
command = "npx"
args = ["--yes", "-p", "github:dpupek/word-press-mcp#latest-release", "wordpress-mcp"]
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

### Latest beta

```toml
[mcp_servers.wordpress_beta]
type = "stdio"
command = "npx"
args = ["--yes", "-p", "github:dpupek/word-press-mcp#beta-release", "wordpress-mcp"]
startup_timeout_sec = 200
shutdown_timeout_sec = 5
tool_timeout_sec = 90
description = "WordPress MCP server with generated endpoint coverage and guarded Elementor workflows"
[mcp_servers.wordpress_beta.env]
WP_SITE_URL = "https://example.com"
WP_USERNAME = "your-user"
WP_APP_PASSWORD = "your-app-password"
WORDPRESS_MCP_SAFE_MODE = "true"
```

### Exact version

```toml
[mcp_servers.wordpress_pinned]
type = "stdio"
command = "npx"
args = ["--yes", "-p", "github:dpupek/word-press-mcp#v1.0.0", "wordpress-mcp"]
startup_timeout_sec = 200
shutdown_timeout_sec = 5
tool_timeout_sec = 90
description = "WordPress MCP server with generated endpoint coverage and guarded Elementor workflows"
[mcp_servers.wordpress_pinned.env]
WP_SITE_URL = "https://example.com"
WP_USERNAME = "your-user"
WP_APP_PASSWORD = "your-app-password"
WORDPRESS_MCP_SAFE_MODE = "true"
```
