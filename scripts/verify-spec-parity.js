import { loadOperations, loadRouteIndex, verifyOperationsAgainstRouteIndex } from '../src/generator.js';

const result = verifyOperationsAgainstRouteIndex(loadOperations(), loadRouteIndex());
if (!result.ok) {
  console.error(JSON.stringify(result, null, 2));
  process.exit(1);
}
console.log(JSON.stringify(result, null, 2));
