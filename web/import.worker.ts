/// <reference lib="webworker" />
import { prepareIso, manifest, CACHE_KEY } from './import-core';
import { writeZipStream } from '@bottleship/formats/wgb/zip-stream';
import { BufferSource } from '@bottleship/formats/zip';

declare const self: DedicatedWorkerGlobalScope;

self.onmessage = async (event: MessageEvent<{ file: File }>) => {
  const file = event.data.file;
  let directory: FileSystemDirectoryHandle | undefined;
  let handle: FileSystemSyncAccessHandle | undefined;
  const temporary = CACHE_KEY + '.importing';
  try {
    const reader = new FileReaderSync();
    const files = await prepareIso({
      size: file.size,
      readRangeSync(start, end) {
        if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || end < start || end > file.size) throw new Error('Disc data extends beyond the selected file.');
        return new Uint8Array(reader.readAsArrayBuffer(file.slice(start, end)));
      },
    }, progress => self.postMessage({ type: 'progress', ...progress }));
    const root = await navigator.storage.getDirectory();
    const bottleship = await root.getDirectoryHandle('bottleship', { create: true });
    directory = await bottleship.getDirectoryHandle('wgb-cache', { create: true });
    const fileHandle = await directory.getFileHandle(temporary, { create: true });
    handle = await fileHandle.createSyncAccessHandle();
    handle.truncate(0);
    const encoder = new TextEncoder();
    const entries = [
      { name: 'manifest.json', source: new BufferSource(encoder.encode(JSON.stringify(manifest))) },
      { name: 'registry.json', source: new BufferSource(encoder.encode('{}')) },
      ...Array.from(files, ([name, bytes]) => ({ name: 'rom/' + name, source: new BufferSource(bytes) })),
    ];
    const total = Array.from(files.values()).reduce((n, bytes) => n + bytes.length, 0);
    let lastPercent = -1;
    await writeZipStream(entries, {
      write(bytes, at) {
        if (handle!.write(bytes, { at }) !== bytes.length) throw new Error('Your browser could not finish writing the game. Free some disk space and try again.');
      },
    }, written => {
      const percent = Math.min(99, 75 + Math.round(written / total * 24));
      if (percent !== lastPercent) {
        self.postMessage({ type: 'progress', phase: 'Saving on this device', percent });
        lastPercent = percent;
      }
    });
    handle.flush(); handle.close(); handle = undefined;
    // move() atomically publishes the finished file; an interrupted import never
    // replaces the working game. Chromium's OPFS implements this API.
    const movable = fileHandle as FileSystemFileHandle & { move(name: string): Promise<void> };
    if (typeof movable.move !== 'function') throw new Error('This browser cannot safely finish the import. Please use a current Chrome or Edge browser.');
    await movable.move(CACHE_KEY);
    self.postMessage({ type: 'complete', files: files.size, bytes: total });
    self.close();
  } catch (error) {
    handle?.close();
    try { await directory?.removeEntry(temporary); } catch { /* no temporary file */ }
    self.postMessage({ type: 'error', message: error instanceof Error ? error.message : String(error) });
    self.close();
  }
};
