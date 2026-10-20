import { describe, expect, test } from 'bun:test';
import { prepareIso, manifest, GAME_EXE_SHA256 } from '../browser-runtime/src/shrek/import-core';
import { BufferSource } from '../browser-runtime/packages/formats/src/unpack/source';

describe('local ISO import validation', () => {
  test('rejects a tiny file without reading it', async () => {
    let reads = 0;
    await expect(prepareIso({ size: 12, readRangeSync() { reads++; return new Uint8Array(); } })).rejects.toThrow('PC CD-ROM');
    expect(reads).toBe(0);
  });
  test('rejects unsupported large images before allocating a payload', async () => {
    await expect(prepareIso({ size: 3 * 1024 ** 3, readRangeSync() { throw new Error('Must not read'); } })).rejects.toThrow('PC CD-ROM');
  });
  test('rejects a renamed file with no ISO filesystem', async () => {
    await expect(prepareIso(new BufferSource(new Uint8Array(64 * 1024)))).rejects.toThrow('not an ISO9660');
  });
  test('publishes native DLL requirements and a stable save identity', () => {
    expect(manifest.emulator.appDirDlls).toEqual(['binkw32', 'msvcr70']);
    expect(manifest.entrypoint).toBe('rom/System/Game.exe');
    expect(manifest.gameId).toBe('app:shrek2-pc-en');
    expect(GAME_EXE_SHA256).toHaveLength(64);
  });
});
