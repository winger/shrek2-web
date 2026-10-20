// Optional integration check against an ISO the developer already owns.
// No game files or generated game bundles are written or published by this test.
import { openSync, readSync, closeSync, statSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { prepareIso } from '../browser-runtime/src/shrek/import-core';
const iso = process.argv[2];
if (!iso) throw new Error('Pass a local ISO path');
const fd = openSync(iso, 'r');
const fetchOriginal = globalThis.fetch;
globalThis.fetch = () => { throw new Error('ISO import must not access the network'); };
try {
  const files = await prepareIso({
    size: statSync(iso).size,
    readRangeSync(start, end) {
      const buffer = new Uint8Array(end - start);
      if (readSync(fd, buffer, 0, buffer.length, start) !== buffer.length) throw new Error('Truncated ISO');
      return buffer;
    },
  });
  const expectedPath = process.argv[3];
  if (expectedPath) {
    const expected = JSON.parse(readFileSync(expectedPath, 'utf8'));
    if (files.size !== expected.length) throw new Error('Installed file count mismatch');
    for (const entry of expected) {
      const bytes = files.get(entry.path);
      if (!bytes || createHash('sha256').update(bytes).digest('hex') !== entry.sha256) throw new Error(`Installed file mismatch: ${entry.path}`);
    }
  }
  console.log(`Verified ${files.size} original files; every expected SHA-256 matched. Network calls: zero.`);
} finally { closeSync(fd); globalThis.fetch = fetchOriginal; }
