import { buildOperationsFromRouteIndex, ensureGeneratedDirectory, loadRouteIndex, summarizeOperations } from '../src/generator.js';
import { PATHS } from '../src/paths.js';
import { writeJson } from '../src/utils.js';

ensureGeneratedDirectory();
const routeIndex = loadRouteIndex();
const operations = buildOperationsFromRouteIndex(routeIndex);
const summary = summarizeOperations(operations);
writeJson(PATHS.generatedOperations, operations);
console.log(JSON.stringify({ generated: PATHS.generatedOperations, summary }, null, 2));
