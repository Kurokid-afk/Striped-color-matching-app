const fs = require('node:fs');
const path = require('node:path');
const { app, BrowserWindow } = require('electron');

const [testPath, marker, profilePath, timeoutText] = process.argv.slice(2);
const timeoutMs = Math.max(1000, Number(timeoutText) || 20000);

if (!testPath || !marker || !profilePath) {
  console.error('Expected test HTML path, marker and profile path');
  process.exit(2);
}

fs.mkdirSync(path.resolve(profilePath), { recursive: true });
app.setPath('userData', path.resolve(profilePath));
app.setPath('sessionData', path.resolve(profilePath));
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
        await window.webContents.session.flushStorageData();
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
