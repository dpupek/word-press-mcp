# Troubleshooting

## Auth Works In Browser But Fails In MCP

Likely causes:

- using `http` instead of `https`
- wrong application password
- missing environment variables in the current shell

Check:

```powershell
$env:WP_SITE_URL
$env:WP_USERNAME
$env:WP_APP_PASSWORD
```

## First `npx` Run Is Slow Or Fails Before Startup

Git-based `npx` installs run the package `prepare` step on first install.

Expected behavior:

- the first run is slower than later runs
- dev dependencies are installed during that first setup
- if `prepare` fails, the MCP server never starts

Check:

```powershell
npm run smoke:package
```

If you are using Codex, server `stderr` is captured in the Codex log file, which is the right place to inspect startup/build failures.

Typical Codex location:

- `C:\Users\<your-user>\.codex\log\codex-tui.log`

Optional runtime logging controls:

- `WORDPRESS_MCP_DEBUG=true`
- `WORDPRESS_MCP_LOG_FILE=C:\path\to\wordpress-mcp.log`

## TLS Errors In Node

Symptom:

- self-signed certificate
- untrusted certificate chain

Use only for test environments:

```powershell
$env:WORDPRESS_MCP_ALLOW_INSECURE_TLS='true'
```

## HTML Returned Instead Of JSON

Likely causes:

- login page or auth redirect
- proxy error page
- plugin-specific admin confirmation flow

Special known case:

- deleting an `elementor_library` kit can return an Elementor site-settings confirmation page instead of REST JSON

## Elementor Route Exists But Returns 403

That is a route-level permission or behavior issue, not necessarily a bad login.

On the current test site:

- `elementor/v1/post` still returns `403`

Prefer:

- `wp/v2/*`
- `elementor/v1/site-editor/*`
- the guarded workflow tools already implemented in this repo

## Live Smoke Leaves Behind Templates

This can happen when Elementor blocks kit deletion with a confirmation flow.

When that happens:

- do not retry blindly
- capture the leftover `elementor_library` ID
- treat it as a special-case admin cleanup task

## Browser Pass Shows Frontend Errors

Separate site issues from MCP issues.

Example current finding on the test site:

- missing `favicon.ico` returns `404`

That is worth documenting, but it does not mean the MCP publish flow failed.
