'use strict';
const { app, BrowserWindow, ipcMain, dialog, Menu, shell } = require('electron');
const path = require('path');
const fs = require('fs');

const VAULT_NAME = 'rss-vault.json';
const vaultPath = () => path.join(app.getPath('userData'), VAULT_NAME);

let win = null;

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (win) { if (win.isMinimized()) win.restore(); win.focus(); }
  });
}

function writeAtomic(file, text) {
  const tmp = file + '.tmp';
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(tmp, text, 'utf8');
  if (fs.existsSync(file)) {
    try { fs.copyFileSync(file, file + '.bak'); } catch (_) { /* 이전본 백업 실패는 저장을 막지 않음 */ }
  }
  fs.renameSync(tmp, file);
}

function createWindow() {
  win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 360,
    minHeight: 600,
    backgroundColor: '#0A0B0C',
    show: false,
    title: 'R.S.S.',
    icon: path.join(__dirname, 'src', 'icon.png'),
    titleBarStyle: 'hidden',
    titleBarOverlay: { color: '#0A0B0C', symbolColor: '#E8E2D4', height: 32 },
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false
    }
  });
  Menu.setApplicationMenu(null);
  win.loadFile(path.join(__dirname, 'src', 'index.html'));
  win.once('ready-to-show', () => win.show());

  // 외부 링크는 앱 안에서 열지 않음
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//.test(url)) shell.openExternal(url);
    return { action: 'deny' };
  });
  win.webContents.on('will-navigate', (e) => e.preventDefault());

  // 닫기 전에 렌더러가 저장 대기 중인 기록을 디스크에 쓰도록 기다림 (최대 3초)
  let closing = false;
  win.on('close', (e) => {
    if (closing) return;
    e.preventDefault();
    closing = true;
    const done = () => { if (win && !win.isDestroyed()) win.destroy(); };
    const t = setTimeout(done, 3000);
    ipcMain.once('app:flushed', () => { clearTimeout(t); done(); });
    win.webContents.send('app:flush');
  });
}

ipcMain.handle('vault:read', () => {
  try { return fs.readFileSync(vaultPath(), 'utf8'); } catch (_) { return null; }
});

ipcMain.handle('vault:write', (_e, text) => {
  if (typeof text !== 'string' || text.length > 200 * 1024 * 1024) throw new Error('invalid');
  writeAtomic(vaultPath(), text);
  return true;
});

ipcMain.handle('vault:wipe', () => {
  for (const f of [vaultPath(), vaultPath() + '.bak']) { try { fs.unlinkSync(f); } catch (_) {} }
  return true;
});

ipcMain.handle('backup:save', async (_e, defaultName, text) => {
  const r = await dialog.showSaveDialog(win, {
    title: '백업 내보내기',
    defaultPath: path.join(app.getPath('documents'), defaultName),
    filters: [
      { name: 'R.S.S. 백업', extensions: ['rssvault', 'json'] },
      { name: '모든 파일', extensions: ['*'] }
    ]
  });
  if (r.canceled || !r.filePath) return false;
  fs.writeFileSync(r.filePath, text, 'utf8');
  return r.filePath;
});

ipcMain.handle('backup:open', async () => {
  const r = await dialog.showOpenDialog(win, {
    title: '백업 가져오기',
    properties: ['openFile'],
    filters: [
      { name: 'R.S.S. 백업', extensions: ['rssvault', 'json'] },
      { name: '모든 파일', extensions: ['*'] }
    ]
  });
  if (r.canceled || !r.filePaths[0]) return null;
  const stat = fs.statSync(r.filePaths[0]);
  if (stat.size > 200 * 1024 * 1024) throw new Error('too large');
  return fs.readFileSync(r.filePaths[0], 'utf8');
});

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
