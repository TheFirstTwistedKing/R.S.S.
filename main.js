'use strict';
const { app, BrowserWindow, ipcMain, dialog, Menu, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const dgram = require('dgram');
const os = require('os');

const VAULT_NAME = 'rss-vault.json';

/* ── 메신저: 같은 네트워크(같은 공유기 · 와이파이)의 R.S.S. 끼리 UDP 방송으로 주고받음. 서버 없음.
   내용은 렌더러에서 채널 코드로 암호화한 뒤 넘어오므로 여기서는 글자를 볼 수 없음 ── */
const MSG_PORT = 47811;
let msgSock = null;
function broadcastTargets() {
  const out = new Set(['255.255.255.255']);
  for (const list of Object.values(os.networkInterfaces())) {
    for (const a of list || []) {
      if (a.family !== 'IPv4' && a.family !== 4) continue;
      if (a.internal) { out.add('127.255.255.255'); continue; }
      const ip = a.address.split('.').map(Number), mask = a.netmask.split('.').map(Number);
      out.add(ip.map((b, i) => (b & mask[i]) | (~mask[i] & 255)).join('.'));
    }
  }
  return [...out];
}
ipcMain.handle('net:start', () => new Promise((resolve, reject) => {
  if (msgSock) return resolve(true);
  const s = dgram.createSocket({ type: 'udp4', reuseAddr: true });
  s.on('message', (buf, rinfo) => {
    if (buf.length > 64000) return;
    if (win && !win.isDestroyed()) win.webContents.send('net:packet', buf.toString('utf8'), rinfo.address);
  });
  s.once('error', (e) => { try { s.close(); } catch (_) {} msgSock = null; reject(e); });
  s.bind(MSG_PORT, () => { s.setBroadcast(true); msgSock = s; resolve(true); });
}));
ipcMain.handle('net:send', (_e, text) => {
  if (!msgSock || typeof text !== 'string' || text.length > 60000) return false;
  const buf = Buffer.from(text, 'utf8');
  for (const t of broadcastTargets()) msgSock.send(buf, MSG_PORT, t, () => {});
  return true;
});
ipcMain.handle('net:stop', () => { if (msgSock) { try { msgSock.close(); } catch (_) {} msgSock = null; } return true; });
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
    backgroundColor: '#050607',
    show: false,
    title: 'R.S.S.',
    icon: path.join(__dirname, 'src', 'icon.png'),
    titleBarStyle: 'hidden',
    titleBarOverlay: { color: '#050607', symbolColor: '#A69B84', height: 32 },
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

  // F11: 작업 표시줄까지 가리는 완전 전체화면 (다시 누르면 원래대로)
  win.webContents.on('before-input-event', (e, input) => {
    if (input.type === 'keyDown' && input.key === 'F11' && !input.isAutoRepeat) {
      e.preventDefault();
      win.setFullScreen(!win.isFullScreen());
    }
  });
  const fsNotify = () => { if (!win.isDestroyed()) win.webContents.send('win:fullscreen', win.isFullScreen()); };
  win.on('enter-full-screen', fsNotify);
  win.on('leave-full-screen', fsNotify);

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
      { name: 'R.S.S. 백업 · 학습 파일', extensions: ['rssvault', 'rssbrain', 'json'] },
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
      { name: 'R.S.S. 백업 · 학습 파일', extensions: ['rssvault', 'rssbrain', 'json'] },
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
