'use strict';
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('rss', {
  platform: process.platform,
  version: ipcRenderer.sendSync('app:version'),
  readVault: () => ipcRenderer.invoke('vault:read'),
  writeVault: (text) => ipcRenderer.invoke('vault:write', text),
  wipeVault: () => ipcRenderer.invoke('vault:wipe'),
  saveBackup: (name, text) => ipcRenderer.invoke('backup:save', name, text),
  openBackup: () => ipcRenderer.invoke('backup:open'),
  onFlush: (fn) => ipcRenderer.on('app:flush', () => {
    Promise.resolve().then(fn).catch(() => {}).then(() => ipcRenderer.send('app:flushed'));
  }),
  // 메신저 (같은 네트워크 UDP 방송)
  netStart: () => ipcRenderer.invoke('net:start'),
  netSend: (text) => ipcRenderer.invoke('net:send', text),
  netStop: () => ipcRenderer.invoke('net:stop'),
  onPacket: (fn) => {
    const h = (_e, text, from) => fn(text, from);
    ipcRenderer.on('net:packet', h);
    return () => ipcRenderer.removeListener('net:packet', h);
  },
  // F11 전체화면 상태 알림
  onFullscreen: (fn) => ipcRenderer.on('win:fullscreen', (_e, on) => fn(!!on))
});
