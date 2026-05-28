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
- [x] Live-validate the expanded menu workflows against disposable menus on the test site.

## Iteration 6
- [x] Add a dedicated site-identity workflow that returns site name, URL, current user, namespaces, and capability hints in one call.
- [x] Expose the site-identity workflow in `agent_bootstrap` as the preferred first-call orientation path.
- [x] Add dedicated site-capability probes so agents can distinguish route presence from confirmed read/write/cache access.
- [x] Add explicit stored-vs-live render-state inspection with cache-aware staleness assessment.
- [x] Add safe Elementor widget/document patch workflows instead of relying on full `_elementor_data` replacement in common cases.
- [x] Add publish/cache-purge/live-verification orchestration for Elementor page updates.
- [x] Return structured Elementor validation findings while preserving legacy `issues` and `warnings` fields.
- [ ] Decide whether classic navigation/menu workflows need export/import helpers beyond the current clone and reorder coverage.

## Iteration 7
- [x] Live-validate the safe Elementor mutation and verification workflows against the AST site using the AST MCP credentials.
- [x] Add browser-based verification coverage for the disposable AST validation pass.
- [ ] Decide whether deeper frontend asset inspection needs a dedicated workflow beyond marker/hash verification.
- [ ] Decide whether reusable Elementor section/template upsert belongs in the next milestone or stays as a follow-on issue.

## Progress Notes
- Route capture and generated parity now reflect 500 operations from the refreshed HTTPS snapshot.
- The `test` account authenticates as an administrator over HTTPS with an application password.
- The MCP client now auto-retries authenticated safe reads over `https` when an `http` site URL returns `rest_not_logged_in`, so that scheme mismatch is handled inside the server instead of by the caller.
- Node-based live validation on the test site currently requires `WORDPRESS_MCP_ALLOW_INSECURE_TLS=true` because the TLS chain is not trusted.
- Live Playwright inspection confirmed the disposable published post rendered correctly.
- Live smoke now cleans up disposable Elementor kits through the guarded `force_delete_kit` retry path when Elementor intercepts the standard delete.
- The menu workflow layer now supports structural inspection, item upsert, location assignment, reordering, and cloning.
- Disposable live menu validation succeeded on `https://test.nexportsolutions.com`: menu create, item create, hierarchical reorder, clone, and menu cleanup all worked through the workflow layer.
- The repo now has repeatable live validation entry points for both major workflow surfaces: `npm run smoke:live` for post/Elementor flows and `npm run smoke:live:menus` for classic menu flows.
- Agents now have a single first-call orientation workflow, `workflow_get_site_identity`, instead of piecing site identity together from `health`, settings, and user endpoints manually.
- The current test site exposes no classic menu locations, so location assignment remains validated only in `plan` mode there.
- The public home page currently has a missing `favicon.ico` request returning `404`.
- The workflow surface now includes `workflow_get_site_capabilities`, `workflow_get_live_render_state`, `workflow_update_elementor_widget`, `workflow_patch_elementor_document`, and `workflow_publish_and_verify_elementor_page`.
- Elementor validation now emits structured `findings` entries while preserving the legacy `issues` and `warnings` arrays for existing callers.
- Safe patching now distinguishes true widget-setting replacement from merge behavior, and live staleness assessment compares marker parity across stored, REST-rendered, and live frontend layers instead of raw-vs-rendered HTML hashes.
- Live verification passed against AST using the configured MCP credentials: capability probes, cache purge, safe widget patching, public HTML verification, and a browser pass all succeeded against disposable artifacts that were cleaned up afterward.
