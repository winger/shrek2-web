import { prepare, run, bun, root } from './prepare-runtime.mjs';
await prepare();
run(bun, ['tools/generate-reference-argcounts.ts']);
run(bun, ['tools/generate-index.ts']);
run(bun, ['node_modules/tsgo/bin/tsc', '-p', 'tsconfig.json', '--noEmit']);
run(bun, ['test', 'tools/tests/native-video-selection.test.ts', 'tools/tests/pe-import-binding.test.ts', 'tools/tests/iso-format.test.ts', 'tools/tests/msi-payload.test.ts', 'tools/tests/d3d8-cpu-present.test.ts', 'tools/tests/d3d8-lock-conformance.test.ts']);
run(bun, ['test', 'tests/import.test.ts'], { cwd: root });
