import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT_DIR = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

export const PATHS = {
  root: ROOT_DIR,
  docs: path.join(ROOT_DIR, 'docs'),
  spec: path.join(ROOT_DIR, 'spec'),
  liveSpec: path.join(ROOT_DIR, 'spec', 'live', 'test-nexportsolutions-route-index.json'),
  generatedDir: path.join(ROOT_DIR, 'src', 'generated'),
  generatedOperations: path.join(ROOT_DIR, 'src', 'generated', 'operations.generated.json'),
  generatedCatalog: path.join(ROOT_DIR, 'docs', 'generated-tool-catalog.md'),
  staticHelp: path.join(ROOT_DIR, 'docs', 'wordpress-help.md')
};
