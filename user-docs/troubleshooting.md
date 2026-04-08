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
