import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

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
    // 等正式启动流程（含本地持久化恢复）结束后再注入测试状态，
    // 避免异步恢复在测试中途把角色颜色覆盖回上一次运行。
    await wait(500);
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
    const activeMotionFrames=[
      ...($('.sidebar')?.getAnimations({subtree:true})||[]),
      ...($('.rightbar')?.getAnimations({subtree:true})||[]),
      ...($('.canvas-card')?.getAnimations({subtree:true})||[])
    ].flatMap(animation=>animation.effect?.getKeyframes?.()||[]);
    const hasScaleOvershoot=activeMotionFrames.some(frame=>{
      const matches=[...String(frame.transform||'').matchAll(/scale\(([-0-9.]+)\)/g)];
      return matches.some(match=>Number(match[1])>1.0001);
    });
    const surfaceSwapUsesCurtain=curtainSwap.toString().includes('createMotionCurtain');
    const surfaceSwapUsesOpacity=/opacity\s*:/.test(curtainSwap.toString());
    const hasWave=!!$('.interface-motion-wave');

    applyMapping({A:'#C79A62',B:'#B56F74'});
    await wait(100);
    const unchangedSerial=Number(document.body.dataset.motionSerial||0);

    colorLibrary=[
      {id:'C901',type:'solid',name:'旧金棕名',hex:'#C79A62'},
      {id:'C902',type:'solid',name:'旧赤棕名',hex:'#B56F74'},
      {id:'C903',type:'solid',name:'旧深色名',hex:'#111111'},
      {id:'C904',type:'solid',name:'旧浅色名',hex:'#EEEEEE'}
    ];
    const favoriteA=captureFavoriteEntry({A:'#C79A62',B:'#B56F74'},'test-a');
    const favoriteB=captureFavoriteEntry({A:'#B56F74',B:'#C79A62'},'test-b');
    const favoriteC=captureFavoriteEntry({A:'#111111',B:'#EEEEEE'},'test-c');
    const favoriteD=captureFavoriteEntry({A:'#EEEEEE',B:'#111111'},'test-d');
    state.favorites=[favoriteA,favoriteB,favoriteC,favoriteD];
    colorLibrary.find(item=>item.id==='C901').name='色库金棕新名';
    colorLibrary.find(item=>item.id==='C902').name='色库赤棕新名';
    state.name='导出标题测试项目';
    currentCanvasPage='favorites';
    const exportData=buildCurrentDisplayExportSvg();
    const cells=[...exportData.svg.matchAll(/<g[^>]*data-export-card="[0-9]+"[^>]*data-card-x="([0-9.]+)"[^>]*data-card-y="([0-9.]+)"[^>]*data-card-width="([0-9.]+)"[^>]*data-card-height="([0-9.]+)"[^>]*>/g)]
      .slice(0,4)
      .map(match=>({x:+match[1],y:+match[2],w:+match[3],h:+match[4]}));

    const horizontalGap=cells.length>=2
      ? Math.round((cells[1].x-(cells[0].x+cells[0].w))*100)/100
      : null;
    state.favorites=Array.from({length:14},(_,index)=>{
      const favorite=deepClone([favoriteA,favoriteB,favoriteC,favoriteD][index%4]);
      favorite.id='medium-layout-'+index;
      favorite.name='中量方案 '+(index+1);
      return favorite;
    });
    const mediumLayoutData=buildCurrentDisplayExportSvg();
    const mediumCells=[...mediumLayoutData.svg.matchAll(/<g[^>]*data-export-card="[0-9]+"[^>]*data-card-x="([0-9.]+)"[^>]*data-card-y="([0-9.]+)"[^>]*data-card-width="([0-9.]+)"[^>]*data-card-height="([0-9.]+)"[^>]*>/g)]
      .map(match=>({x:+match[1],y:+match[2],w:+match[3],h:+match[4]}));
    const mediumFirstRowCount=mediumCells.filter(cell=>cell.y===mediumCells[0]?.y).length;

    state.favorites=Array.from({length:17},(_,index)=>{
      const favorite=deepClone([favoriteA,favoriteB,favoriteC,favoriteD][index%4]);
      favorite.id='before-six-column-'+index;
      favorite.name='六列前方案 '+(index+1);
      return favorite;
    });
    const beforeSixData=buildCurrentDisplayExportSvg();
    const beforeSixCells=[...beforeSixData.svg.matchAll(/<g[^>]*data-export-card="[0-9]+"[^>]*data-card-x="([0-9.]+)"[^>]*data-card-y="([0-9.]+)"[^>]*data-card-width="([0-9.]+)"[^>]*data-card-height="([0-9.]+)"[^>]*>/g)]
      .map(match=>({x:+match[1],y:+match[2],w:+match[3],h:+match[4]}));
    const beforeSixFirstRowCount=beforeSixCells.filter(cell=>cell.y===beforeSixCells[0]?.y).length;

    state.favorites=Array.from({length:18},(_,index)=>{
      const favorite=deepClone([favoriteA,favoriteB,favoriteC,favoriteD][index%4]);
      favorite.id='six-column-threshold-'+index;
      favorite.name='六列临界方案 '+(index+1);
      return favorite;
    });
    const thresholdSixData=buildCurrentDisplayExportSvg();
    const thresholdSixCells=[...thresholdSixData.svg.matchAll(/<g[^>]*data-export-card="[0-9]+"[^>]*data-card-x="([0-9.]+)"[^>]*data-card-y="([0-9.]+)"[^>]*data-card-width="([0-9.]+)"[^>]*data-card-height="([0-9.]+)"[^>]*>/g)]
      .map(match=>({x:+match[1],y:+match[2],w:+match[3],h:+match[4]}));
    const thresholdSixFirstRowCount=thresholdSixCells.filter(cell=>cell.y===thresholdSixCells[0]?.y).length;

    state.favorites=Array.from({length:20},(_,index)=>{
      const favorite=deepClone([favoriteA,favoriteB,favoriteC,favoriteD][index%4]);
      favorite.id='six-column-'+index;
      favorite.name='六列方案 '+(index+1);
      return favorite;
    });
    const sixColumnData=buildCurrentDisplayExportSvg();
    const sixCells=[...sixColumnData.svg.matchAll(/<g[^>]*data-export-card="[0-9]+"[^>]*data-card-x="([0-9.]+)"[^>]*data-card-y="([0-9.]+)"[^>]*data-card-width="([0-9.]+)"[^>]*data-card-height="([0-9.]+)"[^>]*>/g)]
      .map(match=>({x:+match[1],y:+match[2],w:+match[3],h:+match[4]}));
    const firstRowCount=sixCells.filter(cell=>cell.y===sixCells[0]?.y).length;
    const lastRowCount=sixCells.filter(cell=>cell.y===sixCells[18]?.y).length;
    const verticalGap=sixCells.length>=7
      ? Math.round((sixCells[6].y-(sixCells[0].y+sixCells[0].h))*100)/100
      : null;
    const lastRowCentered=sixCells.length===20 && Math.abs(
      sixCells[18].x-
      (sixColumnData.width-(sixCells[19].x+sixCells[19].w))
    )<.02;
    const equalCardWidths=sixCells.every(cell=>Math.abs(cell.w-sixCells[0].w)<.01);

    state.schemes=Array.from({length:12},(_,index)=>({
      mapping:index%2
        ? {A:'#C79A62',B:'#B56F74'}
        : {A:'#111111',B:'#EEEEEE'}
    }));
    state.schemeFilter='all';
    renderSchemes();
    await wait(60);
    const compactCard=$('#schemes .scheme:not(.base-scheme)');
    const compactFooter=compactCard?.querySelector('.scheme-footer');
    const compactName=compactCard?.querySelector('.scheme-name-row');
    const compactActions=compactCard?.querySelector('.scheme-action-row');
    const compactCardHeight=compactCard?.getBoundingClientRect().height||0;
    const controlsSameLine=!!compactName && !!compactActions &&
      Math.abs(compactName.getBoundingClientRect().top-compactActions.getBoundingClientRect().top)<4;
    const panelToolbar=$('.scheme-panel-toolbar');
    const panelToolbarGroups=[
      $('.scheme-panel-title'),
      $('.scheme-filter-group'),
      $('.scheme-action-toolbar'),
      $('.scheme-manage-group')
    ].filter(Boolean);
    const panelToolbarTop=panelToolbarGroups[0]?.getBoundingClientRect().top||0;
    const toolbarSingleLine=panelToolbarGroups.length===4 && panelToolbarGroups.every(el=>
      Math.abs(el.getBoundingClientRect().top-panelToolbarTop)<4
    );
    currentCanvasPage='pattern';
    setCanvasModeControl('pattern');
    renderSvg();
    await wait(30);
    const usageBar=$('#roleUsageBar');
    const usageTrack=usageBar?.querySelector('.role-usage-track');
    const usageSegment=usageBar?.querySelector('.role-usage-segment');
    const canvasWrap=$('.canvas-wrap');
    const patternSvg=$('#patternSvg');
    const patternBands=[...document.querySelectorAll('#patternSvg [data-stripe-key][data-repeat-index]')];
    const patternRect=patternSvg?.getBoundingClientRect();
    const bandRects=patternBands.map(el=>el.getBoundingClientRect());
    const patternContentTop=bandRects.length ? Math.min(...bandRects.map(rect=>rect.top)) : 0;
    const patternContentBottom=bandRects.length ? Math.max(...bandRects.map(rect=>rect.bottom)) : 0;
    const patternFillsCanvas=!!patternRect && bandRects.length>0 &&
      patternSvg.getAttribute('preserveAspectRatio')==='none' &&
      Math.abs(patternContentTop-patternRect.top)<2 &&
      Math.abs(patternContentBottom-patternRect.bottom)<2;
    const usageMetrics={
      flexDirection:usageTrack ? getComputedStyle(usageTrack).flexDirection : '',
      barLeft:usageBar?.getBoundingClientRect().left||0,
      canvasRight:canvasWrap?.getBoundingClientRect().right||0,
      barHeight:usageBar?.getBoundingClientRect().height||0,
      canvasHeight:canvasWrap?.getBoundingClientRect().height||0,
      segmentHeight:usageSegment?.style.height||''
    };
    const usageIsVertical=!!usageBar && !!usageTrack && !!usageSegment && !!canvasWrap &&
      usageMetrics.flexDirection==='column' &&
      usageMetrics.barLeft>=usageMetrics.canvasRight-1 &&
      Math.abs(usageMetrics.barHeight-usageMetrics.canvasHeight)<3 &&
      parseFloat(usageSegment.style.height)>0;
    const repeatedApplyHidden=!compactCard?.querySelector('.scheme-apply-btn') ||
      getComputedStyle(compactCard.querySelector('.scheme-apply-btn')).display==='none';
    const panelControlsReady=document.body.dataset.schemePanelControls==='ready';
    const expandButton=$('#expandSchemePanelBtn');
    expandButton?.click();
    await wait(40);
    const panelExpanded=document.body.classList.contains('scheme-panel-expanded') &&
      expandButton?.getAttribute('aria-pressed')==='true';
    expandButton?.click();
    await wait(40);
    const panelRestored=!document.body.classList.contains('scheme-panel-expanded') &&
      expandButton?.getAttribute('aria-pressed')==='false';

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
      hasScaleOvershoot,
      surfaceSwapUsesCurtain,
      surfaceSwapUsesOpacity,
      hasWave,
      horizontalGap,
      verticalGap,
      exportCells:cells.length,
      mediumLayout:{
        cards:mediumCells.length,
        firstRowCount:mediumFirstRowCount,
        cardWidth:mediumCells[0]?.w||0
      },
      beforeSixLayout:{
        cards:beforeSixCells.length,
        firstRowCount:beforeSixFirstRowCount
      },
      thresholdSixLayout:{
        cards:thresholdSixCells.length,
        firstRowCount:thresholdSixFirstRowCount
      },
      sixColumnLayout:{
        cards:sixCells.length,
        firstRowCount,
        lastRowCount,
        lastRowCentered,
        equalCardWidths
      },
      schemeSpace:{
        compactCardHeight,
        controlsSameLine,
        toolbarSingleLine,
        usageIsVertical,
        usageMetrics,
        patternFillsCanvas,
        repeatedApplyHidden,
        panelControlsReady,
        panelExpanded,
        panelRestored,
        hasResizer:!!$('#schemePanelResizer'),
        footerHeight:compactFooter?.getBoundingClientRect().height||0
      },
      hasCardBorder:exportData.svg.includes('stroke="#C7CDD0"'),
      hasCardShadow:exportData.svg.includes('filter="url(#copyDisplayCardShadow)"'),
      cardCaptionCount:(exportData.svg.match(/data-export-card-caption=/g)||[]).length,
      colorCaptionCount:(exportData.svg.match(/data-export-card-colors=/g)||[]).length,
      hasProjectName:exportData.svg.includes('导出标题测试项目 · 单循环'),
      usesCurrentLibraryNames:
        exportData.svg.includes('色库金棕新名') &&
        exportData.svg.includes('色库赤棕新名') &&
        !exportData.svg.includes('旧金棕名'),
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

const electron = path.resolve("node_modules/electron/dist/electron.exe");
const electronRunner = path.resolve("work/electron_dump_dom.cjs");
const { stdout, stderr } = await execFileAsync(electron, [
  electronRunner,
  fileURLToPath(testHtmlPath),
  "__CODEX_MOTION_SORT_RESULT__",
  "20000",
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
  result.hasScaleOvershoot ||
  result.surfaceSwapUsesCurtain ||
  result.surfaceSwapUsesOpacity ||
  result.hasWave ||
  result.horizontalGap !== 12 ||
  result.verticalGap !== 68 ||
  result.exportCells !== 4 ||
  result.mediumLayout.cards !== 14 ||
  result.mediumLayout.firstRowCount !== 3 ||
  result.mediumLayout.cardWidth < 500 ||
  result.beforeSixLayout.cards !== 17 ||
  result.beforeSixLayout.firstRowCount !== 4 ||
  result.thresholdSixLayout.cards !== 18 ||
  result.thresholdSixLayout.firstRowCount !== 6 ||
  result.sixColumnLayout.cards !== 20 ||
  result.sixColumnLayout.firstRowCount !== 6 ||
  result.sixColumnLayout.lastRowCount !== 2 ||
  !result.sixColumnLayout.lastRowCentered ||
  !result.sixColumnLayout.equalCardWidths ||
  result.schemeSpace.compactCardHeight > 124 ||
  !result.schemeSpace.controlsSameLine ||
  !result.schemeSpace.toolbarSingleLine ||
  !result.schemeSpace.usageIsVertical ||
  !result.schemeSpace.patternFillsCanvas ||
  !result.schemeSpace.repeatedApplyHidden ||
  !result.schemeSpace.panelControlsReady ||
  !result.schemeSpace.panelExpanded ||
  !result.schemeSpace.panelRestored ||
  !result.schemeSpace.hasResizer ||
  result.schemeSpace.footerHeight > 34 ||
  result.hasCardBorder ||
  !result.hasCardShadow ||
  result.cardCaptionCount !== 4 ||
  result.colorCaptionCount !== 4 ||
  !result.hasProjectName ||
  !result.usesCurrentLibraryNames ||
  (result.runtimeErrors||[]).length
) {
  throw new Error(`Unexpected result: ${JSON.stringify(result)}`);
}
