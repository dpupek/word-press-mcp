# WordPress MCP Helper

## Setup
- Configure `WP_SITE_URL` to the target site root, for example `https://example.com`.
- Set `WP_USERNAME` and `WP_APP_PASSWORD` when you need authenticated reads or any writes.
- Leave `WORDPRESS_MCP_ALLOW_INSECURE_TLS` unset by default. Set it to `true` only for development or test sites that use a self-signed or otherwise untrusted TLS certificate.
- `WORDPRESS_MCP_SAFE_MODE` defaults to enabled. Mutating tools require `confirm: true` while safe mode is on.
- `WORDPRESS_MCP_ROUTE_CAPTURE_URL` defaults to `https://test.nexportsolutions.com/wp-json` for route capture and parity generation.

## Best Practices
- Prefer workflow tools when the task spans multiple API calls or involves taxonomy/media coordination.
- Use generated endpoint tools when you need low-level control over a specific route.
- Keep writes explicit. Validate categories, tags, and media assets before touching posts.
- Treat unexpected HTML responses as environment issues first: wrong URL, login page, reverse proxy, or plugin error page.

## Error Handling
- Authentication failures usually mean missing or wrong application-password credentials, or insufficient role capabilities.
- 400-level validation failures usually mean bad enum values, invalid taxonomy IDs, or unsupported field names.
- 404 failures usually mean the route is not registered on the site, or the target object ID/slug does not exist.

## NexPort Layer
- Default NexPort blog workflows to `draft` status unless asked to publish.
- Preserve `elementor_theme` as a convention, not a generic WordPress requirement.
- Inspect Elementor-related meta after writes rather than assuming every WordPress install supports the same document shape.

## Elementor Support
- Post, page, and Elementor template read tools accept `include_elementor_state`, `include_elementor_summary`, `include_elementor_raw_parsed`, and `include_elementor_theme_builder_state`.
- Collection reads for posts, pages, and `elementor_library` also accept `elementor_only` to filter results down to Elementor-authored items after enrichment.
- Use `workflow_inspect_elementor_document` for a structured audit of `_elementor_edit_mode`, `_elementor_template_type`, `_elementor_data`, `_elementor_page_settings`, and `_elementor_conditions`.
- Use `workflow_validate_elementor_document` to turn that audit into explicit issues and warnings before any clone or write workflow.
- Use `workflow_list_elementor_templates` and `workflow_get_elementor_template_conditions` to inspect theme-builder templates and assignments without mutating them.
- Use `workflow_inspect_elementor_history` to inspect revisions and autosaves with the same Elementor audit logic.
- Use `workflow_clone_elementor_document` to copy a known-good Elementor document into a new draft without inventing new builder JSON from scratch.
- Use `workflow_diff_elementor_documents` to compare a live document against another document, revision, or autosave before deciding whether a rollback or clone is safe.
- Use `workflow_restore_elementor_candidate` to evaluate a revision or autosave, preserve the live document's status, and only restore when the candidate passes Elementor validation.
- Use `workflow_import_elementor_document_media` to run Elementor's document media-import endpoint only after the target document passes a preflight Elementor validation check.

## Lessons Learned
- Elementor automation is primarily about post meta and document JSON shape, not custom HTTP headers. The durable contract is `_elementor_edit_mode`, `_elementor_template_type`, `_elementor_data`, `_elementor_page_settings`, and `_elementor_conditions`.
- Route discovery is not the same as usable capability. A site can expose Elementor namespaces while the current account still receives `401 rest_forbidden` for edit-context reads or Elementor-specific endpoints.
- Default safe operating sequence for Elementor work:
  1. inspect
  2. validate
  3. diff against another document or revision/autosave if needed
  4. restore a validated revision/autosave when rollback is the goal
  5. clone or media-import
  6. only then consider higher-risk writes
- Prefer cloning a known-good Elementor document over generating builder JSON from scratch.
- `context=edit` is required for the most useful Elementor metadata, but lower-privilege accounts may force a fallback to `context=view`, which means workflows must tolerate partial insight.
- Elementor document media import is a document-scoped remap/import operation keyed by document ID, not a general file-upload substitute.
- On `https://test.nexportsolutions.com`, the `test` account authenticates successfully as an administrator with an application password. Over plain `http`, the same auth flow returns `rest_not_logged_in`, so live validation and route capture should use `https`.
- The same test site currently presents a self-signed or untrusted TLS chain to Node-based clients. Use `WORDPRESS_MCP_ALLOW_INSECURE_TLS=true` only for that environment if you need live validation before the certificate chain is fixed.
- Even with valid administrator auth, `elementor/v1/post` currently returns `403` on this site, so Elementor workflows should continue preferring the guarded WordPress-core and site-editor routes unless a specific Elementor endpoint has been validated.
- Deleting an `elementor_library` kit can return an Elementor HTML confirmation page instead of REST JSON. Treat kit deletion as a special-case admin operation rather than a normal API delete until a safe endpoint is validated.
