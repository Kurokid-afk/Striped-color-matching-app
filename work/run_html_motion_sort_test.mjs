import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);
const [sourceHtml] = process.argv.slice(2);
if (!sourceHtml) throw new Error("Expected source HTML path");

const html = await fs.readFile(sourceHtml, "utf8");
const testHtmlPath = new URL("./motion_sort_test.html", import.meta.url);

const injection = `
window.addEventListener('load', async () => {
  const runtimeErrors=[];
  window.addEventListener('error',event=>runtimeErrors.push(String(event.error||event.message)));
  window.addEventListener('unhandledrejection',event=>runtimeErrors.push(String(event.reason)));

  const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  const rect=(left,top,width=100,height=48)=>({
    left,top,width,height,right:left+width,bottom:top+height,
    x:left,y:top,toJSON(){return this}
  });
  const fake=(left,top)=>({getBoundingClientRect:()=>rect(left,top)});

  try {
    const fullGrid=[fake(0,0),fake(112,0),fake(0,60),fake(112,60)];
    const oddGrid=[fake(0,0),fake(112,0),fake(0,60)];

    const terminalOnLast=liveGridInsertAt(188,88,fullGrid);
    const terminalInEmptyCell=liveGridInsertAt(188,82,oddGrid);
    const normalFront=liveGridInsertAt(18,12,fullGrid);

    state.stripes=[
      {lanes:8,role:'A'},
      {lanes:5,role:'B'}
    ];
    state.roles={
      A:{color:'#111111',locked:false,name:'深色'},
      B:{color:'#EEEEEE',locked:false,name:'浅色'}
    };
    state.palette=['#111111','#EEEEEE','#C79A62','#B56F74'];
    state.schemes=[];
    state.favorites=[];
    ensureStripeSortIds();
    renderAll();
    await wait(120);
    lastInterfaceMotionState=captureInterfaceMotionState();
    const baselineRoles=deepClone(lastInterfaceMotionState.roles);
    const baselineSerial=Number(document.body.dataset.motionSerial||0);

    let motionEvent=null;
    document.body.addEventListener('stripe-studio-motion',event=>{
      motionEvent=event.detail;
    },{once:true});

    applyMapping({A:'#C79A62',B:'#B56F74'});
    const afterApplyStored=deepClone(lastInterfaceMotionState?.roles||{});
    const pendingAfterApply=pendingInterfaceMotionKind;
    await wait(130);

    const firstSerial=Number(document.body.dataset.motionSerial||0);
    const sidebarAnimations=$('.sidebar')?.getAnimations({subtree:true}).length||0;
    const rightAnimations=$('.rightbar')?.getAnimations({subtree:true}).length||0;
    const canvasAnimations=$('.canvas-card')?.getAnimations({subtree:true}).length||0;
    const hasWave=!!$('.interface-motion-wave');

    applyMapping({A:'#C79A62',B:'#B56F74'});
    await wait(100);
    const unchangedSerial=Number(document.body.dataset.motionSerial||0);

    const favoriteA=captureFavoriteEntry({A:'#C79A62',B:'#B56F74'},'test-a');
    const favoriteB=captureFavoriteEntry({A:'#B56F74',B:'#C79A62'},'test-b');
    const favoriteC=captureFavoriteEntry({A:'#111111',B:'#EEEEEE'},'test-c');
    const favoriteD=captureFavoriteEntry({A:'#EEEEEE',B:'#111111'},'test-d');
    state.favorites=[favoriteA,favoriteB,favoriteC,favoriteD];
    currentCanvasPage='favorites';
    const exportData=buildCurrentDisplayExportSvg();
    const cells=[...exportData.svg.matchAll(/<g[^>]*data-export-card="[0-9]+"[^>]*data-card-x="([0-9.]+)"[^>]*data-card-y="([0-9.]+)"[^>]*data-card-width="([0-9.]+)"[^>]*data-card-height="([0-9.]+)"[^>]*>/g)]
      .slice(0,4)
      .map(match=>({x:+match[1],y:+match[2],w:+match[3],h:+match[4]}));

    const horizontalGap=cells.length>=2
      ? Math.round((cells[1].x-(cells[0].x+cells[0].w))*100)/100
      : null;
    const verticalGap=cells.length>=3
      ? Math.round((cells[2].y-(cells[0].y+cells[0].h))*100)/100
      : null;

    const result={
      terminalOnLast,
      terminalInEmptyCell,
      normalFront,
      motionKind:motionEvent?.kind||null,
      changedRoles:motionEvent?.changedRoles||[],
      baselineRoles,
      appliedRoles:captureInterfaceMotionState().roles,
      afterApplyStored,
      pendingAfterApply,
      baselineSerial,
      firstSerial,
      unchangedSerial,
      sidebarAnimations,
      rightAnimations,
      canvasAnimations,
      hasWave,
      horizontalGap,
      verticalGap,
      exportCells:cells.length,
      hasCardBorder:exportData.svg.includes('stroke="#C7CDD0"'),
      hasCardShadow:exportData.svg.includes('filter="url(#copyDisplayCardShadow)"'),
      runtimeErrors
    };

    document.body.textContent='__CODEX_MOTION_SORT_RESULT__'+JSON.stringify(result);
  } catch (error) {
    document.body.textContent='__CODEX_MOTION_SORT_RESULT__'+JSON.stringify({
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

const edge = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const { stdout, stderr } = await execFileAsync(edge, [
  "--headless=new",
  "--disable-gpu",
  "--disable-extensions",
  "--allow-file-access-from-files",
  "--virtual-time-budget=12000",
  "--dump-dom",
  testHtmlPath.pathname.slice(1),
], { maxBuffer: 24 * 1024 * 1024, windowsHide: true });

const marker = "__CODEX_MOTION_SORT_RESULT__";
const start = stdout.lastIndexOf(marker);
if (start < 0) throw new Error(`Browser result missing. ${stderr.slice(0,1000)}`);
const tail = stdout.slice(start + marker.length);
const end = tail.indexOf("</body>");
if (end < 0) throw new Error("Browser result terminator missing");

const result = JSON.parse(tail.slice(0,end).trim());
if (result.error) throw new Error(result.error);
console.log(JSON.stringify(result));

const changedRoles = new Set(result.changedRoles||[]);
if (
  result.terminalOnLast !== 4 ||
  result.terminalInEmptyCell !== 3 ||
  result.normalFront !== 0 ||
  result.motionKind !== "scheme" ||
  !changedRoles.has("A") ||
  !changedRoles.has("B") ||
  result.firstSerial <= result.baselineSerial ||
  result.unchangedSerial !== result.firstSerial ||
  result.sidebarAnimations < 1 ||
  result.rightAnimations < 1 ||
  result.canvasAnimations < 1 ||
  result.hasWave ||
  result.horizontalGap !== 12 ||
  result.verticalGap !== 28 ||
  result.exportCells !== 4 ||
  !result.hasCardBorder ||
  !result.hasCardShadow ||
  (result.runtimeErrors||[]).length
) {
  throw new Error(`Unexpected result: ${JSON.stringify(result)}`);
}
