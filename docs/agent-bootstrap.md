# WordPress MCP Agent Bootstrap

Use this when first connecting to a WordPress site through this MCP server.

## Startup Checklist

1. Run `health`.
2. Record the site URL, auth state, route count, and namespaces.
3. If auth is available, fetch site identity before doing anything else.
4. Prefer workflow tools over raw endpoint tools unless you need exact route control.

## First Calls

### 1. Validate the environment

- `health`

Read:

- site URL
- whether auth is configured
- whether the server can talk to WordPress
- route count and namespaces

### 2. Get the site identity

Use the generated read tools for:

- `wp_v2_settings_list`
- optionally `wp_v2_users_me_get`

Capture:

- site title
- site URL
- current user
- whether edit-context reads appear to work

### 3. Get a fast picture of the site

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
2. `wp_v2_settings_list`
3. `wp_v2_posts_list`
4. `wp_v2_pages_list`
5. `workflow_list_menu_structure`
6. `workflow_list_elementor_templates` if Elementor routes exist

### Work on a post or page safely

1. `workflow_inspect_post`
2. `workflow_get_post_urls`
3. `workflow_draft_or_update_post` in `plan` mode
4. `workflow_taxonomy_reconcile`
5. execute only after the target state is clear

### Work with Elementor safely

1. `workflow_inspect_elementor_document`
2. `workflow_validate_elementor_document`
3. `workflow_diff_elementor_documents` or `workflow_inspect_elementor_history` if needed
4. then choose one of:
   - `workflow_clone_elementor_document`
   - `workflow_restore_elementor_candidate`
   - `workflow_import_elementor_document_media`
   - `workflow_cleanup_elementor_kit`

### Work with menus safely

1. `workflow_list_menu_structure`
2. `workflow_upsert_menu_item` in `plan` mode
3. `workflow_assign_menu_locations` in `plan` mode if needed
4. execute only after item type, parent, order, and locations are clear

### Get public and preview URLs

1. `workflow_get_post_urls`

Use it to determine:

- public URL for published content
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
