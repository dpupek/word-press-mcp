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
      process.platform === 'win32' && /\.(cmd|bat)$/i.test(command)
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

    child.on('close', (code, signal) => {
      clearTimeout(timer);
      if (!settled) {
        settled = true;
        if (stdout.trim().length > 0) {
          reject(new Error(`Expected no stdout during MCP startup smoke, but received:\n${stdout}`));
          return;
        }

        reject(
          new Error(
            [
              'Server exited during MCP startup smoke before the readiness timeout.',
              `Exit code: ${code ?? 'null'}`,
              `Signal: ${signal ?? 'null'}`,
              stderr ? `STDERR:\n${stderr}` : 'STDERR:\n<empty>'
            ].join('\n')
          )
        );
      }
    });
  });
}

async function main() {
  const tempRoot = await fsp.mkdtemp(path.join(os.tmpdir(), 'wordpress-mcp-package-'));
  const packSourceDir = path.join(tempRoot, 'pack-source');
  const installDir = path.join(tempRoot, 'install');

  try {
    await copyDirectory(rootDir, packSourceDir);
    await runCommand(npmCommand, ['pack'], { cwd: packSourceDir, env: process.env });

    const metadata = JSON.parse(await fsp.readFile(path.join(packSourceDir, 'package.json'), 'utf8'));
    const tarballName = `${metadata.name}-${metadata.version}.tgz`;
    const tarballPath = path.join(packSourceDir, tarballName);

    await fsp.mkdir(installDir, { recursive: true });
    await fsp.writeFile(path.join(installDir, 'package.json'), JSON.stringify({ name: 'smoke-install', private: true }), 'utf8');
    await runCommand(npmCommand, ['install', tarballPath], { cwd: installDir, env: process.env });

    const installedPackageDir = path.join(installDir, 'node_modules', metadata.name);
    const generatedOperationsPath = path.join(installedPackageDir, 'src', 'generated', 'operations.generated.json');
    const coreNamespacesPath = path.join(installedPackageDir, 'spec', 'core-namespaces.json');

    if (metadata.scripts?.prepare !== 'npm run build') {
      throw new Error(`Expected prepare script to be "npm run build" but found "${metadata.scripts?.prepare || ''}".`);
    }

    if (!fs.existsSync(generatedOperationsPath)) {
      throw new Error(`Generated operations file missing after fresh install: ${generatedOperationsPath}`);
    }

    if (!fs.existsSync(coreNamespacesPath)) {
      throw new Error(`Runtime spec file missing after packed install: ${coreNamespacesPath}`);
    }

    for (const relative of [
      'skills/upstream.json', 'skills/COPYING.wordpress', 'skills/wp-rest-api/references/authentication.md',
      'skills/wordpress-mcp-operations/SKILL.md', '.codex-plugin/plugin.json',
      '.claude-plugin/plugin.json', '.mcp.json', 'THIRD_PARTY_NOTICES.md'
    ]) {
      if (!fs.existsSync(path.join(installedPackageDir, relative))) {
        throw new Error(`Bundled skill/plugin file missing after packed install: ${relative}`);
      }
    }
    await runCommand(process.execPath, ['--input-type=module', '-e',
      "import { createSkillCatalog } from './src/skills.js'; const c = createSkillCatalog(); if (c.entries.length !== 20 || createSkillCatalog({profile:'import'}).list().skills.length !== 5) process.exit(1);"
    ], { cwd: installedPackageDir, env: process.env });

    const smokeResult = await smokeRunServer(installedPackageDir);

    console.log(
      JSON.stringify(
        {
          ok: true,
          installDir,
          installedPackageDir,
          prepareScript: metadata.scripts.prepare,
          stdoutBytes: smokeResult.stdout.length,
          stderrBytes: smokeResult.stderr.length,
          generatedOperationsPath,
          coreNamespacesPath,
          tarballPath
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
