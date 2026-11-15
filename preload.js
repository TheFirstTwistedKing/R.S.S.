'use strict';
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('rss', {
  platform: process.platform,
  readVault: () => ipcRenderer.invoke('vault:read'),
  writeVault: (text) => ipcRenderer.invoke('vault:write', text),
  wipeVault: () => ipcRenderer.invoke('vault:wipe'),
  saveBackup: (name, text) => ipcRenderer.invoke('backup:save', name, text),
  openBackup: () => ipcRenderer.invoke('backup:open'),
  onFlush: (fn) => ipcRenderer.on('app:flush', () => {
    Promise.resolve().then(fn).catch(() => {}).then(() => ipcRenderer.send('app:flushed'));
  })
});
