const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { app, BrowserWindow, shell } = require('electron');

const APP_ID = 'com.kurokid.stripestudio';
const APP_NAME = '条纹纺织调色';
const DATA_DIRECTORY_NAME = 'StripeStudio';
const SELF_TEST = process.argv.includes('--self-test');
const UPDATE_SHUTDOWN = process.argv.includes('--shutdown-for-update');

app.setName(APP_NAME);
app.setAppUserModelId(APP_ID);

// Keep user-created colors, palettes, favorites and durable browser storage in
// one version-independent location. Replacing or moving the portable EXE does
// not change this path.
const stableUserData = SELF_TEST
  ? path.join(app.getPath('temp'), 'StripeStudioSelfTest')
  : path.join(app.getPath('appData'), DATA_DIRECTORY_NAME);
fs.mkdirSync(stableUserData, { recursive: true });
app.setPath('userData', stableUserData);
app.setPath('sessionData', stableUserData);

const runtimeInfoPath = path.join(stableUserData, 'desktop-runtime.json');
const WINDOWS_REGISTRY_KEY = 'HKCU\\Software\\Kurokid\\StripeStudio';

function registerWindowsLocation(runtimeInfo) {
  if (process.platform !== 'win32' || !app.isPackaged || SELF_TEST) return;
  const values = {
    AppId: APP_ID,
    ProductName: APP_NAME,
    Version: app.getVersion(),
    LauncherPath: runtimeInfo.launcherPath,
    DataDirectory: stableUserData,
    RuntimeInfoPath: runtimeInfoPath,
    UpdatedAt: runtimeInfo.updatedAt
  };
  for (const [name, value] of Object.entries(values)) {
    const result = spawnSync('reg.exe', [
      'ADD', WINDOWS_REGISTRY_KEY,
      '/v', name,
      '/t', 'REG_SZ',
      '/d', String(value),
      '/f'
    ], { windowsHide: true, encoding: 'utf8' });
    if (result.status !== 0) {
      console.warn(`Could not register ${name}: ${result.stderr || result.error || result.status}`);
    }
  }
}

function writeRuntimeInfo(state) {
  const launcherPath = process.env.PORTABLE_EXECUTABLE_FILE || process.execPath;
  const runtimeInfo = {
    contractVersion: 1,
    appId: APP_ID,
    productName: APP_NAME,
    appVersion: app.getVersion(),
    state,
    updatedAt: new Date().toISOString(),
    launcherPath: path.resolve(launcherPath),
    executablePath: path.resolve(process.execPath),
    dataDirectory: stableUserData,
    packaged: app.isPackaged,
    update: {
      strategy: 'external-replace-portable-executable',
      channel: 'stable',
      gracefulShutdownArgument: '--shutdown-for-update',
      preservesDataDirectory: true,
      discovery: {
        registryKey: WINDOWS_REGISTRY_KEY,
        registryValue: 'LauncherPath',
        pointerFile: runtimeInfoPath
      }
    },
    dataCompatibility: {
      projectFormat: 4,
      fixedAssetFormat: 2,
      durableVault: 1
    }
  };
  fs.writeFileSync(runtimeInfoPath, `${JSON.stringify(runtimeInfo, null, 2)}\n`, 'utf8');
  registerWindowsLocation(runtimeInfo);
}

const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
}

let mainWindow = null;
let quitState = UPDATE_SHUTDOWN ? 'stopped-for-update' : 'stopped';

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1600,
    height: 1000,
    minWidth: 1180,
    minHeight: 720,
    show: false,
    backgroundColor: '#eef0f2',
    autoHideMenuBar: true,
    title: APP_NAME,
    icon: path.join(__dirname, 'build', 'icon.ico'),
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
      devTools: false
    }
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) {
      void shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  mainWindow.webContents.on('will-navigate', (event, url) => {
    const current = mainWindow.webContents.getURL();
    if (current && url !== current) {
      event.preventDefault();
      if (/^https?:\/\//i.test(url)) {
        void shell.openExternal(url);
      }
    }
  });

  mainWindow.once('ready-to-show', () => {
    if (!SELF_TEST) {
      mainWindow.show();
    }
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  mainWindow.webContents.on('did-fail-load', (_event, code, description) => {
    console.error(`STRIPE_STUDIO_LOAD_ERROR:${code}:${description}`);
    if (SELF_TEST) app.exit(1);
  });

  mainWindow.webContents.once('did-finish-load', async () => {
    if (!SELF_TEST) return;
    try {
      const result = await mainWindow.webContents.executeJavaScript(`(() => {
        const requiredIds = [
          'patternSvg',
          'importJsonBtn',
          'exportJsonBtn',
          'exportCurrentExcelBtn',
          'exportFavoritesExcelBtn',
          'importLibraryBtn',
          'exportLibraryBtn',
          'libraryFileInput',
          'addTextureBtn',
          'textureFileInput',
          'textureNameDialogBackdrop'
        ];
        const missingIds = requiredIds.filter((id) => !document.getElementById(id));
        return {
          readyState: document.readyState,
          title: document.title,
          hasJsZip: typeof JSZip !== 'undefined',
          hasExcelCounter: typeof document.getElementById('excelCounterInput')?.onchange === 'function'
            && typeof document.getElementById('excelCounterExportBtn')?.onclick === 'function',
          hasFixedAssetImport: typeof document.getElementById('importLibraryBtn')?.onclick === 'function'
            && typeof document.getElementById('libraryFileInput')?.onchange === 'function',
          hasTextureUpload: typeof document.getElementById('addTextureBtn')?.onclick === 'function'
            && typeof document.getElementById('textureFileInput')?.onchange === 'function'
            && !!document.getElementById('textureNameDialogBackdrop'),
          missingIds,
          bodyVisible: getComputedStyle(document.body).display !== 'none'
        };
      })()`);
      const passed = result.readyState === 'complete'
        && result.hasJsZip
        && result.hasExcelCounter
        && result.hasFixedAssetImport
        && result.hasTextureUpload
        && result.missingIds.length === 0
        && result.bodyVisible;
      console.log(`STRIPE_STUDIO_SELF_TEST:${JSON.stringify({ passed, ...result })}`);
      app.exit(passed ? 0 : 1);
    } catch (error) {
      console.error(`STRIPE_STUDIO_SELF_TEST_ERROR:${error.stack || error.message}`);
      app.exit(1);
    }
  });

  void mainWindow.loadFile(path.join(__dirname, 'app', 'index.html'));
}

app.on('second-instance', (_event, commandLine) => {
  if (commandLine.includes('--shutdown-for-update')) {
    quitState = 'stopped-for-update';
    writeRuntimeInfo('stopping-for-update');
    app.quit();
    return;
  }
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
});

app.whenReady().then(() => {
  if (UPDATE_SHUTDOWN) {
    writeRuntimeInfo('stopped-for-update');
    app.quit();
    return;
  }
  writeRuntimeInfo(SELF_TEST ? 'self-test' : 'running');
  createMainWindow();
});

app.on('will-quit', () => {
  if (!SELF_TEST) {
    writeRuntimeInfo(quitState);
  }
});

app.on('window-all-closed', () => {
  app.quit();
});
