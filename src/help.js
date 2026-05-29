import { PATHS } from './paths.js';
import { readTextIfExists } from './utils.js';

export function loadStaticHelp() {
  return readTextIfExists(
    PATHS.staticHelp,
    ['# WordPress MCP Helper', '', 'Run `npm run generate` to build the generated manifest and tool catalog.'].join('\n')
  );
}

export function loadAgentBootstrap() {
  return readTextIfExists(
    PATHS.agentBootstrap,
    [
      '# WordPress MCP Agent Bootstrap',
      '',
      '1. Run `health` first.',
      '2. Fetch the site identity and current capabilities.',
      '3. Prefer workflow tools before raw endpoint tools.'
    ].join('\n')
  );
}

export function loadWorkflowRecipes() {
  return readTextIfExists(
    PATHS.workflowRecipes,
    ['# WordPress MCP Workflow Recipes', '', 'Run `agent_bootstrap` first, then use workflow-specific recipes.'].join('\n')
  );
}

export function loadTroubleshooting() {
  return readTextIfExists(
    PATHS.troubleshooting,
    ['# WordPress MCP Troubleshooting', '', 'Run `workflow_get_site_capabilities` and inspect the normalized MCP error envelope first.'].join('\n')
  );
}

export function loadGeneratedCatalog() {
  return readTextIfExists(PATHS.generatedCatalog, '# Generated tool catalog unavailable.\n');
}
