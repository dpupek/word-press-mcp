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
- `workflow_inspect_elementor_history`
- `workflow_diff_elementor_documents`
- `workflow_list_elementor_templates`
- `workflow_get_elementor_template_conditions`

## Write-Side Workflows

Use these only after inspection and validation:

- `workflow_clone_elementor_document`
- `workflow_restore_elementor_candidate`
- `workflow_import_elementor_document_media`

## Recommended Order

1. Inspect the live document.
2. Validate Elementor state.
3. Inspect revision or autosave history if you need rollback options.
4. Diff the live document against the candidate revision/autosave.
5. Restore the candidate if rollback is the goal.
6. Clone when you want a safe draft copy.
7. Import document media only after validation passes.

## Practical Lessons

- A document can still be considered Elementor-authored even if `_elementor_data` is empty for certain kit-like records.
- Route presence does not guarantee route usability.
- Some Elementor endpoints still reject admin users on the live site.
- Elementor kit deletion is not a normal REST delete on the current test site.

## What To Avoid

- generating raw Elementor widget JSON from scratch unless the structure is already validated
- assuming `template = "elementor_theme"` alone is enough
- forcing deletes against Elementor kits when Elementor returns a confirmation page
