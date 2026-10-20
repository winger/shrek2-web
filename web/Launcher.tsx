import React, { useEffect, useRef, useState } from 'react';
import { CACHE_KEY, type ImportProgress } from './import-core';
import './launcher.css';

type Imported = { files: number; bytes: number };
const IMPORT_KEY = 'shrek2.import.v1';

export default function Launcher() {
  const [ready, setReady] = useState(false);
  const [checking, setChecking] = useState(true);
  const [status, setStatus] = useState<ImportProgress | null>(null);
  const [error, setError] = useState('');
  const [dragging, setDragging] = useState(false);
  const [supported, setSupported] = useState(true);
  const input = useRef<HTMLInputElement>(null);
  const worker = useRef<Worker | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const canRun = typeof SharedArrayBuffer !== 'undefined' && crossOriginIsolated && 'gpu' in navigator && !!navigator.storage?.getDirectory && typeof OffscreenCanvas !== 'undefined';
        if (alive) setSupported(canRun);
        const root = await navigator.storage.getDirectory();
        const dir = await (await root.getDirectoryHandle('bottleship')).getDirectoryHandle('wgb-cache');
        const file = await (await dir.getFileHandle(CACHE_KEY)).getFile();
        if (alive) setReady(file.size > 1024 ** 2 && !!localStorage.getItem(IMPORT_KEY));
      } catch { /* First visit has no local game. */ }
      if (alive) setChecking(false);
    })();
    return () => { alive = false; worker.current?.terminate(); };
  }, []);

  async function importFile(file?: File) {
    if (!file || status || checking || !supported) return;
    setError('');
    if (!file.name.toLowerCase().endsWith('.iso')) { setError('Choose a .iso disc image of the English 2004 PC edition.'); return; }
    setStatus({ phase: 'Checking available storage', percent: 0 });
    try {
      const estimate = await navigator.storage.estimate();
      if (estimate.quota && estimate.usage !== undefined && estimate.quota - estimate.usage < 750 * 1024 ** 2) throw new Error('At least 750 MB of browser storage is needed. Free some space and try again.');
      await navigator.storage.persist?.();
      const importer = new Worker(new URL('./import.worker.ts', import.meta.url), { type: 'module' });
      worker.current = importer;
      importer.onmessage = (event) => {
        const data = event.data;
        if (data.type === 'progress') setStatus(data);
        if (data.type === 'error') { setError(data.message); setStatus(null); worker.current = null; }
        if (data.type === 'complete') {
          localStorage.setItem(IMPORT_KEY, JSON.stringify(data as Imported));
          setReady(true); setStatus(null); worker.current = null;
        }
      };
      importer.onerror = () => { setError('The importer stopped unexpectedly. Reload the page and try again in Chrome or Edge.'); setStatus(null); importer.terminate(); worker.current = null; };
      importer.postMessage({ file });
    } catch (e) { setError(e instanceof Error ? e.message : String(e)); setStatus(null); }
  }

  async function removeGame() {
    if (!confirm('Remove the imported game files from this browser? Saved progress will be kept.')) return;
    try {
      const root = await navigator.storage.getDirectory();
      const dir = await (await root.getDirectoryHandle('bottleship')).getDirectoryHandle('wgb-cache');
      await dir.removeEntry(CACHE_KEY);
      localStorage.removeItem(IMPORT_KEY); setReady(false);
    } catch { setError('The game files are in use. Close other game tabs and try again.'); }
  }

  return <div className="shrek-site">
    <header className="site-header"><a className="wordmark" href="./" aria-label="Shrek 2 Web home"><span className="mark">S<span>2</span></span><span>SHREK 2 <small>WEB PLAYER</small></span></a><a className="source-link" href="https://github.com/winger/shrek2-web" target="_blank" rel="noopener noreferrer">Source code ↗</a></header>
    <main>
      <section className="intro"><p className="eyebrow"><span /> THE 2004 PC ADVENTURE · IN YOUR BROWSER</p><h1>Somebody once<br />told me… <em>press play.</em></h1><p className="intro-copy">Back to the swamp. Bring your own Shrek 2 disc image and play the original PC game on your Mac.</p></section>
      <section className="import-card" aria-label="Import and play Shrek 2">
        <div className="card-top"><span className="section-number">01 / YOUR COPY</span><span className="local-badge">◉ Local files only</span></div>
        {!supported && <div className="notice" role="alert">This player needs WebGPU, local browser storage, and cross-origin isolation. Open it in a current desktop Chrome or Edge browser. If isolation is unavailable, enable service workers and reload.</div>}
        <div className={`drop-zone ${dragging ? 'is-dragging' : ''}`} onDragOver={event => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={event => { event.preventDefault(); setDragging(false); void importFile(event.dataTransfer.files[0]); }}>
          <div className="disc" aria-hidden="true"><div /></div>
          <div className="drop-content"><h2>{ready ? 'Your adventure is ready.' : 'Your disc. Your adventure.'}</h2><p>{ready ? 'Your imported game is stored in this browser. Pick up where you left off.' : 'Drop your Shrek 2.iso here, or choose it from your computer.'}</p>
          {status ? <div className="import-progress" aria-live="polite"><div><span>{status.phase}</span><span>{status.percent}%</span></div><progress value={status.percent} max="100" /><small>{status.detail ?? 'Everything stays on this device.'}</small></div> : <div className="card-actions">{ready ? <a className="primary-button" href="?game=shrek2">Play Shrek 2 <span>↗</span></a> : <button className="primary-button" disabled={!supported || checking} onClick={() => input.current?.click()}>{checking ? 'Checking your browser…' : 'Choose ISO file'} <span>＋</span></button>}{ready && <button className="text-button" onClick={() => input.current?.click()} disabled={!supported}>Replace ISO</button>}</div>}
          </div>
        </div>
        <input ref={input} type="file" accept=".iso" aria-label="Choose Shrek 2 ISO" className="visually-hidden" onChange={event => { void importFile(event.target.files?.[0]); event.target.value = ''; }} />
        {error && <div className="notice" role="alert">{error}</div>}
        <div className="format-note"><span>SUPPORTED DISC</span><p>Shrek 2 · English · Windows PC · 2004 CD-ROM · about 423 MB. <a href="https://archive.org/details/shrek-2_20210622" target="_blank" rel="noopener noreferrer">Example disc listing ↗</a><small>The listing is a format reference, not a statement of download rights. Use your own legitimately obtained copy.</small></p></div>
      </section>
      <section className="details-grid"><article><span>02 / ON THIS DEVICE</span><h3>Your ISO stays yours.</h3><p>Extraction and gameplay happen in your browser. The site never uploads your ISO, game files, or saves.</p></article><article><span>03 / READY TO ROAM</span><h3>Keyboard. Mouse. Ogre.</h3><p>Use the game’s original controls. Click the game to capture the mouse; press Esc to release it. F11 opens fullscreen.</p></article><article><span>04 / KEEP YOUR PLACE</span><h3>A little room for saves.</h3><p>Allow about 650 MB of local storage. Saves stay in this browser; clearing site data removes them. Keep a backup through the player’s storage menu.</p></article></section>
      <aside className="compatibility-note"><strong>Compatibility preview</strong><p>Local disc import, menus, opening cutscenes, and movement in the swamp level have been tested. Some rendering artifacts remain; a full playthrough has not been verified. This is an independent fan project built on BottleShip.</p>{ready && <button className="text-button" onClick={() => void removeGame()}>Remove imported game files</button>}</aside>
    </main>
    <footer><span>Built on <a href="https://github.com/jenissimo/bottleship" target="_blank" rel="noopener noreferrer">BottleShip</a> · <a href="licenses/THIRD-PARTY-NOTICES.md">Open-source licenses</a></span><p>Not affiliated with Activision or DreamWorks. No commercial game code or assets are distributed with this site.</p></footer>
  </div>;
}
