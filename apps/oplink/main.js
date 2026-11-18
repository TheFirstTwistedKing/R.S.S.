/* 데스크톱 창: web/index.html 을 띄움 (Node 기능 없음, 바깥 링크는 기본 브라우저로) */
const { app, BrowserWindow, Menu, shell } = require('electron');
const path = require('path');
let win = null;
if (!app.requestSingleInstanceLock()) app.quit();
app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
function create() {
  win = new BrowserWindow({
    width: 1180, height: 860, minWidth: 380, minHeight: 600, backgroundColor: '#0A0907', show: false,
    icon: path.join(__dirname, 'web', 'icon.png'),
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true, spellcheck: false }
  });
  Menu.setApplicationMenu(null);
  win.loadFile(path.join(__dirname, 'web', 'index.html'));
  win.once('ready-to-show', () => win.show());
  win.webContents.setWindowOpenHandler(({ url }) => { if (/^https:\/\//.test(url)) shell.openExternal(url); return { action: 'deny' }; });
  win.webContents.on('will-navigate', (e, url) => { if (!url.startsWith('file://')) e.preventDefault(); });
  win.webContents.on('before-input-event', (e, input) => { if (input.type === 'keyDown' && input.key === 'F11') { win.setFullScreen(!win.isFullScreen()); e.preventDefault(); } });
}
app.whenReady().then(create);
app.on('window-all-closed', () => app.quit());
