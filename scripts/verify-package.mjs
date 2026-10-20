import { readdir, stat, readFile } from 'node:fs/promises';
import path from 'node:path';
import { root } from './prepare-runtime.mjs';
let total = 0;
async function verify(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const file = path.join(directory, entry.name);
    if (entry.isSymbolicLink()) throw new Error(`Symlink in deployment: ${file}`);
    if (entry.isDirectory()) { await verify(file); continue; }
    if (/\.(iso|wgb|cab|msi|exe|dll|unr|uax|utx|ukx|usx|bik|ogg)$/i.test(file)) throw new Error(`Game data in deployment: ${file}`);
    const size = (await stat(file)).size; total += size;
    if (size > 15 * 1024 ** 2) throw new Error(`Unexpectedly large runtime asset: ${file}`);
    if (/\.(js|json|html|css|md)$/.test(file)) {
      const text = await readFile(file, 'utf8');
      if (/\/Users\/[^/]+\//.test(text) || /gh[opusr]_[A-Za-z0-9]{30,}/.test(text)) throw new Error(`Local path or credential in deployment: ${file}`);
    }
  }
}
await verify(path.join(root, 'dist'));
if (total > 40 * 1024 ** 2) throw new Error('Unexpected deployment size; inspect for accidental data.');
console.log(`Deployment verified: ${(total / 1024 ** 2).toFixed(1)} MB, no commercial game payloads.`);
