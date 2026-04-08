---
name: wordpress-elementor-live-validation
description: Run live validation against the WordPress MCP server and a target WordPress site when the goal is to prove authenticated reads, guarded Elementor workflows, disposable content publishing, cleanup behavior, or browser rendering. Use for smoke tests, environment checks, HTTPS/TLS troubleshooting, Elementor restore/media-import validation, or Playwright walkthroughs of disposable test content.
---

# WordPress Elementor Live Validation

Use this skill when the goal is environment validation, not normal authoring.

Keep the work disposable. Create test posts or templates only when needed to prove behavior, and clean them up when the site allows it.

## Preconditions

- Require `WP_SITE_URL`, `WP_USERNAME`, and `WP_APP_PASSWORD` in the current shell.
- Prefer `https` for live validation. On the current NexPort test site, plain `http` causes application-password auth to fail with `rest_not_logged_in`.
- If the target site has an untrusted certificate chain, set `WORDPRESS_MCP_ALLOW_INSECURE_TLS=true` explicitly for the validation run.

## Preferred Validation Order

1. Run `npm run smoke:live`.
2. Review the JSON result before doing anything manual.
3. If browser verification matters, open the disposable published post with Playwright MCP.
4. Capture any cleanup failures as operator guidance instead of forcing destructive workarounds.

## What `npm run smoke:live` Proves

- authenticated create/delete on standard posts
- Elementor template clone on a disposable draft
- live revision creation
- `workflow_restore_elementor_candidate` in `plan` and `execute`
- `workflow_import_elementor_document_media` in `execute`
- cleanup behavior for both standard posts and Elementor kits

## Interpretation Rules

- A successful post create/delete proves the auth path and standard WordPress writes are healthy.
- A successful clone/restore/media-import sequence proves the guarded Elementor workflow surface is healthy enough for operator use.
- If cleanup fails for an `elementor_library` item with `elementor_kit_delete_confirmation`, do not force deletion through a guessed endpoint. Report the leftover IDs and treat kit deletion as a special-case admin flow.
- If Playwright shows the disposable post rendering correctly, content publishing and public routing are working.
- Treat unrelated site issues, such as missing favicon requests, as environment findings rather than MCP failures.

## Playwright Pass

Use Playwright only after the smoke script gives you a disposable published post URL.

Minimum pass:

1. Navigate to the home page and capture console messages.
2. Navigate to the disposable published post URL.
3. Capture an accessibility snapshot and console messages.
4. Confirm the title and article body render as expected.

## Known Site Lessons

- `https://test.nexportsolutions.com` authenticates the `test` account as an administrator with an application password.
- The same site currently requires `WORDPRESS_MCP_ALLOW_INSECURE_TLS=true` for Node-based live validation.
- `elementor/v1/post` still returns `403`, so prefer the guarded WordPress-core and site-editor workflows.
- Deleting an Elementor kit can return an HTML confirmation page instead of JSON. The repo translates this to `elementor_kit_delete_confirmation`.

## Output

Report:

- whether the smoke passed
- disposable artifact IDs and which ones were cleaned up
- any leftover IDs blocked by Elementor kit deletion
- browser findings from Playwright
- any actionable environment problems such as TLS issues, auth mismatches, or frontend 404s
