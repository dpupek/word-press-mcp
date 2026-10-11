# WordPress MCP Agent Bootstrap

Use this when first connecting to a WordPress site through this MCP server.

This resource is the canonical first-run guide when the agent does not have the repo mounted.

## Bundled WordPress Skills

Use `list_skills` to discover guidance, then `read_skill` with
`name: "wordpress-mcp-operations"` for remote-site operating rules. Load only
relevant upstream skills and supporting files with `read_skill_file`.
All files are also available as `skill://wordpress-mcp/<name>/<path>` resources.
Skills provide guidance; they do not run scripts or grant write permissions.
Local development skills require their stated source code and tooling.

## Startup Checklist

1. Run `health`.
2. Run `workflow_get_site_identity`.
3. Run `workflow_get_site_capabilities`.
4. Record the site title, site URL, auth state, route count, namespaces, capability hints, and blocked routes.
5. Prefer workflow tools over raw endpoint tools unless you need exact route control.

## Guidance Surfaces

Use these MCP-exposed resources and tools in this order:

| Surface | Use it for |
| --- | --- |
| `agent_bootstrap` | first-call orientation and task routing |
| `help` | operating rules, output interpretation, and safety caveats |
| `workflow_recipes` | copyable task sequences for common WordPress and Elementor jobs |
| `troubleshooting` | auth, permission, stale-live, and cleanup failure diagnosis |
| `tool_catalog` | full tool inventory after you already know what class of tool you need |

## Choose The Right Workflow

| Goal | Preferred workflow |
| --- | --- |
| inspect the site and current user | `workflow_get_site_identity` |
| confirm risky capabilities before a write | `workflow_get_site_capabilities` |
| patch one known Elementor widget | `workflow_update_elementor_widget` |
| patch multiple Elementor elements or reorder structure | `workflow_patch_elementor_document` |
| verify whether stored, REST-rendered, and live output diverge | `workflow_get_live_render_state` |
| update and verify a live Elementor page in one flow | `workflow_publish_and_verify_elementor_page` |
| compare live vs revision/autosave before rollback | `workflow_diff_elementor_documents` |
| restore a validated Elementor revision/autosave | `workflow_restore_elementor_candidate` |

## First Calls

### 1. Validate the environment

- `health`

Read:

- site URL
- whether auth is configured
- whether the server can talk to WordPress
- route count and namespaces

### 2. Get the site identity

Use:

- `workflow_get_site_identity`

Capture:

- site title
- site URL
- current user
- whether edit-context reads appear to work
- whether Elementor and classic menu surfaces appear to be present

### 3. Probe task-critical capabilities

Use:

- `workflow_get_site_capabilities`

Capture:

- whether edit-context reads really work
- whether page writes really work
- whether Elementor cache purge works
- whether `elementor/v1/post` is blocked
- whether Elementor templates and page-cache health probes are reachable

### 4. Get a fast picture of the site

Recommended sequence:

- `wp_v2_posts_list` for recent posts
- `wp_v2_pages_list` for recent pages
- `workflow_list_menu_structure` for one important menu
- `workflow_list_elementor_templates` if Elementor is present

This gives a fast snapshot of:

- what kind of site this is
- whether it uses Elementor
- how navigation is organized
- what content already exists

## Safe Defaults

- Use workflow tools first for multi-step work.
- Use plan/inspect/validate tools before writes.
- Treat writes as explicit actions, not discovery steps.
- Let the MCP server handle API quirks, retries, and normalization.

## Recipes

### Understand this site fast

1. `health`
2. `workflow_get_site_identity`
3. `workflow_get_site_capabilities`
4. `wp_v2_posts_list`
5. `wp_v2_pages_list`
6. `workflow_list_menu_structure`
7. `workflow_list_elementor_templates` if Elementor routes exist

### Work on a post or page safely

1. `workflow_inspect_post`
2. `workflow_get_post_urls`
3. `workflow_draft_or_update_post` in `plan` mode
4. `workflow_taxonomy_reconcile`
5. execute only after the target state is clear

### Work with Elementor safely

1. `workflow_inspect_elementor_document`
2. `workflow_validate_elementor_document`
3. `workflow_get_live_render_state` when stored and live output might diverge
4. `workflow_diff_elementor_documents` or `workflow_inspect_elementor_history` if needed
5. then choose one of:
   - `workflow_update_elementor_widget`
   - `workflow_patch_elementor_document`
   - `workflow_publish_and_verify_elementor_page`
   - `workflow_clone_elementor_document`
   - `workflow_restore_elementor_candidate`
   - `workflow_import_elementor_document_media`
   - `workflow_cleanup_elementor_kit`

Use `workflow_recipes` if you need a copyable sequence or example payload shape.

### Work with menus safely

1. `workflow_list_menu_structure`
2. `workflow_upsert_menu_item` in `plan` mode
3. `workflow_reorder_menu_items` in `plan` mode when hierarchy or ordering will change
4. `workflow_assign_menu_locations` in `plan` mode if needed
5. execute only after item type, parent, order, and locations are clear

### Get public and preview URLs

1. `workflow_get_post_urls`

Use it to determine:

- public URL for published content (drafts may return `publicUrl: null` on some sites)
- preview URL candidate for drafts/pages
- whether preview likely needs authenticated browser access

## When To Use Raw Endpoint Tools

Use generated endpoint tools when:

- the workflow layer does not cover the task
- you need a very specific field or filter
- you are investigating route-level behavior

When you do that:

- start with `GET` tools
- avoid mutation tools until the target object and payload are clear

## What Not To Do

- Do not teach yourself transport quirks from one site and reuse them blindly.
- Do not guess Elementor document structure from raw output when inspection/validation workflows exist.
- Do not mutate menus or navigation blindly without first loading the current structure.
- Do not assume draft preview URLs are publicly accessible.
