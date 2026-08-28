import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const execFileAsync=promisify(execFile);
const [sourceHtml]=process.argv.slice(2);
if(!sourceHtml)throw new Error("Expected source HTML path");

const html=await fs.readFile(sourceHtml,"utf8");
// A unique file URL prevents Edge from occasionally reusing a cached copy
// while this regression test is being run repeatedly in quick succession.
const testHtmlPath=new URL(
  `./calm_motion_test_${process.pid}_${Date.now()}.html`,
  import.meta.url
);
const injection=`
const __codexNativeMatchMedia=window.matchMedia.bind(window);
window.matchMedia=query=>{
  const result=__codexNativeMatchMedia(query);
  if(!String(query).includes('prefers-reduced-motion'))return result;
  const controlled=Object.create(result);
  Object.defineProperty(controlled,'matches',{value:false,enumerable:true});
  return controlled;
};
setTimeout(async()=>{
  const errors=[];
  window.addEventListener('error',e=>errors.push(String(e.error||e.message)));
  window.addEventListener('unhandledrejection',e=>errors.push(String(e.reason)));
  const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  const frames=el=>(el?.getAnimations({subtree:false})||[])
    .flatMap(animation=>animation.effect?.getKeyframes?.()||[]);
  const hasOpacityFade=list=>list.some(frame=>
    frame.opacity!==undefined &&
    frame.opacity!=='' &&
    Number(frame.opacity)<.999
  );

  try{
    for(let i=0;i<30 && !durableVaultReady;i++)await wait(50);
    // durableVaultReady becomes true slightly before the rest of startup
    // rendering finishes; wait for that final startup pass before measuring.
    await wait(420);

    const motionLog=[];
    const nativeAnimate=Element.prototype.animate;
    Element.prototype.animate=function(keyframes,options){
      motionLog.push({
        element:this,
        selectionPulse:!!this.closest?.('.stripe-selection-pulse-layer'),
        keyframes:Array.isArray(keyframes)?keyframes:[keyframes],
        options
      });
      return nativeAnimate.call(this,keyframes,options);
    };

    state.stripes=[
      {lanes:8,role:'A'},
      {lanes:6,role:'B'},
      {lanes:4,role:'C'},
      {lanes:2,role:'D'}
    ];
    state.roles={
      A:{color:'#1B1B1B',name:'主色',locked:false},
      B:{color:'#C9B09A',name:'辅助色',locked:false},
      C:{color:'#B56F74',name:'点缀色',locked:false},
      D:{color:'#DCE7E5',name:'浅色',locked:false}
    };
    state.repeatCount=3;
    state.laneSize=.6;
    state.schemes=[];
    state.favorites=[];
    renderAll();
    await wait(60);
    motionLog.length=0;

    const countSelect=$('#schemeCount');
    const compareButton=$('#compareBtn');
    const controlGeometry={
      countWidth:countSelect.getBoundingClientRect().width,
      countScrollWidth:countSelect.scrollWidth,
      compareWidth:compareButton.getBoundingClientRect().width,
      compareScrollWidth:compareButton.scrollWidth
    };

    syncInterfaceMotionBaseline();
    queueInterfaceMotion('scheme');
    state.stripes=[
      {lanes:6,role:'C'},
      {lanes:1,role:'B'},
      {lanes:4,role:'C'},
      {lanes:1,role:'A'},
      {lanes:11,role:'C'},
      {lanes:3,role:'A'},
      {lanes:8,role:'B'}
    ];
    renderAll();
    await wait(28);

    // 角色集合不变、仅比例变化时，竖向占比条应做连续高度插值；
    // 首次出现或角色集合变化则直接完整显示，避免露出空白。
    motionLog.length=0;
    state.stripes=[
      {lanes:10,role:'C'},
      {lanes:3,role:'B'},
      {lanes:5,role:'A'},
      {lanes:7,role:'C'},
      {lanes:4,role:'B'},
      {lanes:5,role:'A'}
    ];
    renderAll();
    await wait(28);

    const usageSegments=[...document.querySelectorAll('#roleUsageBar .role-usage-segment')];
    const usageEntries=motionLog.filter(entry=>
      entry.element.classList?.contains('role-usage-segment')
    );
    const usageHeightFrames=usageEntries.flatMap(entry=>entry.keyframes);
    const usageResult={
      segmentCount:usageSegments.length,
      animationCount:usageEntries.length,
      hasHeightMotion:usageHeightFrames.some(frame=>frame.height!==undefined && frame.height!==''),
      hasOpacityFade:hasOpacityFade(usageHeightFrames)
    };

    const calmTargets={
      sidebar:motionLog.filter(entry=>entry.element===$('.sidebar')).flatMap(entry=>entry.keyframes),
      canvas:motionLog.filter(entry=>entry.element===$('#patternSvg')).flatMap(entry=>entry.keyframes),
      schemes:motionLog.filter(entry=>entry.element===$('#schemes')).flatMap(entry=>entry.keyframes),
      rightbar:motionLog.filter(entry=>entry.element===$('.rightbar')).flatMap(entry=>entry.keyframes)
    };
    const calmResult={
      sidebarFade:hasOpacityFade(calmTargets.sidebar),
      canvasFade:hasOpacityFade(calmTargets.canvas),
      schemesFade:hasOpacityFade(calmTargets.schemes),
      rightbarFade:hasOpacityFade(calmTargets.rightbar),
      waveExists:!!document.querySelector('.interface-motion-wave')
    };

    ensureStripeSortIds();
    motionLog.length=0;
    stripeSelection=new Set([0]);
    lastStripeSelectionPulseKey='';
    updateStripeSelectionMarkers();
    await wait(12);
    const selectedHighlightKept=motionLog.some(entry=>entry.selectionPulse);

    colorLibrary=Array.from({length:9},(_,index)=>({
      id:'C9'+String(index+1).padStart(2,'0'),
      type:'solid',
      name:'测试颜色'+(index+1),
      hex:'#'+String(0x334455+index*0x080604).padStart(6,'0').slice(-6).toUpperCase()
    }));
    writeSavedPalettes([{
      id:'pal_motion_test',
      name:'动画测试色板',
      colors:colorLibrary.slice(0,4).map(item=>item.id),
      savedAt:Date.now()
    }]);
    collapsedLibraryGroups.clear();
    setPagePosition($('#designPage'),'left');
    setPagePosition($('#colorLibraryPage'),'active');
    currentAppPage='library';
    renderLibraryTable();
    await wait(30);

    motionLog.length=0;
    const firstGroupButton=document.querySelector(
      '.library-group-head[data-group-key="palette_0"]'
    );
    firstGroupButton.click();
    await wait(35);
    const foldingRow=document.querySelector(
      '.library-resource-row[data-group-key="palette_0"]'
    );
    const foldEntries=motionLog.filter(entry=>
      entry.element.dataset?.groupKey==='palette_0' &&
      entry.element.classList?.contains('library-resource-row')
    );
    const foldFrames=foldEntries.flatMap(entry=>entry.keyframes);
    const foldMotion={
      animations:foldEntries.length,
      hasClip:foldFrames.some(frame=>frame.clipPath!==undefined && frame.clipPath!==''),
      hasOpacityFade:hasOpacityFade(foldFrames)
    };

    await wait(230);
    const movedHeader=document.querySelector(
      '.library-group-row[data-group-key="ungrouped"]'
    );
    const reflowEntries=motionLog.filter(entry=>
      entry.element===movedHeader
    );
    const reflowMotion={
      animations:reflowEntries.length,
      hasTransform:reflowEntries.flatMap(entry=>entry.keyframes).some(frame=>frame.transform && frame.transform!=='none'),
      collapsed:collapsedLibraryGroups.has('palette_0')
    };

    await wait(220);
    for(let i=0;i<12 && libraryGroupMotionBusy.has('palette_0');i++){
      await wait(50);
    }
    motionLog.length=0;
    document.querySelector(
      '.library-group-head[data-group-key="palette_0"]'
    ).click();
    await wait(35);
    const expandingRow=document.querySelector(
      '.library-resource-row[data-group-key="palette_0"]:not(.group-hidden)'
    );
    const expandEntries=motionLog.filter(entry=>
      entry.element.dataset?.groupKey==='palette_0' &&
      entry.element.classList?.contains('library-resource-row')
    );
    const expandFrames=expandEntries.flatMap(entry=>entry.keyframes);
    const expandMotion={
      animations:expandEntries.length,
      hasClip:expandFrames.some(frame=>frame.clipPath!==undefined && frame.clipPath!==''),
      hasOpacityFade:hasOpacityFade(expandFrames),
      expanded:!collapsedLibraryGroups.has('palette_0')
    };

    const scroller=document.createElement('div');
    scroller.style.cssText='width:180px;height:80px;overflow-y:auto;position:fixed;left:-9999px;top:0';
    const longContent=document.createElement('div');
    longContent.style.height='500px';
    scroller.appendChild(longContent);
    document.body.appendChild(scroller);

    motionLog.length=0;
    scroller.scrollTop=0;
    longContent.dispatchEvent(new WheelEvent('wheel',{deltaY:-92,bubbles:true}));
    await wait(8);
    const topEntries=motionLog.filter(entry=>entry.element===scroller);
    const topBounce={animations:topEntries.length,frames:topEntries.flatMap(entry=>entry.keyframes)};

    await wait(230);
    motionLog.length=0;
    longContent.dispatchEvent(new WheelEvent('wheel',{deltaY:-20,bubbles:true}));
    await wait(8);
    const slowBounceCount=motionLog.filter(entry=>entry.element===scroller).length;

    await wait(165);
    motionLog.length=0;
    scroller.scrollTop=scroller.scrollHeight-scroller.clientHeight;
    longContent.dispatchEvent(new WheelEvent('wheel',{deltaY:110,bubbles:true}));
    await wait(8);
    const bottomEntries=motionLog.filter(entry=>entry.element===scroller);
    const bottomBounce={animations:bottomEntries.length,frames:bottomEntries.flatMap(entry=>entry.keyframes)};
    scroller.remove();

    const edgeResult={
      topAnimations:topBounce.animations,
      topTransform:topBounce.frames.some(frame=>String(frame.transform||'').includes('translateY')),
      slowAnimations:slowBounceCount,
      bottomAnimations:bottomBounce.animations,
      bottomTransform:bottomBounce.frames.some(frame=>String(frame.transform||'').includes('translateY')),
      topHasOpacity:hasOpacityFade(topBounce.frames),
      bottomHasOpacity:hasOpacityFade(bottomBounce.frames)
    };

    const result={
      controlGeometry,
      usageResult,
      calmResult,
      selectedHighlightKept,
      foldMotion,
      reflowMotion,
      expandMotion,
      edgeResult,
      errors
    };
    document.body.textContent='__CODEX_CALM_MOTION_RESULT__'+JSON.stringify(result);
  }catch(error){
    document.body.textContent='__CODEX_CALM_MOTION_RESULT__'+JSON.stringify({
      error:error?.stack||String(error),errors
    });
  }
},0);
`;

const closurePattern=/\n\}\)\(\);\s*\n\s*<\/script>\s*\n<\/body>/i;
if(!closurePattern.test(html))throw new Error("Could not locate app closure");
await fs.writeFile(
  testHtmlPath,
  html.replace(closurePattern,`${injection}\n})();\n\n</script>\n</body>`),
  "utf8"
);

const electron=path.resolve('node_modules/electron/dist/electron.exe');
const electronRunner=path.resolve('work/electron_dump_dom.cjs');
const {stdout,stderr}=await execFileAsync(electron,[
  electronRunner,
  fileURLToPath(testHtmlPath),
  '__CODEX_CALM_MOTION_RESULT__',
  '22000'
],{maxBuffer:24*1024*1024,windowsHide:true});

const marker="__CODEX_CALM_MOTION_RESULT__";
const start=stdout.lastIndexOf(marker);
if(start<0)throw new Error(`Browser result missing. ${stderr.slice(0,1000)}`);
const tail=stdout.slice(start+marker.length);
const end=tail.indexOf("</body>");
if(end<0)throw new Error("Browser result terminator missing");
const result=JSON.parse(tail.slice(0,end).trim());
if(result.error)throw new Error(result.error);
console.log(JSON.stringify(result));

if(
  result.controlGeometry.countWidth<120 ||
  result.controlGeometry.countScrollWidth>result.controlGeometry.countWidth+2 ||
  result.controlGeometry.compareScrollWidth>result.controlGeometry.compareWidth+2 ||
  result.usageResult.segmentCount<2 ||
  result.usageResult.animationCount<1 ||
  !result.usageResult.hasHeightMotion ||
  result.usageResult.hasOpacityFade ||
  result.calmResult.sidebarFade ||
  result.calmResult.canvasFade ||
  result.calmResult.schemesFade ||
  result.calmResult.rightbarFade ||
  result.calmResult.waveExists ||
  !result.selectedHighlightKept ||
  result.foldMotion.animations<1 ||
  !result.foldMotion.hasClip ||
  result.foldMotion.hasOpacityFade ||
  !result.reflowMotion.collapsed ||
  !result.reflowMotion.hasTransform ||
  result.expandMotion.animations<1 ||
  !result.expandMotion.hasClip ||
  result.expandMotion.hasOpacityFade ||
  !result.expandMotion.expanded ||
  result.edgeResult.topAnimations<1 ||
  !result.edgeResult.topTransform ||
  result.edgeResult.slowAnimations!==0 ||
  result.edgeResult.bottomAnimations<1 ||
  !result.edgeResult.bottomTransform ||
  result.edgeResult.topHasOpacity ||
  result.edgeResult.bottomHasOpacity ||
  (result.errors||[]).length
){
  throw new Error(`Unexpected result: ${JSON.stringify(result)}`);
}
