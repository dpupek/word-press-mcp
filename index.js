#!/usr/bin/env node

import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { startServer } from './src/server.js';

const entryPath = path.resolve(process.argv[1] || '');
const modulePath = path.resolve(fileURLToPath(import.meta.url));

if (entryPath && entryPath === modulePath) {
  startServer().catch((error) => {
    console.error('wordpress-mcp failed to start', error);
    process.exit(1);
  });
}
