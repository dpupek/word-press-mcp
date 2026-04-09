import { loadOperations, summarizeOperations } from '../src/generator.js';
import { PATHS } from '../src/paths.js';
import { writeText } from '../src/utils.js';

const operations = loadOperations();
const summary = summarizeOperations(operations);
const lines = [
  '# WordPress MCP Tool Catalog',
  '',
  '## Summary',
  `- Total endpoint tools: ${summary.total}`,
  `- Read tools: ${summary.reads}`,
  `- Mutating tools: ${summary.mutations}`,
  `- Core-source tools: ${summary.core}`,
  `- Site/plugin-source tools: ${summary.site}`,
  '',
  '## Safety Contract',
  '- Every mutating endpoint tool accepts `confirm` and requires `confirm: true` while safe mode is enabled.',
  '- Workflow tools separate planning from execution using `mode: "plan" | "execute"`.',
  '- Validation failures are returned before any write is attempted.',
  '- Use `agent_bootstrap` first when an agent is new to the site and needs orientation recipes instead of exhaustive reference material.',
  '',
  '## Workflow Tools',
  '- `workflow_draft_or_update_post`',
  '- `workflow_media_featured_image`',
  '- `workflow_taxonomy_reconcile`',
  '- `workflow_list_menu_structure`',
  '- `workflow_upsert_menu_item`',
  '- `workflow_assign_menu_locations`',
  '- `workflow_reorder_menu_items`',
  '- `workflow_clone_menu`',
  '- `workflow_get_post_urls`',
  '- `workflow_inspect_post`',
  '- `workflow_inspect_elementor_document`',
  '- `workflow_validate_elementor_document`',
  '- `workflow_inspect_elementor_history`',
  '- `workflow_list_elementor_templates`',
  '- `workflow_get_elementor_template_conditions`',
  '- `workflow_clone_elementor_document`',
  '- `workflow_cleanup_elementor_kit`',
  '- `workflow_import_elementor_document_media`',
  '- `workflow_diff_elementor_documents`',
  '- `workflow_restore_elementor_candidate`',
  '- `workflow_nexport_blog_post`',
  '',
  '## Guidance Tools',
  '- `agent_bootstrap`',
  '- `help`',
  '- `tool_catalog`',
  '',
  '## Endpoint Tools',
  '| Tool | Method | Route | Source | Mutation |',
  '| --- | --- | --- | --- | --- |',
  ...operations.map(
    (operation) =>
      `| \`${operation.toolName}\` | \`${operation.method}\` | \`${operation.route}\` | \`${operation.source}\` | \`${operation.mutation}\` |`
  ),
  ''
];

writeText(PATHS.generatedCatalog, `${lines.join('\n')}\n`);
console.log(`Generated ${PATHS.generatedCatalog}`);
