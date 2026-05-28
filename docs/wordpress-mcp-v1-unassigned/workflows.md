# Workflows

## Generic WordPress editing
- Persona: agent automating content or media operations.
- Goal: inspect, create, update, and delete WordPress resources safely.
- Flow:
  1. Read route/tool help.
  2. Validate configuration and target IDs.
  3. Use endpoint tools for deterministic API work.
  4. Use workflow tools when multiple API calls must stay coordinated.

## NexPort publishing
- Persona: agent drafting or revising NexPort blog posts.
- Goal: create or revise posts with taxonomy, media, and site conventions handled consistently.
- Flow:
  1. Plan post payload and taxonomy.
  2. Upload or attach media if needed.
  3. Create or update draft.
  4. Inspect resulting editability signals.

## Elementor safe mutation and verification
- Persona: agent updating Elementor-authored pages without breaking stable widget structure or guessing whether the live site caught up.
- Goal: inspect capabilities, patch Elementor content safely, purge cache when needed, and verify the public frontend outcome.
- Flow:
  1. Call `workflow_get_site_identity` to confirm site and user context.
  2. Call `workflow_get_site_capabilities` to distinguish exposed routes from confirmed edit, cache-purge, and template access.
  3. Inspect or validate the target document before mutation.
  4. Use `workflow_update_elementor_widget` for one-widget changes or `workflow_patch_elementor_document` for ordered tree operations.
  5. Use `workflow_publish_and_verify_elementor_page` when the update needs cache purge and public HTML verification in one flow.
  6. Confirm the stored, REST-rendered, and live frontend layers with `workflow_get_live_render_state` when staleness or cache behavior is in question.
