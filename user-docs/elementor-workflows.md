# Elementor Workflows

## What Matters

Elementor behavior is primarily driven by post meta and document JSON shape, not by special headers.

Key fields:

- `_elementor_edit_mode`
- `_elementor_template_type`
- `_elementor_data`
- `_elementor_page_settings`
- `_elementor_conditions`

## Read and Audit Workflows

Use these first:

- `workflow_inspect_elementor_document`
- `workflow_validate_elementor_document`
- `workflow_get_site_capabilities`
- `workflow_get_live_render_state`
- `workflow_inspect_elementor_history`
- `workflow_diff_elementor_documents`
- `workflow_list_elementor_templates`
- `workflow_get_elementor_template_conditions`

## Write-Side Workflows

Use these only after inspection and validation:

- `workflow_update_elementor_widget`
- `workflow_patch_elementor_document`
- `workflow_publish_and_verify_elementor_page`
- `workflow_clone_elementor_document`
- `workflow_cleanup_elementor_kit`
- `workflow_restore_elementor_candidate`
- `workflow_import_elementor_document_media`

## Recommended Order

1. Inspect the live document.
2. Validate Elementor state.
3. Probe site capabilities if cache purge or plugin routes matter.
4. Compare stored, REST-rendered, and live frontend state when the page looks stale.
5. Patch one widget or apply an ordered document patch.
6. Publish and verify when cache invalidation and live markers matter.
7. Inspect revision or autosave history if you need rollback options.
8. Diff the live document against the candidate revision/autosave.
9. Restore the candidate if rollback is the goal.
10. Clone when you want a safe draft copy.
11. Use guarded kit cleanup for disposable Elementor kit/site-settings records.
12. Import document media only after validation passes.

## Practical Lessons

- A document can still be considered Elementor-authored even if `_elementor_data` is empty for certain kit-like records.
- Route presence does not guarantee route usability.
- Stored WordPress content, REST-rendered content, and live frontend output can diverge after Elementor writes.
- Small widget-level patches are safer than full `_elementor_data` replacement for routine edits.
- Some Elementor endpoints still reject admin users on the live site.
- Elementor kit deletion is not a normal REST delete on the current test site.
- The guarded cleanup workflow attempts the normal delete first and only takes the `force_delete_kit` path when you explicitly allow it.
- Some sites still require the browser-admin confirmation URL after the guarded retry, so cleanup can end as a documented manual admin step rather than a silent failure.

## What To Avoid

- generating raw Elementor widget JSON from scratch unless the structure is already validated
- assuming `template = "elementor_theme"` alone is enough
- forcing deletes against Elementor kits when Elementor returns a confirmation page
