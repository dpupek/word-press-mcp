import fs from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';

function quoteWindowsArg(value) {
  if (/^[A-Za-z0-9_./:\\-]+$/.test(value)) {
    return value;
  }

  return `"${String(value).replace(/"/g, '\\"')}"`;
}

async function copyDirectory(sourceDir, targetDir) {
  await fsp.mkdir(targetDir, { recursive: true });
  const entries = await fsp.readdir(sourceDir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === '.git' || entry.name === 'node_modules') {
      continue;
    }

    const sourcePath = path.join(sourceDir, entry.name);
    const targetPath = path.join(targetDir, entry.name);

    if (entry.isDirectory()) {
      await copyDirectory(sourcePath, targetPath);
      continue;
    }

    await fsp.copyFile(sourcePath, targetPath);
  }
}

function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const spawnOptions = {
      cwd: options.cwd,
      env: options.env,
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe']
    };

    const child =
      process.platform === 'win32'
        ? spawn(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', [command, ...args].map(quoteWindowsArg).join(' ')], spawnOptions)
        : spawn(command, args, spawnOptions);

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('error', reject);
    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`${command} ${args.join(' ')} failed with code ${code}\nSTDOUT:\n${stdout}\nSTDERR:\n${stderr}`));
        return;
      }

      resolve({ stdout, stderr });
    });
  });
}

async function smokeRunServer(cwd) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['index.js'], {
      cwd,
      env: {
        ...process.env,
        WORDPRESS_MCP_DEBUG: 'false'
      },
      shell: false,
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let stdout = '';
    let stderr = '';
    let settled = false;

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('error', (error) => {
      if (!settled) {
        settled = true;
        reject(error);
      }
    });

    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill();

      if (stdout.trim().length > 0) {
        reject(new Error(`Expected no stdout during MCP startup smoke, but received:\n${stdout}`));
        return;
      }

      resolve({ stdout, stderr });
    }, 1500);

    child.on('close', () => {
      clearTimeout(timer);
      if (!settled) {
        settled = true;
        if (stdout.trim().length > 0) {
          reject(new Error(`Expected no stdout during MCP startup smoke, but received:\n${stdout}`));
          return;
        }

        resolve({ stdout, stderr });
      }
    });
  });
}

async function main() {
  const tempRoot = await fsp.mkdtemp(path.join(os.tmpdir(), 'wordpress-mcp-package-'));
  const checkoutDir = path.join(tempRoot, 'repo');

  try {
    await copyDirectory(rootDir, checkoutDir);
    await runCommand(npmCommand, ['install'], { cwd: checkoutDir, env: process.env });
    const metadata = JSON.parse(await fsp.readFile(path.join(checkoutDir, 'package.json'), 'utf8'));
    const generatedOperationsPath = path.join(checkoutDir, 'src', 'generated', 'operations.generated.json');

    if (metadata.scripts?.prepare !== 'npm run build') {
      throw new Error(`Expected prepare script to be "npm run build" but found "${metadata.scripts?.prepare || ''}".`);
    }

    if (!fs.existsSync(generatedOperationsPath)) {
      throw new Error(`Generated operations file missing after fresh install: ${generatedOperationsPath}`);
    }

    const smokeResult = await smokeRunServer(checkoutDir);

    console.log(
      JSON.stringify(
        {
          ok: true,
          checkoutDir,
          prepareScript: metadata.scripts.prepare,
          stdoutBytes: smokeResult.stdout.length,
          stderrBytes: smokeResult.stderr.length,
          generatedOperationsPath
        },
        null,
        2
      )
    );
  } finally {
    await fsp.rm(tempRoot, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error.stack || error.message || String(error));
  process.exit(1);
});
