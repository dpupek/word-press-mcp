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
- [x] Add a special-case workflow for Elementor kit deletion or a validated admin-confirmation path.
- [x] Expand the menu workflow layer beyond inspection and simple upserts with reorder and clone operations.

## Iteration 5
- [x] Normalize environment handling inside the MCP server so callers receive actionable auth, permission, TLS, network, and site-configuration responses.
- [x] Add client-owned safe-read retry behavior for transient failures and authenticated `http` to `https` recovery when WordPress signals `rest_not_logged_in`.
- [x] Add a dedicated `agent_bootstrap` resource/tool so agents can orient to a site quickly without reading exhaustive reference material.
- [x] Add `workflow_get_post_urls` so preview/public URL retrieval is a first-class workflow instead of an inferred endpoint detail.
- [ ] Add more site-specific overrides if additional plugin routes need specialized handling.
- [ ] Add a dedicated site-identity workflow that returns site name, URL, current user, namespaces, and capability hints in one call.
- [x] Live-validate the expanded menu workflows against disposable menus on the test site.

## Progress Notes
- Route capture and generated parity now reflect 501 operations from the refreshed HTTPS snapshot.
- The `test` account authenticates as an administrator over HTTPS with an application password.
- The MCP client now auto-retries authenticated safe reads over `https` when an `http` site URL returns `rest_not_logged_in`, so that scheme mismatch is handled inside the server instead of by the caller.
- Node-based live validation on the test site currently requires `WORDPRESS_MCP_ALLOW_INSECURE_TLS=true` because the TLS chain is not trusted.
- Live Playwright inspection confirmed the disposable published post rendered correctly.
- Live smoke now cleans up disposable Elementor kits through the guarded `force_delete_kit` retry path when Elementor intercepts the standard delete.
- The menu workflow layer now supports structural inspection, item upsert, location assignment, reordering, and cloning.
- Disposable live menu validation succeeded on `https://test.nexportsolutions.com`: menu create, item create, hierarchical reorder, clone, and menu cleanup all worked through the workflow layer.
- The current test site exposes no classic menu locations, so location assignment remains validated only in `plan` mode there.
- The public home page currently has a missing `favicon.ico` request returning `404`.
