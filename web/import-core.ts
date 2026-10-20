import { IsoImage, parseIso9660 } from '@bottleship/formats/iso';
import type { RandomAccessSource } from '@bottleship/formats/unpack/source';
import { MsiDatabase, msiFilePaths } from '@bottleship/formats/msi';
import { extractMsiPayload } from '@bottleship/repack/msi-extract';
import { inflateRaw } from 'pako';

export const GAME_EXE_SHA256 = '4900aa131cf35d4951943f2d6ee831841745af8e5d657ffdcfd7fb012cbaa2ef';
export const CACHE_KEY = 'shrek2-pc-en-v1.wgb';
export type ImportProgress = { phase: string; percent: number; detail?: string };
export const manifest = {
  formatVersion: 2, gameId: 'app:shrek2-pc-en', name: 'Shrek 2',
  entrypoint: 'rom/System/Game.exe', rom: 'rom', registry: 'registry.json',
  emulator: {
    osVersion: { major: 5, minor: 1, build: 2600, platformId: 2 },
    screenResolution: { width: 800, height: 600, bpp: 32 },
    memory: { ram: 268435456 }, appDirDlls: ['binkw32', 'msvcr70'],
    cdPath: 'C:\\', cdLabel: 'Shrek2',
  },
};

/** No network access: all inputs are ranges read from the selected local ISO. */
export async function prepareIso(source: RandomAccessSource, progress: (p: ImportProgress) => void = () => {}) {
  if (source.size < 32768 || source.size > 2 * 1024 ** 3) throw new Error('Choose the English 2004 Windows PC CD-ROM ISO (about 423 MB).');
  progress({ phase: 'Reading disc', percent: 2 });
  const image = IsoImage.mount(source);
  const filesystem = parseIso9660(image);
  const entries = new Map(filesystem.files.map(f => [f.path.toLowerCase(), f]));
  const read = (name: string, limit: number) => {
    const entry = entries.get(name.toLowerCase());
    if (!entry) throw new Error(`This disc is missing ${name}. Choose the English 2004 Windows PC edition.`);
    if (entry.size > limit || entry.lba * 2048 + entry.size > source.size) throw new Error(`Invalid disc file: ${name}`);
    return image.readExtent(entry.lba, entry.size);
  };
  const executable = read('Game.exe', 1024 ** 2);
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', executable.slice().buffer));
  const sha = Array.from(digest, b => b.toString(16).padStart(2, '0')).join('');
  if (sha !== GAME_EXE_SHA256) throw new Error('This executable is a different game build. This player currently supports the English 2004 PC CD-ROM edition.');
  const msi = read('Shrek 2.msi', 16 * 1024 ** 2);
  const database = new MsiDatabase(msi);
  const paths = msiFilePaths(database, 'INSTALLDIR');
  if (!paths.length || paths.length > 2000 || paths.reduce((n, f) => n + f.size, 0) > 1024 ** 3) throw new Error('The installer payload is not a supported size.');
  progress({ phase: 'Extracting game files', percent: 5, detail: 'Unpacking the original installer locally' });
  const files = await extractMsiPayload(msi, name => read(name, 600 * 1024 ** 2), {
    inflateBlock: (chunk, dictionary, size) => {
      const out = inflateRaw(chunk, dictionary ? { dictionary } : {});
      if (out.byteLength !== size) throw new Error('The installer contains a damaged compressed block.');
      return out;
    },
    onProgress: (done, total, name) => progress({ phase: 'Verifying game files', percent: 10 + Math.round(done / total * 65), detail: name }),
  });
  files.set('System/Game.exe', executable);
  for (const required of ['System/Core.dll', 'System/Engine.dll', 'System/binkw32.dll', 'System/msvcr70.dll', 'System/Default.ini', 'Maps/1_Shreks_Swamp.unr']) {
    if (![...files.keys()].some(n => n.toLowerCase() === required.toLowerCase())) throw new Error(`Required game file missing: ${required}`);
  }
  return files;
}
