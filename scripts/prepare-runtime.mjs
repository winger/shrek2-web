import { existsSync } from 'node:fs';
import { readFile, writeFile, mkdir, cp, rm } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import os from 'node:os';

export const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const runtime = path.join(root, 'browser-runtime');
const lock = JSON.parse(await readFile(path.join(root, 'runtime-lock.json'), 'utf8'));
export const bun = process.env.BUN_BIN || (existsSync(path.join(root, 'local/tools/bun-darwin-aarch64/bun')) ? path.join(root, 'local/tools/bun-darwin-aarch64/bun') : 'bun');
export function run(command, args, options = {}) {
  const result = spawnSync(command, args, { cwd: runtime, stdio: 'inherit', ...options });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${command} failed (${result.status})`);
}

async function downloadTree(repository, revision, destination) {
  await mkdir(destination, { recursive: true });
  const response = await fetch(`https://codeload.github.com/${repository}/tar.gz/${revision}`);
  if (!response.ok) throw new Error(`Could not download ${repository}: HTTP ${response.status}`);
  const archive = path.join(os.tmpdir(), `shrek2-${revision}.tar.gz`);
  await writeFile(archive, Buffer.from(await response.arrayBuffer()));
  try { run('tar', ['-xzf', archive, '-C', destination, '--strip-components=1'], { cwd: root }); }
  finally { await rm(archive, { force: true }); }
}

export async function prepare() {
  if (!existsSync(path.join(runtime, 'package.json'))) await downloadTree('jenissimo/bottleship', lock.bottleship, runtime);
  if (!existsSync(path.join(runtime, 'vendor/v86/build/libv86.mjs'))) await downloadTree('jenissimo/v86', lock.v86, path.join(runtime, 'vendor/v86'));
  const patches = path.join(root, 'patches/bottleship.patch');
  const patchArgs = ['apply', '--directory=browser-runtime'];
  const check = spawnSync('git', [...patchArgs, '--check', patches], { cwd: root, stdio: 'ignore' });
  if (check.status === 0) run('git', [...patchArgs, patches], { cwd: root });
  else {
    const reverse = spawnSync('git', [...patchArgs, '--reverse', '--check', patches], { cwd: root, stdio: 'ignore' });
    if (reverse.status !== 0) throw new Error('The runtime differs from the pinned source and patch. Preserve your edits before resetting browser-runtime.');
  }
  await cp(path.join(root, 'web'), path.join(runtime, 'src/shrek'), { recursive: true });
  await cp(path.join(root, 'web/index.html'), path.join(runtime, 'index.html'));
  await cp(path.join(root, 'web/public'), path.join(runtime, 'public'), { recursive: true });
  await writeFile(path.join(runtime, 'src/main.tsx'), "import './shrek/bootstrap';\n");
  await mkdir(path.join(runtime, 'public/licenses'), { recursive: true });
  for (const name of ['LICENSE', 'THIRD-PARTY-NOTICES.md']) await cp(path.join(runtime, name), path.join(runtime, 'public/licenses', name));
  for (const name of ['LICENSE', 'LICENSE.MIT']) {
    if (existsSync(path.join(runtime, 'vendor/v86', name))) await cp(path.join(runtime, 'vendor/v86', name), path.join(runtime, 'public/licenses', `v86-${name}`));
  }
  await cp(path.join(runtime, 'vendor/v86/bios/COPYING.LESSER'), path.join(runtime, 'public/licenses/SeaBIOS-LGPL-3.0.txt'));
  for (const name of ['react', 'react-dom', 'pako', 'lucide-react', '@phosphor-icons/react']) {
    const location = path.join(runtime, 'node_modules', name, 'LICENSE');
    if (existsSync(location)) await cp(location, path.join(runtime, 'public/licenses', `${name.replaceAll('/', '-')}-LICENSE.txt`));
  }
  await writeFile(path.join(runtime, 'public/licenses/SOURCE.md'), `This site uses BottleShip ${lock.bottleship} and v86 ${lock.v86}.\n\nCorresponding source and build scripts: https://github.com/jenissimo/bottleship/tree/${lock.bottleship} and https://github.com/jenissimo/v86/tree/${lock.v86}.\n\nSite modifications and build instructions: https://github.com/winger/shrek2-web\n`);
  if (!existsSync(path.join(runtime, 'node_modules/vite'))) run(bun, ['install', '--frozen-lockfile', '--ignore-scripts']);
}
if (process.argv[1] === fileURLToPath(import.meta.url)) await prepare();
