---
name: nexport-wordpress-blog-publisher
description: Create or update NexPort Solutions blog posts on https://nexportsolutions.com using the WordPress REST API with Application Passwords. Use when publishing or revising Elementor-backed blog posts that use the Theme layout, when selecting categories and tags for NexPort announcements, or when generating a featured image for a website post with OpenAI image generation.
---

# NexPort WordPress Blog Publisher

Use this skill for NexPort Solutions website blog work on `https://nexportsolutions.com`.

This site's blog posts can be managed as standard WordPress posts through the REST API. For the current website, Elementor-backed blog posts using the editor layout name `Theme` should be treated as regular posts with:

- `template = "elementor_theme"`
- normal `content` HTML
- normal `excerpt`
- standard WordPress categories, tags, and featured media

Do not assume you can edit Elementor document/widget JSON directly unless you are following a structure already validated against the live site. Prefer the WordPress posts API unless the user explicitly asks for browser-driven Elementor layout editing.

Companion artifacts:

- Runbook: `docs/website/nexportsolutions-wordpress-runbook.md`
- Helper script: `.codex/skills/nexport-wordpress-blog-publisher/scripts/Invoke-NexportWordPressPost.ps1`
- WordPress MCP helper: `docs/wordpress-help.md`
- Live smoke script: `scripts/live-smoke.js`

Preferred tooling order for this repo:

1. Use the WordPress MCP workflows first for inspection, validation, taxonomy, media, and Elementor-safe operations.
2. Fall back to the helper script only when the MCP workflow surface is missing a required capability.
3. For Elementor-heavy work, inspect, validate, and diff before any write.
4. For environment validation or regression checks, prefer `npm run smoke:live` over ad hoc destructive testing.

## Preconditions

Require these environment variables before any authenticated calls:

- `WP_SITE_URL`
- `WP_USERNAME`
- `WP_APP_PASSWORD`

Default `WP_SITE_URL` to `https://nexportsolutions.com` if only the auth values are missing.

Important shell rule:

- Do not assume environment variables set in one PowerShell process are visible in another.
- Re-validate env availability in the current shell before each authenticated workflow.

Auth pattern:

- Use WordPress Application Passwords over HTTPS via Basic auth.
- Prefer a dedicated editor/admin account for automation.

Core verification endpoint:

- `GET /wp-json/wp/v2/users/me?context=edit`

Primary content endpoints:

- `GET|POST /wp-json/wp/v2/posts`
- `GET|POST /wp-json/wp/v2/posts/{id}`
- `GET|POST /wp-json/wp/v2/media`
- `GET /wp-json/wp/v2/categories`
- `GET /wp-json/wp/v2/tags`

## Defaults

- Default post status to `draft` unless the user explicitly asks to publish.
- Default post template to `elementor_theme`.
- Keep content HTML simple and robust: headings, paragraphs, lists, links, horizontal rules, emphasis.
- Use categories conservatively and tags more freely.
- Never silently edit an existing post unless the user supplied an ID or there is an exact slug/title match you can show back to them.

## Live Site Findings

These findings were verified against the live site and should guide the workflow:

- Existing Elementor-backed blog posts are exposed as ordinary `wp/v2/posts`.
- Posts using the site’s `Theme` layout currently present through the API as `template = "elementor_theme"`.
- `content.raw` is the editable source for those posts.
- The Elementor REST namespace exposed on the site does not currently provide a confirmed general-purpose document save API for post layouts.
- The site also exposes `wp-abilities/v1`, but no publishing ability for blog authoring has been confirmed.
- A valid Elementor-authored blog document for this site must include populated Elementor meta, not just the WordPress post template.
- The safest authoring workflow is to revise a known-good live draft or clone a known-good live post structure rather than inventing a new Elementor document from scratch.
- A manually validated safe section pattern on the live site is:
  - one outer container with `isInner = false`
  - one inner container per content section with `isInner = true`
  - each inner container uses `settings.content_width = "full"`
  - each inner container contains:
    - one `heading` widget with minimal settings, typically only `title`
    - one `text-editor` widget with `settings.editor`
- Do not generate flat top-level heading/text widget siblings by default. Mirror the inner-container-per-section pattern instead.

## Taxonomy Rules

Current live categories:

- `Latest News` (slug `press-release`)
- `release-announcement`
- `Beyond News`
- `NexPort Campus 7.0 News`
- `Uncategorized`

Recommended operational taxonomy:

- Use categories for broad editorial buckets only.
- Use tags for product, version, lifecycle stage, and feature topics.

Preferred category mapping:

- Release / launch / beta / version announcement:
  - `Latest News`
  - `release-announcement`
- Thought leadership / market commentary:
  - `Beyond News`
  - optionally `Latest News`
- Product-series category:
  - avoid creating new version-specific categories by default

Preferred tag mapping:

- Product tags:
  - `nexport-campus`
  - `marketplace`
  - `analytics`
- Lifecycle tags:
  - `beta`
  - `ga`
  - `patch`
  - `security`
  - `maintenance`
- Version tags:
  - `7-0-0`
  - `6-7-9`
- Topic tags:
  - `integrations`
  - `performance`
  - `reporting`
  - `accessibility`

For a NexPort Campus 7.0.0 beta post, default to:

- categories:
  - `Latest News`
  - `release-announcement`
- tags:
  - `nexport-campus`
  - `7-0-0`
  - `beta`

## Workflow

1. Validate environment variables and authenticate with `users/me`.
2. Fetch current categories and tags from WordPress before proposing taxonomy.
3. Determine whether the task is:
   - create new post
   - revise existing post
   - generate only a featured image
   - Preferred default when a working Elementor draft already exists: revise that draft in place
4. For posts, prepare:
   - title
   - excerpt
   - HTML body
   - categories
   - tags
   - `template = "elementor_theme"`
   - `status`
   - Elementor section model, if the post should be Elementor-editable
5. If a featured image is requested, generate it before the final publish/update step.
6. Upload the chosen image to WordPress media and set `featured_media` on the post.
7. Create or update the post.
8. Re-read the post with `context=edit` and validate:
   - `_elementor_data` parses as JSON
   - expected section count exists
   - section headings match the intended article outline
9. Return:
   - post ID
   - status
   - edit URL
   - public URL
   - template
   - categories
   - tags
   - featured image media ID if applicable

## Live Validation

Use this when the goal is to prove the live site still supports the expected MCP workflow surface.

Preconditions:

- `WP_SITE_URL` should target the live environment over `https`.
- `WP_USERNAME` and `WP_APP_PASSWORD` must be available in the current shell.
- On the current test site, Node-based calls also require `WORDPRESS_MCP_ALLOW_INSECURE_TLS=true`.

Preferred validation path:

1. Run `npm run smoke:live`.
2. Inspect the JSON output for:
   - disposable published post creation
   - Elementor template clone
   - revision creation
   - restore plan and execute
   - media import execute
   - cleanup results
3. If public rendering needs confirmation, use Playwright MCP against the disposable published post URL before cleanup.

Validation interpretation:

- A disposable published post should render publicly without console errors other than known site issues.
- Elementor clone, restore, and media import should complete on a disposable draft.
- Cleanup may fail for `elementor_library` kits because Elementor can intercept deletion with a confirmation screen.

## MCP Workflow Shortcuts

Prefer these MCP workflows over hand-rolled API call sequences when they fit the task:

- `workflow_draft_or_update_post`
- `workflow_media_featured_image`
- `workflow_taxonomy_reconcile`
- `workflow_inspect_post`
- `workflow_inspect_elementor_document`
- `workflow_validate_elementor_document`
- `workflow_inspect_elementor_history`
- `workflow_diff_elementor_documents`
- `workflow_restore_elementor_candidate`
- `workflow_clone_elementor_document`
- `workflow_import_elementor_document_media`
- `workflow_list_elementor_templates`
- `workflow_get_elementor_template_conditions`

Safe Elementor operating order:

1. inspect
2. validate
3. diff against another document or revision/autosave if needed
4. restore a validated revision/autosave when rollback is the goal
5. clone or media-import
6. only then consider broader writes

## Elementor Document Rules

When the goal is an Elementor-editable blog post, do not stop at:

- `template = "elementor_theme"`

Also populate these Elementor meta values:

- `_elementor_edit_mode = "builder"`
- `_elementor_template_type = "wp-post"`
- `_elementor_data`
- `_elementor_page_settings`
- `_elementor_conditions`

Preferred document shape for this site:

1. Start from a known-good NexPort blog post document when possible.
2. Preserve the outer container structure.
3. Represent each section as an inner container:
   - `elType = "container"`
   - `isInner = true`
   - `settings.content_width = "full"`
4. Inside each section container, add:
   - one `heading` widget
   - one `text-editor` widget
5. Keep heading widget settings minimal unless the live site shows otherwise:
   - preferred: `{ "title": "Section Title" }`
6. Put body HTML in the paired text-editor widget’s `settings.editor`.

Safe generation rule:

- If a known-good post exists, clone its `_elementor_data` structure and replace only the section content.
- If the user already has a working Elementor draft, prefer updating that draft instead of creating a sibling post.
- If building a new structure, match the validated live pattern exactly.
- After creating or updating the post, re-read the post with `context=edit` and confirm `_elementor_data` is populated.

Repair rule:

- If `Edit with Elementor` does not appear, compare the new post’s Elementor meta against a known-good Elementor blog post before changing content assumptions.
- Treat missing or malformed `_elementor_data` as the primary failure mode.
- If the editor crashes after a write, restore the last known-good document shape first, then compare the failed structure against the manual Elementor-authored structure.

## Lessons Learned

- Elementor support is primarily about metadata and document JSON shape, not special request headers.
- The most durable Elementor signals on this site are `_elementor_edit_mode`, `_elementor_template_type`, `_elementor_data`, `_elementor_page_settings`, and `_elementor_conditions`.
- Exposed routes do not guarantee usable capability. A live site can advertise Elementor namespaces while the current account still receives `401 rest_forbidden`.
- Prefer cloning a known-good Elementor document over generating fresh builder JSON from scratch.
- Use `context=edit` whenever the account supports it, but degrade gracefully when only `context=view` is available.
- Elementor document media import is a document-level import/remap operation, not a generic WordPress media upload replacement.
- In the current test environment, the `test` account authenticates successfully as a site administrator when the site is accessed over `https`.
- Over plain `http`, the same application-password flow returns `rest_not_logged_in`, so live validation and automation should use `https`.
- The test site currently presents an untrusted TLS chain to Node-based clients, so MCP-based live validation may also require `WORDPRESS_MCP_ALLOW_INSECURE_TLS=true` until the certificate chain is corrected.
- Even with valid administrator auth, `elementor/v1/post` still returns `403` on this site, so prefer the guarded WordPress-core and site-editor routes unless a specific Elementor endpoint has been validated.
- Deleting an `elementor_library` kit can trigger an Elementor HTML confirmation screen instead of a normal REST JSON delete response, so treat kit deletion as a special-case admin flow.
- `npm run smoke:live` is the preferred reusable regression pass for this repo. It creates disposable content, exercises clone/restore/media-import, deletes disposable posts, and reports kit-delete confirmation blocks as structured errors.

## Featured Image Branch

When the user needs a featured image, use the `imagegen` skill guidance and the built-in image generation path by default.

Fallback lessons from this site/workstation:

- The built-in image generation path may be unavailable in some Codex environments.
- The CLI fallback needs `OPENAI_API_KEY` in the current shell plus the `openai` Python package.
- On this workstation, `uv pip install` may require `--native-tls` for PyPI access.
- Generate the image locally first, show or open it for review, and only upload to WordPress after approval.

Prompt goals for NexPort featured images:

- professional B2B software announcement style
- clean, high-contrast composition
- suitable for website hero/blog card cropping
- no embedded text unless the user explicitly asks for it
- visual alignment with NexPort branding and enterprise learning software themes

Preferred image prompt structure:

- asset type: website featured image
- audience: enterprise training / learning platform buyers
- subject: product launch, beta release, dashboard, learning technology, secure enterprise workflows
- style: modern editorial / polished technology marketing
- composition: wide, blog-header friendly, central focus with safe margins
- avoid: watermarks, UI gibberish, tiny unreadable text, clutter

Save-path policy:

- If the image is intended for the live WordPress post, move or copy the final selected image into the workspace only if the user wants a local artifact.
- Otherwise upload the chosen image directly to WordPress media and report the media ID and source path used.

## API Payload Guidance

Typical create payload:

```json
{
  "title": "NexPort Campus 7.0.0 Enters Beta",
  "status": "draft",
  "template": "elementor_theme",
  "content": "<h2>...</h2><p>...</p>",
  "excerpt": "NexPort Campus 7.0.0 is now in beta.",
  "categories": [11, 12],
  "tags": [123, 456, 789]
}
```

Media upload notes:

- Upload the file to `/wp-json/wp/v2/media`
- Send a filename and appropriate MIME type
- After upload, attach the returned media ID to the post as `featured_media`
- WordPress may return a relative `source_url`; treat the media ID as the primary durable reference and derive the absolute URL from the site base if needed.

## Guardrails

- Default to `draft`; do not publish without explicit instruction.
- Do not attempt raw Elementor widget-tree edits through undocumented endpoints.
- Do not create new categories casually; prefer existing categories plus tags.
- If the intended category/tag does not exist, either:
  - create the missing tag if the user wants it, or
  - report the gap and propose the exact taxonomy before proceeding
- Keep HTML content portable and editable through WordPress post content.
- When generating Elementor-editable posts, keep the WordPress `content` field aligned with the Elementor section content so previews and non-Elementor fallbacks remain reasonable.
- For revisions, preserve slug and taxonomy unless the user asked to change them.
- When a user manually corrects Elementor structure, read the updated `_elementor_data` back from the live post and promote that structure to the new default convention.
- Treat disposable live test content as ephemeral. Clean up posts automatically when safe, and report any template-kit leftovers explicitly if Elementor blocks deletion.

## Recommended Output Summary

When done, report:

- the action performed
- the post title
- post ID
- status
- assigned categories
- assigned tags
- whether `elementor_theme` was used
- whether a featured image was generated and uploaded
- the edit URL and public URL
