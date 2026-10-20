import React from 'react';
import { createRoot } from 'react-dom/client';
import Launcher from './Launcher';
import App from '../app/App';
import '../styles/tokens.css';

const query = new URLSearchParams(location.search);
let play = query.get('game') === 'shrek2';
if (play) {
  try {
    const root = await navigator.storage.getDirectory();
    const dir = await (await root.getDirectoryHandle('bottleship')).getDirectoryHandle('wgb-cache');
    const file = await (await dir.getFileHandle('shrek2-pc-en-v1.wgb')).getFile();
    if (file.size < 1024 ** 2) throw new Error('Import required');
  } catch { location.replace(import.meta.env.BASE_URL); play = false; }
}
const root = document.getElementById('root');
if (!root) throw new Error('Missing application container');
createRoot(root).render(<React.StrictMode>{play || (import.meta.env.DEV && query.get('game') === 'dev') ? <App /> : <Launcher />}</React.StrictMode>);
