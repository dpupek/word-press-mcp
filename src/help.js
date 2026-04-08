import { PATHS } from './paths.js';
import { readTextIfExists } from './utils.js';

export function loadStaticHelp() {
  return readTextIfExists(
    PATHS.staticHelp,
    ['# WordPress MCP Helper', '', 'Run `npm run generate` to build the generated manifest and tool catalog.'].join('\n')
  );
}

export function loadGeneratedCatalog() {
  return readTextIfExists(PATHS.generatedCatalog, '# Generated tool catalog unavailable.\n');
}
