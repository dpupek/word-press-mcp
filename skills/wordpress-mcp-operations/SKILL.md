---
name: wordpress-mcp-operations
description: Use when inspecting or changing a remote WordPress site through this WordPress MCP server, including authentication checks, content, menus, media, and Elementor workflows.
license: MIT
compatibility: Requires the WordPress MCP server. Local WordPress source, PHP, Bash, and WP-CLI are optional and are not provided by this server.
---

# WordPress MCP operations

Use this skill for a remote-site task. Upstream development skills describe local WordPress codebases; use them only when that source and tooling are actually available.

## Orient and select guidance

1. Call `workflow_get_site_identity`. Confirm the configured and reported URL identify the intended site, and inspect authentication and available namespaces.
2. For protected reads, verify the actual target with `context: "edit"`. A successful public read does not establish authentication or editing permission.
3. Call `list_skills` for the catalog, then `read_skill` for relevant guidance. Read references through `read_skill_file` using the skill name and file path from its resource manifest. Equivalent files are exposed as `skill://wordpress-mcp/<name>/<path>` resources.
4. `references/...` paths are relative to the current skill. `skills/<name>/...` and `../<name>/...` refer to another skill: use that name with `read_skill_file`, rather than passing a path containing `..`.
5. Retain upstream WordPress version requirements. Verify the target version before applying version-specific advice.

## Inspect, plan, and execute

- Use `agent_bootstrap`, `help`, `workflow_recipes`, and `troubleshooting` for server-specific tool sequences.
- Prefer the existing workflow tools for posts, media, taxonomies, and menus; use generated endpoint tools when precise route control is needed.
- For Elementor tasks, first verify Elementor is present. Inspect and validate the document before patching it; use the targeted widget/document workflows.
- Use workflow `mode: "plan"` first where supported. Execute writes only within the user's authorized scope and supply `confirm: true` when required.
- The existing `workflow_get_site_capabilities` can issue mutation probes, including cache deletion. Treat it as a potentially mutating operation; use read-only identity and target reads for ordinary orientation.
- Keep Application Passwords in the host's secret configuration, use HTTPS with certificate verification, and keep debug logging disabled when handling sensitive input.
- Skill discovery and reads are read-only. They do not authorize writes, grant capabilities, run scripts, or provide WP-CLI/PHP/Bash. Materialize and review scripts in the host environment only when the task authorizes execution and the required tooling is present.

## Verify and report

- Read back changed fields after a write. For public changes, inspect the public output as well as stored API data.
- Distinguish authentication, permission, route availability, stored update success, and live verification.
- Report the site, actual actions, check outcomes, and any unverified boundaries. Never claim publication from a plan or successful public GET.

## Native packaging and MCP snapshots

The native plugin includes the complete skills directory. The optional `WORDPRESS_MCP_SKILL_CATALOG=import` profile lists five skills for bounded plugin import; supporting resources and fallback tools still expose the full catalog. Imported skills are a snapshot and must be refreshed when the bundled revision changes.
