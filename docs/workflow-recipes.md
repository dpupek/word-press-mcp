# WordPress MCP Workflow Recipes

Use this resource when you already know the task and need the shortest safe sequence of MCP calls.

## First-Run Orientation

1. `health`
2. `workflow_get_site_identity`
3. `workflow_get_site_capabilities`
4. `tool_catalog` only after you know which tool class you need

## Patch One Elementor Widget

1. `workflow_inspect_elementor_document`
2. `workflow_validate_elementor_document`
3. `workflow_get_site_capabilities`
4. `workflow_update_elementor_widget`

Use this when:
- the target widget id is already known
- the document structure does not need to change

Typical shape:

```json
{
  "postId": 123,
  "postType": "pages",
  "widgetId": "1ff3dd52",
  "expectedWidgetType": "heading",
  "settingsPatch": {
    "title": "Updated heading"
  },
  "purgeCache": true,
  "verifyLive": true
}
```

## Patch An Elementor Document Structure

1. `workflow_inspect_elementor_document`
2. `workflow_validate_elementor_document`
3. `workflow_patch_elementor_document`

Use this when:
- you need ordered insert, replace, move, or remove operations
- you need to replace or merge multiple widgets in one mutation

Rules:
- inserted elements must include stable ids
- use `replaceWidgetSettings` when omitted settings should be removed
- use `mergeWidgetSettings` when omitted settings should be preserved

## Diagnose A Stale Live Elementor Page

1. `workflow_inspect_elementor_document`
2. `workflow_get_site_capabilities`
3. `workflow_get_live_render_state`
4. `troubleshooting`

Read the result this way:
- `restVsStoredMismatch=true`: REST output is not reflecting stored markers yet
- `liveVsStoredMismatch=true`: public frontend is not reflecting stored markers yet
- `likelyCacheIssue=true`: REST matches stored markers but the live frontend still lags

## Publish, Purge Cache, And Verify Live Text

1. `workflow_get_site_capabilities`
2. `workflow_publish_and_verify_elementor_page`

Use this when:
- the write must be followed immediately by cache-aware verification
- expected text must appear live
- forbidden text must disappear live

Typical shape:

```json
{
  "postId": 123,
  "postType": "pages",
  "update": {
    "type": "widget",
    "widgetId": "1ff3dd52",
    "expectedWidgetType": "heading",
    "settingsPatch": {
      "title": "Updated heading"
    }
  },
  "purgeCache": true,
  "expectedText": ["Updated heading"],
  "forbiddenText": ["Old heading"]
}
```

## Compare Or Restore A Candidate Revision

1. `workflow_inspect_elementor_history`
2. `workflow_diff_elementor_documents`
3. `workflow_restore_elementor_candidate`

Use this when:
- rollback is the goal
- a revision or autosave should be validated before restore
