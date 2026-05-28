# Codex Agent MCP Test Instructions

These steps assume the WordPress MCP server is already registered in the Codex MCP configuration.

## 1. Verify MCP config entry

Confirm the MCP entry exists in the Codex MCP list and that the environment values are correct:

- `WP_SITE_URL`
- `WP_USERNAME`
- `WP_APP_PASSWORD`
- `WORDPRESS_MCP_SAFE_MODE=true`
- `WORDPRESS_MCP_ALLOW_INSECURE_TLS=true` only if the site uses a self-signed cert.

## 2. Baseline sanity calls

Run these calls in a fresh Codex thread to ensure the server starts cleanly:

- `help`
- `workflow_get_site_identity`
- `workflow_get_site_capabilities`

## 3. Read-only validation

Fetch a small set of pages and posts:

- `wp_v2_pages_list` with `context=view`, `per_page=5`, `orderby=date`, `order=desc`
- `wp_v2_posts_list` with the same paging

## 4. Safe-mode write gating

1. Attempt draft post creation without `confirm=true` and verify it is rejected.
2. Re-run with `confirm=true`, `status=draft`, and a unique title.
3. Verify the draft appears in `wp_v2_posts_list`.
4. Fetch preview URLs with `workflow_get_post_urls` and confirm:
   - A preview URL is returned for drafts.
   - `publicUrl` may be `null` for drafts on some sites; record the value but do not treat `null` as a failure.
5. Delete the draft with `confirm=true`.

## 5. Workflow coverage

Run `workflow_get_post_urls` on the draft to verify preview URL selection.

## 6. Page editing tasks

1. Create a draft page with `wp_v2_pages_create` (unique title, `status=draft`).
2. Verify the draft appears in `wp_v2_pages_list`.
3. Fetch preview URLs with `workflow_get_post_urls` and confirm:
   - A preview URL is returned for drafts.
   - `publicUrl` may be `null` for drafts on some sites; record the value but do not treat `null` as a failure.
4. Update the draft page title using `wp_v2_pages_id_update` and confirm the title change.
5. Re-run `workflow_get_post_urls` to confirm preview URL remains valid.
6. Delete the draft page with `confirm=true` (use `force=true` if needed).

## 7. Elementor coverage (if installed)

- `workflow_get_site_capabilities`
- `workflow_list_elementor_templates`
- `workflow_inspect_elementor_document` on a known template ID
- `workflow_get_live_render_state` on a known public Elementor page
- Optional: `workflow_update_elementor_widget` in `plan` mode
- Optional: `workflow_patch_elementor_document` in `plan` mode
- Optional: `workflow_publish_and_verify_elementor_page` with a disposable or safely cloneable page
- Optional: `workflow_clone_elementor_document` with `confirm=true`, then clean up

## 8. Error-handling validation

Use an isolated MCP registration with invalid credentials (do not mutate the shared `test_wordpress` entry) and call `workflow_get_site_identity`. Confirm the tool returns an actionable auth error rather than a raw transport failure.

## 9. Optional extended coverage

Add these if you need deeper confidence or are validating new behavior:

1. Auth/role downgrade: run `workflow_get_site_identity` with a non-admin account and confirm capability hints flip (Elementor/menu edit-context likely false). This may be blocked on sites that do not allow user creation or where only an admin account exists.
2. Edit-context fallback: requires a lower-privilege user. `workflow_inspect_post` is post-only and hardcodes `context=edit`, so this scenario is not directly exercisable without a real low-privilege account to force a view-context fallback.
3. Taxonomy reconciliation: create a draft post using `workflow_taxonomy_reconcile` and confirm category/tag IDs are resolved and used in the post payload.
4. Media upload + featured image: run `workflow_media_featured_image` in `plan`, then `execute` with a small test image and confirm `featured_media` is set.
5. Menu plan/execute: run `workflow_list_menu_structure`, then `workflow_upsert_menu_item` in `plan` and `execute`, and verify the item appears in the menu tree.
6. Menu reorder: use `workflow_reorder_menu_items` in `plan` and `execute` with a simple parent/child change and verify the order in `workflow_list_menu_structure`.
7. Elementor validation fail path: pick a non-Elementor page and run `workflow_validate_elementor_document` to confirm warnings or issues are surfaced.
8. Workflow error normalization: pass an invalid ID (e.g., `wp_v2_posts_id_get` with a non-numeric ID) and confirm you receive a validation error, not a raw exception.
9. Parity check: run `npm run verify:parity` to confirm generator parity remains valid after plugin or route changes.
