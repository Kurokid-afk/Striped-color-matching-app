import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);
const [sourceHtml] = process.argv.slice(2);
if (!sourceHtml) throw new Error("Expected source HTML path");

const html = await fs.readFile(sourceHtml, "utf8");
const testHtmlPath = new URL("./apple_motion_test.html", import.meta.url);

const injection = `
window.addEventListener('load', async () => {
  const runtimeErrors=[];
  window.addEventListener('error',event=>runtimeErrors.push(String(event.error||event.message)));
  window.addEventListener('unhandledrejection',event=>runtimeErrors.push(String(event.reason)));
  const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));

  try {
    state.stripes=[
      {lanes:8,role:'A'},
      {lanes:4,role:'B'}
    ];
    state.roles={
      A:{color:'#17191C',locked:false,name:'深色'},
      B:{color:'#E8EBED',locked:false,name:'浅色'}
    };
    state.palette=['#17191C','#E8EBED'];
    state.schemes=[];
    state.favorites=[];
    schemePreviewMapping=null;
    schemePreviewFavoriteEntry=null;
    ensureStripeSortIds();
    renderAll();
    await wait(520);

    const button=$('#addStripeBtn');
    button.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,pointerId:1}));
    await wait(24);
    const pressFrames=button.getAnimations().flatMap(animation=>animation.effect?.getKeyframes?.()||[]);
    button.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,pointerId:1}));
    await wait(24);
    const releaseFrames=button.getAnimations().flatMap(animation=>animation.effect?.getKeyframes?.()||[]);

    const oldRect=$('#patternSvg rect[data-role="A"]');
    const oldFill=oldRect?.getAttribute('fill');
    state.roles.A.color='#8296A1';
    renderSvg();
    await wait(34);
    const newRect=$('#patternSvg rect[data-role="A"]');
    const patternFrames=(newRect?.getAnimations()||[])
      .flatMap(animation=>animation.effect?.getKeyframes?.()||[]);
    const canvasFrames=($('#patternSvg')?.getAnimations()||[])
      .flatMap(animation=>animation.effect?.getKeyframes?.()||[]);

    captureAppleLayout();
    state.stripes.unshift({lanes:2,role:'B',_sortId:'apple-test-new'});
    renderStripes();
    playAppleLayout();
    await wait(45);
    const newStripe=findSortElement('.stripe-item','apple-test-new');
    const newStripeFrames=(newStripe?.getAnimations()||[])
      .flatMap(animation=>animation.effect?.getKeyframes?.()||[]);

    const allFrames=[
      ...pressFrames,
      ...releaseFrames,
      ...patternFrames,
      ...canvasFrames,
      ...newStripeFrames
    ];
    const hasOvershoot=allFrames.some(frame=>{
      const values=[...String(frame.transform||'').matchAll(/scale(?:X|Y)?\\(([-0-9.]+)/g)];
      return values.some(match=>Number(match[1])>1.0001);
    });

    const randomStyle=getComputedStyle($('#randomStripeBtn'));
    const pageStyle=getComputedStyle(document.body);

    const result={
      appleMotionInstalled:document.body.dataset.appleMotionInstalled,
      pressFrames:pressFrames.length,
      releaseFrames:releaseFrames.length,
      pressHasScale:pressFrames.some(frame=>String(frame.transform||'').includes('scale(')),
      releaseHasScale:releaseFrames.some(frame=>String(frame.transform||'').includes('scale(')),
      oldFill,
      nextFill:newRect?.getAttribute('fill')||null,
      patternFrames:patternFrames.length,
      patternHasFillMorph:patternFrames.some(frame=>String(frame.fill||'').length>0),
      canvasFrames:canvasFrames.length,
      newStripeFrames:newStripeFrames.length,
      newStripeMoves:newStripeFrames.some(frame=>String(frame.transform||'').includes('translate3d')),
      newStripeExists:!!newStripe,
      newStripeKey:newStripe?.dataset.sortKey||null,
      newStripeWasCaptured:appleLayoutBefore?.has('sort:apple-test-new')||false,
      layoutMotionCount:Number(document.body.dataset.appleLayoutMotions)||0,
      hasOvershoot,
      randomColor:randomStyle.color,
      randomBackground:randomStyle.backgroundImage,
      pageBackground:pageStyle.backgroundColor,
      selectedPulseCycles:updateStripeSelectionMarkers.toString().includes('cycles:2'),
      runtimeErrors
    };

    document.body.textContent='__CODEX_APPLE_MOTION_RESULT__'+JSON.stringify(result);
  } catch (error) {
    document.body.textContent='__CODEX_APPLE_MOTION_RESULT__'+JSON.stringify({
      error:error && error.stack ? error.stack : String(error),
      runtimeErrors
    });
  }
});
`;

const closurePattern = /\n\}\)\(\);\s*\n\s*<\/script>\s*\n<\/body>/i;
if (!closurePattern.test(html)) throw new Error("Could not locate app closure");

await fs.writeFile(
  testHtmlPath,
  html.replace(
    closurePattern,
    `${injection}\n})();\n\n</script>\n</body>`,
  ),
  "utf8",
);

const electron = path.resolve("node_modules/electron/dist/electron.exe");
const electronRunner = path.resolve("work/electron_dump_dom.cjs");
const { stdout, stderr } = await execFileAsync(electron, [
  electronRunner,
  fileURLToPath(testHtmlPath),
  "__CODEX_APPLE_MOTION_RESULT__",
  "20000",
], { maxBuffer: 24 * 1024 * 1024, windowsHide: true });

const marker = "__CODEX_APPLE_MOTION_RESULT__";
const start = stdout.lastIndexOf(marker);
if (start < 0) throw new Error(`Browser result missing. ${stderr.slice(0,1000)}`);
const tail = stdout.slice(start + marker.length);
const end = tail.indexOf("</body>");
if (end < 0) throw new Error("Browser result terminator missing");

const result = JSON.parse(tail.slice(0,end).trim());
if (result.error) throw new Error(result.error);
console.log(JSON.stringify(result));

if (
  result.appleMotionInstalled !== "1" ||
  result.pressFrames < 2 ||
  result.releaseFrames < 2 ||
  !result.pressHasScale ||
  !result.releaseHasScale ||
  !result.oldFill ||
  result.oldFill === result.nextFill ||
  result.nextFill !== "#8296A1" ||
  result.patternFrames < 2 ||
  !result.patternHasFillMorph ||
  result.canvasFrames < 2 ||
  result.newStripeFrames < 2 ||
  !result.newStripeMoves ||
  result.hasOvershoot ||
  !result.randomBackground.includes("linear-gradient") ||
  result.pageBackground !== "rgb(238, 240, 242)" ||
  !result.selectedPulseCycles ||
  (result.runtimeErrors||[]).length
) {
  throw new Error(`Unexpected result: ${JSON.stringify(result)}`);
}
