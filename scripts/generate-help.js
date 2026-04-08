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
  '',
  '## Workflow Tools',
  '- `workflow_draft_or_update_post`',
  '- `workflow_media_featured_image`',
  '- `workflow_taxonomy_reconcile`',
  '- `workflow_inspect_post`',
  '- `workflow_inspect_elementor_document`',
  '- `workflow_validate_elementor_document`',
  '- `workflow_inspect_elementor_history`',
  '- `workflow_list_elementor_templates`',
  '- `workflow_get_elementor_template_conditions`',
  '- `workflow_clone_elementor_document`',
  '- `workflow_import_elementor_document_media`',
  '- `workflow_diff_elementor_documents`',
  '- `workflow_restore_elementor_candidate`',
  '- `workflow_nexport_blog_post`',
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
