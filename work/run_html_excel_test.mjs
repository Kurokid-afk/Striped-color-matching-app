import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const [sourceHtml, inputXlsx, outputXlsx, summaryJson] = process.argv.slice(2);

if (!sourceHtml || !inputXlsx || !outputXlsx || !summaryJson) {
  throw new Error("Expected: source.html input.xlsx output.xlsx summary.json");
}

const html = await fs.readFile(sourceHtml, "utf8");
const inputBase64 = (await fs.readFile(inputXlsx)).toString("base64");
const testHtmlPath = new URL("./browser_excel_test.html", import.meta.url);

const injection = `
window.addEventListener('load', async () => {
  const settle = () => new Promise(resolve => setTimeout(resolve, 250));
  try {
    const raw = atob(${JSON.stringify(inputBase64)});
    const bytes = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
    const file = new File([bytes], '工作簿2.xlsx', {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });
    await excelCounterAnalyze(file);
    await settle();
    const productionBlocks = excelCounterState.blocks;
    const outputBase64 = productionBlocks.length
      ? await xlsxBuildBWCountOutput(productionBlocks).generateAsync({
          type: 'base64',
          compression: 'DEFLATE',
          compressionOptions: { level: 6 }
        })
      : '';
    const blocks = productionBlocks.map(block => ({
      blockNumber: block.blockNumber,
      start: block.start,
      end: block.end,
      totalRow: block.totalRow,
      schemes: (block.schemes || []).map(scheme => ({
        position: scheme.position,
        text: scheme.countText,
        total: scheme.totalL
      }))
    }));
    document.body.textContent = '__CODEX_EXCEL_RESULT__' + JSON.stringify({
      ok: true,
      debug: {
        fileMeta: document.querySelector('#excelCounterFileMeta')?.textContent || '',
        activeBlockIndex: excelCounterState.activeBlockIndex,
        productionBlockCount: productionBlocks.length,
      },
      blocks,
      outputBase64
    });
  } catch (error) {
    document.body.textContent = '__CODEX_EXCEL_RESULT__' + JSON.stringify({
      ok: false,
      message: error && error.stack ? error.stack : String(error)
    });
  }
});
`;

const closurePattern = /\n\}\)\(\);\s*\n\s*<\/script>\s*\n<\/body>/i;
if (!closurePattern.test(html)) {
  throw new Error("Could not locate the app IIFE closure");
}
const testHtml = html.replace(
  closurePattern,
  `${injection}\n})();\n\n</script>\n</body>`,
);
await fs.writeFile(testHtmlPath, testHtml, "utf8");

const edge = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const { stdout, stderr } = await execFileAsync(edge, [
  "--headless=new",
  "--disable-gpu",
  "--disable-extensions",
  "--allow-file-access-from-files",
  "--virtual-time-budget=20000",
  "--dump-dom",
  testHtmlPath.pathname.slice(1),
], { maxBuffer: 20 * 1024 * 1024, windowsHide: true });

const marker = "__CODEX_EXCEL_RESULT__";
const start = stdout.lastIndexOf(marker);
if (start < 0) {
  throw new Error(`Browser result marker missing. stderr: ${stderr.slice(0, 1000)}`);
}

const tail = stdout.slice(start + marker.length);
const end = tail.indexOf("</body>");
if (end < 0) throw new Error("Browser result terminator missing");

const result = JSON.parse(tail.slice(0, end).trim());
if (!result.ok) throw new Error(result.message || "Browser test failed");

await fs.writeFile(outputXlsx, Buffer.from(result.outputBase64, "base64"));
delete result.outputBase64;
await fs.writeFile(summaryJson, JSON.stringify(result, null, 2), "utf8");
console.log(JSON.stringify(result));
