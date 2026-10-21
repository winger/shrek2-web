# Shrek 2 Web Player

A static, bring-your-own-disc player for the **English 2004 Windows PC CD-ROM edition** of Shrek 2. Built on [BottleShip](https://github.com/jenissimo/bottleship), which executes the original x86 game in WebAssembly and implements Windows graphics/audio/input interfaces using browser APIs.

**Compatibility preview:** disc import, menu navigation, opening cutscenes and keyboard movement in the swamp level have been tested. Some terrain/texture rendering artifacts remain, and a full playthrough has not been verified. This is not an official release and is not affiliated with Activision or DreamWorks.

## Play

Open the [web player](https://winger.github.io/shrek2-web/) in current desktop Chrome or Edge. Choose your own Shrek 2 `.iso`, wait for local extraction, then select **Play Shrek 2**. The importer currently accepts the executable with SHA-256:

```text
4900aa131cf35d4951943f2d6ee831841745af8e5d657ffdcfd7fb012cbaa2ef
```

The [example disc listing](https://archive.org/details/shrek-2_20210622) illustrates the supported edition; it does not establish download or redistribution rights. Use your own legitimately obtained copy.

- The selected ISO, extracted files and saves stay on your device. No upload endpoint, game download, telemetry or server execution is used.
- Allow about 650 MB of browser storage, plus temporary space while importing or replacing the game. The original ISO is not copied into browser storage.
- The importer reads ISO9660/Joliet and the original MSI/CAB data, restores installed filenames, and verifies installer checksums. It does not run the Windows installer or custom actions.
- Saves are stored in the browser's Origin Private File System. Clearing this site's data removes both the import and saves. Use the player's storage tools to back up important saves.
- Click inside the game for mouse capture. Escape releases capture; F11 toggles fullscreen. Use the game's original control bindings.

The production artifact contains only open-source runtime components, the launcher, and notices. Commercial game files are excluded from both the repository and Pages deployment. There is no native Wine/Docker installation or game streaming requirement.

## Build locally

Requires Node.js 22+ and Bun **1.4.3**. The build retrieves exact upstream revisions from `runtime-lock.json`, applies the reviewed compatibility patch, and builds static assets.

```sh
npm test
BASE_PATH=/shrek2-web/ npm run build
BASE_PATH=/shrek2-web/ npm run preview
```

Open `http://localhost:4173/shrek2-web/`. The preview deliberately omits COOP/COEP HTTP headers to test the same service-worker isolation flow used on GitHub Pages. First visits reload once after the isolation service worker activates. Browsers that cannot establish isolation receive an explanatory error instead of a boot loop.

`BUN_BIN=/absolute/path/to/bun` can select a Bun executable. Downloaded runtime source and dependencies live in the ignored `browser-runtime/` directory. `local/` and `dist/` are also ignored.

### Optional test with your own ISO

```sh
bun tests/import-local.ts /path/to/Shrek2.iso
```

This reads the ISO locally, verifies its payload and fails if the import tries to use the network. Passing a third argument containing an installation SHA-256 manifest additionally compares every installed byte. No game files are included in automated public CI.

## GitHub Pages

`.github/workflows/pages.yml` tests and builds on pushes to `main`, then publishes the runtime-only `dist/` artifact using GitHub's Pages actions. Configure the repository's Pages source as **GitHub Actions**. Vite's base path comes from `actions/configure-pages`, so assets and navigation work under the repository URL.

The scoped `isolation-sw.js` adds the COOP/COEP response policies required for SharedArrayBuffer on static hosting. It does not cache responses, remap unrelated paths, or access the player's selected ISO. All shipped runtime URLs explicitly honor the Vite deployment base.

`scripts/verify-package.mjs` rejects game-file extensions, unexpectedly large files, credentials, machine-specific paths and symlinks in the deployment artifact.

## Runtime changes

`patches/bottleship.patch` contains the changes to the pinned upstream runtime:

1. Honor explicit `appDirDlls` rules when choosing native video DLLs, so the original Bink decoder can provide its audio-track API.
2. Resolve versioned CRT files under their actual requested name when an app-directory rule overrides an HLE alias.
3. Upload CPU-written D3D8 backbuffers before presentation, including native video frames that are not followed by a primitive draw. Authority checks preserve GPU-rendered frames.
4. Preserve both regions of wrapped DirectSound writes. Dropping the region at the start of the buffer replayed stale audio every buffer lap (about 2.7 times per second with the game's 32 KiB, 22.05 kHz stereo buffer).
5. Use the deployment base for static runtime assets and navigation, and omit unrelated game covers/reference images from publication.

The loader, backbuffer, and audio corrections are generic runtime fixes, covered by regression tests. The browser uses the original game-shipped DLLs from the user's ISO; no new substitute implementations or game patches are distributed.

## Licenses

Launcher and build integration: MIT, see `LICENSE`. BottleShip: Apache-2.0. v86: BSD-2-Clause, with additional component licenses. The deployed `licenses/` directory includes notices and exact corresponding-source links. See the upstream [third-party notices](https://github.com/jenissimo/bottleship/blob/f2b611b4128373c69a1e1615c84c3a6dd1d52bcc/THIRD-PARTY-NOTICES.md).

Shrek 2, its characters, trademarks, executable code, artwork and audio belong to their respective rights holders. Ownership of a disc or use of this player does not grant redistribution rights.
