# Roadmap

## Iteration 1
- [x] Build package foundation, config, logging, and MCP bootstrap.
- [x] Capture live route index and generate endpoint manifest.

## Iteration 2
- [x] Register generated endpoint tools with validation and safe-mode confirmation.
- [x] Add shared client and error translation.

## Iteration 3
- [x] Generate tool catalog and static help resources.
- [x] Add core workflow tools.

## Iteration 4
- [x] Expand workflow execution paths beyond planning where needed.
- [x] Add guarded Elementor workflows for clone, diff, validation, history inspection, media import, and revision/autosave restore.
- [x] Live-validate Elementor clone, revision creation, restore, and media-import flows against `https://test.nexportsolutions.com`.
- [x] Add an opt-in insecure TLS switch for test environments with untrusted certificates.
- [x] Add a reusable live smoke script for authenticated WordPress and Elementor workflow validation.
- [ ] Add more site-specific overrides if additional plugin routes need specialized handling.
- [ ] Add a special-case workflow for Elementor kit deletion or a validated admin-confirmation path.

## Progress Notes
- Route capture and generated parity now reflect 501 operations from the refreshed HTTPS snapshot.
- The `test` account authenticates as an administrator over HTTPS with an application password.
- Plain HTTP returns `rest_not_logged_in` for the same auth flow, so all live validation should use HTTPS.
- Node-based live validation on the test site currently requires `WORDPRESS_MCP_ALLOW_INSECURE_TLS=true` because the TLS chain is not trusted.
- Live Playwright inspection confirmed the disposable published post rendered correctly.
- The public home page currently has a missing `favicon.ico` request returning `404`.
