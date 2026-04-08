# Live Validation

## Purpose

Use live validation when you need to prove that the server still works against a real WordPress site, not just offline tests.

## Required Environment

```powershell
$env:WP_SITE_URL='https://example.com'
$env:WP_USERNAME='your-user'
$env:WP_APP_PASSWORD='your-app-password'
```

If the site uses a self-signed or otherwise untrusted certificate:

```powershell
$env:WORDPRESS_MCP_ALLOW_INSECURE_TLS='true'
```

## Preferred Command

```powershell
npm run smoke:live
```

## What It Checks

- authenticated create/delete on a normal post
- Elementor clone on a disposable draft
- revision creation
- guarded restore workflow
- guarded media import workflow
- cleanup behavior

## Browser Validation

After smoke creates a disposable published post, use Playwright MCP to:

1. open the home page
2. collect console messages
3. open the disposable post URL
4. confirm title and body rendering
5. note any frontend issues unrelated to MCP behavior

## Current Test-Site Lessons

- use `https`, not `http`, for application-password auth
- Node clients may need `WORDPRESS_MCP_ALLOW_INSECURE_TLS=true`
- standard post cleanup works
- Elementor kit cleanup may be blocked by a confirmation flow

## Expected Cleanup Output

The smoke script should report:

- successful deletion of disposable posts
- either successful deletion of disposable templates or a structured `elementor_kit_delete_confirmation` error
