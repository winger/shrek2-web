async function boot() {
  if (!crossOriginIsolated) {
    try {
      if (!('serviceWorker' in navigator)) throw new Error('Service workers are unavailable.');
      const base = new URL(import.meta.env.BASE_URL, location.origin);
      await navigator.serviceWorker.register(new URL('isolation-sw.js', base), { scope: base.pathname, updateViaCache: 'none' });
      await navigator.serviceWorker.ready;
      if (!navigator.serviceWorker.controller) {
        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => reject(new Error('The browser could not activate isolation.')), 10000);
          navigator.serviceWorker.addEventListener('controllerchange', () => { clearTimeout(timeout); resolve(); }, { once: true });
        });
      }
      const key = 'shrek2.isolationReload';
      if (!sessionStorage.getItem(key)) { sessionStorage.setItem(key, '1'); location.reload(); return; }
      throw new Error('Cross-origin isolation is unavailable after activating the service worker.');
    } catch (error) {
      const root = document.getElementById('root')!;
      const heading = document.createElement('h1'); heading.textContent = 'This browser cannot start the player';
      const message = document.createElement('p'); message.textContent = `${error instanceof Error ? error.message : error} Use a current Chrome or Edge browser with service workers enabled, then reload.`;
      root.style.cssText = 'max-width:620px;margin:15vh auto;padding:28px;font:16px/1.7 system-ui;color:#edeae1';
      root.replaceChildren(heading, message); return;
    }
  }
  sessionStorage.removeItem('shrek2.isolationReload');
  await import('./entry');
}
void boot();
