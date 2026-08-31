const fs = require('node:fs');
const path = require('node:path');
const { app, BrowserWindow } = require('electron');

const [testPath, marker, timeoutText, widthText, heightText] = process.argv.slice(2);
const timeoutMs = Math.max(1000, Number(timeoutText) || 20000);
const requestedWidth = Math.max(0, Number(widthText) || 0);
const requestedHeight = Math.max(0, Number(heightText) || 0);

if (!testPath || !marker) {
  console.error('Expected test HTML path and result marker');
  process.exit(2);
}

const profilePath = path.join(path.dirname(testPath), 'electron-profile');
fs.mkdirSync(profilePath, { recursive: true });
app.setPath('userData', profilePath);
app.setPath('sessionData', profilePath);
app.commandLine.appendSwitch('disable-gpu');

let finished = false;

function finish(code, output = '') {
  if (finished) return;
  finished = true;
  if (output) process.stdout.write(`${output}</body>`);
  app.exit(code);
}

app.whenReady().then(async () => {
  const window = new BrowserWindow({
    show: false,
    ...(requestedWidth && requestedHeight ? {
      width: requestedWidth,
      height: requestedHeight,
      useContentSize: true
    } : {}),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  window.webContents.on('did-fail-load', (_event, code, description) => {
    console.error(`Load failed: ${code} ${description}`);
    finish(1);
  });

  await window.loadFile(path.resolve(testPath));

  const startedAt = Date.now();
  const poll = async () => {
    try {
      const text = await window.webContents.executeJavaScript('document.body.textContent || ""');
      if (text.startsWith(marker)) {
        finish(0, text);
        return;
      }
      if (Date.now() - startedAt >= timeoutMs) {
        console.error(`Timed out waiting for ${marker}`);
        finish(1);
        return;
      }
      setTimeout(poll, 50);
    } catch (error) {
      console.error(error.stack || error.message);
      finish(1);
    }
  };

  poll();
});
