# WordPress MCP Helper

## Setup
- Configure `WP_SITE_URL` to the target site root, for example `https://example.com`.
- Set `WP_USERNAME` and `WP_APP_PASSWORD` when you need authenticated reads or any writes.
- `WORDPRESS_MCP_SAFE_MODE` defaults to enabled. Mutating tools require `confirm: true` while safe mode is on.
- `WORDPRESS_MCP_ROUTE_CAPTURE_URL` defaults to `https://test.nexportsolutions.com/wp-json` for route capture and parity generation.

## Best Practices
- Start with `agent_bootstrap` when first connecting to an unfamiliar site.
- Prefer workflow tools when the task spans multiple API calls or involves taxonomy/media coordination.
- Use `workflow_get_site_identity` as the preferred first-call orientation path when you need site title, URL, current user, namespaces, and capability hints in one result.
- Use `workflow_get_site_capabilities` immediately after site identity when Elementor cache, live verification, or plugin-route permissions matter.
- Use generated endpoint tools when you need low-level control over a specific route.
- Use `workflow_get_post_urls` when you need a public URL for published content or the best available preview URL candidate for drafts. Drafts may return `publicUrl: null` on some sites; this is expected.
- Use `workflow_list_menu_structure`, `workflow_upsert_menu_item`, `workflow_reorder_menu_items`, `workflow_clone_menu`, and `workflow_assign_menu_locations` for classic WordPress menu operations instead of assembling menu/menu-item requests by hand.
- Use `npm run smoke:live:menus` when you need a disposable live proof that the classic menu workflows still work against the current site.
- Keep writes explicit. Validate categories, tags, and media assets before touching posts.
- Treat unexpected HTML responses as a normalized server-side failure mode and follow the actionable guidance returned by the MCP tool response.

## Error Handling
- Follow the normalized actionable response returned by the MCP server.
- Validation errors indicate the request was blocked before any write occurred.
- Authentication and permission issues are surfaced as actionable tool errors without requiring the agent to reason about transport details.

## Expected Behavior
- Drafts may return `publicUrl: null` in `workflow_get_post_urls`; this is normal on many sites. Use `previewUrl` for drafts.
- Preview URLs may require authenticated browser access even when the REST call succeeds.

## Known Limitations
- Role-downgrade checks require a real non-admin account; some sites block user creation via REST.
- `workflow_inspect_post` is post-only and hardcodes `context=edit`, so view-context fallback testing requires a lower-privilege account.
- Elementor kit deletion can return HTML confirmation instead of REST JSON; use `workflow_cleanup_elementor_kit` for the guarded delete path.

## NexPort Layer
- Default NexPort blog workflows to `draft` status unless asked to publish.
- Preserve `elementor_theme` as a convention, not a generic WordPress requirement.
- Inspect Elementor-related meta after writes rather than assuming every WordPress install supports the same document shape.

## Elementor Support
- Post, page, and Elementor template read tools accept `include_elementor_state`, `include_elementor_summary`, `include_elementor_raw_parsed`, and `include_elementor_theme_builder_state`.
- Collection reads for posts, pages, and `elementor_library` also accept `elementor_only` to filter results down to Elementor-authored items after enrichment.
- Use `workflow_inspect_elementor_document` for a structured audit of `_elementor_edit_mode`, `_elementor_template_type`, `_elementor_data`, `_elementor_page_settings`, and `_elementor_conditions`.
- Use `workflow_validate_elementor_document` to turn that audit into explicit issues and warnings before any clone or write workflow.
- Use `workflow_get_live_render_state` when you need to compare stored Elementor data, REST-rendered content, and live frontend HTML separately.
- Use `workflow_update_elementor_widget` for small targeted widget edits instead of rewriting full `_elementor_data`.
- Use `workflow_patch_elementor_document` for ordered tree changes such as insert, replace, move, and remove operations against stable element ids.
- Use `workflow_publish_and_verify_elementor_page` when cache purge and live marker verification need to be part of the same write workflow.
- Use `workflow_list_elementor_templates` and `workflow_get_elementor_template_conditions` to inspect theme-builder templates and assignments without mutating them.
- Use `workflow_inspect_elementor_history` to inspect revisions and autosaves with the same Elementor audit logic.
- Use `workflow_clone_elementor_document` to copy a known-good Elementor document into a new draft without inventing new builder JSON from scratch.
- Use `workflow_cleanup_elementor_kit` to handle Elementor kit or site-settings cleanup with an explicit opt-in before attempting the `force_delete_kit` path.
- Use `workflow_diff_elementor_documents` to compare a live document against another document, revision, or autosave before deciding whether a rollback or clone is safe.
- Use `workflow_restore_elementor_candidate` to evaluate a revision or autosave, preserve the live document's status, and only restore when the candidate passes Elementor validation.
- Use `workflow_import_elementor_document_media` to run Elementor's document media-import endpoint only after the target document passes a preflight Elementor validation check.

## Lessons Learned
- Elementor automation is primarily about post meta and document JSON shape, not custom HTTP headers. The durable contract is `_elementor_edit_mode`, `_elementor_template_type`, `_elementor_data`, `_elementor_page_settings`, and `_elementor_conditions`.
- Route discovery is not the same as usable capability. A site can expose Elementor namespaces while the current account still receives `401 rest_forbidden` for edit-context reads or Elementor-specific endpoints.
- Default safe operating sequence for Elementor work:
  1. inspect
  2. validate
  3. probe capabilities
  4. compare stored vs live render state if the page looks stale
  5. patch one widget or apply an ordered document patch
  6. publish and verify when live cache behavior matters
  7. diff against another document or revision/autosave if needed
  8. restore a validated revision/autosave when rollback is the goal
  9. clone or media-import
- Prefer cloning a known-good Elementor document over generating builder JSON from scratch.
- `context=edit` is required for the most useful Elementor metadata, but lower-privilege accounts may force a fallback to `context=view`, which means workflows must tolerate partial insight.
- Elementor document media import is a document-scoped remap/import operation keyed by document ID, not a general file-upload substitute.
- Even with valid administrator auth, `elementor/v1/post` currently returns `403` on this site, so Elementor workflows should continue preferring the guarded WordPress-core and site-editor routes unless a specific Elementor endpoint has been validated.
- `content.raw`, `content.rendered`, and live frontend HTML can diverge after Elementor writes; treat them as separate signals rather than one publish state.
- Deleting an `elementor_library` kit can return an Elementor HTML confirmation page instead of REST JSON. Use `workflow_cleanup_elementor_kit` so the standard delete path is attempted first and the `force_delete_kit` retry path is only taken with explicit opt-in. On some sites, Elementor still requires the browser-admin confirmation URL even after that retry.
