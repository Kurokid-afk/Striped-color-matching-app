import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);
const [sourceHtml] = process.argv.slice(2);
if (!sourceHtml) throw new Error("Expected source HTML path");

const html = await fs.readFile(sourceHtml, "utf8");
const testHtmlPath = new URL("./favorite_name_test.html", import.meta.url);

const injection = `
window.addEventListener('load', async () => {
  try {
    const targetHex = '#2D2F3D';
    let resource = findLibraryColorByHex(targetHex);
    if (!resource) {
      resource = {
        id: nextResourceId('solid'),
        type: 'solid',
        name: '231深藏蓝',
        hex: targetHex
      };
      colorLibrary.push(resource);
    } else {
      resource.name = '231深藏蓝';
    }

    state.palette = [resource.id];
    state.roles = {
      B: { color: targetHex, name: targetHex, locked: false }
    };
    state.stripes = [{ lanes: 26, role: 'B' }];

    const mapping = {
      B: { color: targetHex, name: targetHex }
    };
    const fresh = captureFavoriteEntry(mapping, 'test');

    const legacy = {
      snapshotVersion: 3,
      immutable: true,
      mapping: deepClone(mapping),
      visual: currentFavoriteVisualSnapshot(),
      fills: {
        B: {
          type: 'solid',
          name: targetHex,
          hex: targetHex,
          image: null,
          brightness: null,
          scale: 100,
          id: null
        }
      },
      savedAt: Date.now(),
      source: 'legacy'
    };
    legacy.key = favoriteEntryKey(legacy);
    state.favorites = [legacy];
    refreshFavoriteIntegrity();

    const meaningful = {
      snapshotVersion: 3,
      immutable: true,
      mapping: deepClone(mapping),
      visual: currentFavoriteVisualSnapshot(),
      fills: {
        B: {
          type: 'solid',
          name: '专用深灰',
          hex: targetHex,
          image: null,
          brightness: null,
          scale: 100,
          id: null
        }
      },
      savedAt: Date.now(),
      source: 'legacy-custom'
    };
    meaningful.key = favoriteEntryKey(meaningful);
    state.favorites = [meaningful];
    refreshFavoriteIntegrity();

    document.body.textContent = '__CODEX_FAVORITE_NAME_RESULT__' + JSON.stringify({
      freshName: fresh.fills.B.name,
      freshId: fresh.fills.B.id,
      legacyName: legacy.fills.B.name,
      legacyVersion: legacy.snapshotVersion,
      meaningfulName: meaningful.fills.B.name,
      expectedId: resource.id
    });
  } catch (error) {
    document.body.textContent = '__CODEX_FAVORITE_NAME_RESULT__' + JSON.stringify({
      error: error && error.stack ? error.stack : String(error)
    });
  }
});
`;

const closurePattern = /\n\}\)\(\);\s*\n\s*<\/script>\s*\n<\/body>/i;
if (!closurePattern.test(html)) {
  throw new Error("Could not locate app closure");
}

await fs.writeFile(
  testHtmlPath,
  html.replace(
    closurePattern,
    `${injection}\n})();\n\n</script>\n</body>`,
  ),
  "utf8",
);

const electron = path.resolve("node_modules/electron/dist/electron.exe");
const runner = path.resolve("work/electron_dump_dom.cjs");
const { stdout, stderr } = await execFileAsync(electron, [
  runner,
  fileURLToPath(testHtmlPath),
  "__CODEX_FAVORITE_NAME_RESULT__",
  "20000",
], { maxBuffer: 20 * 1024 * 1024, windowsHide: true });

const marker = "__CODEX_FAVORITE_NAME_RESULT__";
const start = stdout.lastIndexOf(marker);
if (start < 0) {
  throw new Error(`Browser result missing. ${stderr.slice(0, 1000)}`);
}
const tail = stdout.slice(start + marker.length);
const end = tail.indexOf("</body>");
if (end < 0) throw new Error("Browser result terminator missing");

const result = JSON.parse(tail.slice(0, end).trim());
if (result.error) throw new Error(result.error);
console.log(JSON.stringify(result));

if (
  result.freshName !== "231深藏蓝" ||
  result.freshId !== result.expectedId ||
  result.legacyName !== "231深藏蓝" ||
  result.legacyVersion !== 4 ||
  result.meaningfulName !== "专用深灰"
) {
  throw new Error(`Unexpected result: ${JSON.stringify(result)}`);
}
