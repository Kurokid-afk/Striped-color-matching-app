const fs = require('node:fs');
const path = require('node:path');
const { app, BrowserWindow } = require('electron');

const [htmlPath, outputPath, widthText, heightText] = process.argv.slice(2);
if (!htmlPath || !outputPath) {
  console.error('Expected HTML path and output PNG path');
  process.exit(2);
}

const width = Math.max(320, Number(widthText) || 1800);
const height = Math.max(240, Number(heightText) || 1445);
const profilePath = path.join(path.dirname(path.resolve(outputPath)), 'electron-screenshot-profile');
fs.mkdirSync(profilePath, { recursive: true });
app.setPath('userData', profilePath);
app.setPath('sessionData', profilePath);
app.commandLine.appendSwitch('disable-gpu');

app.whenReady().then(async () => {
  const window = new BrowserWindow({
    show: false,
    width,
    height,
    useContentSize: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });

  try {
    await window.loadFile(path.resolve(htmlPath));
    await new Promise(resolve => setTimeout(resolve, 900));
    const image = await window.webContents.capturePage();
    fs.writeFileSync(path.resolve(outputPath), image.toPNG());
    app.exit(0);
  } catch (error) {
    console.error(error.stack || error.message);
    app.exit(1);
  }
});
