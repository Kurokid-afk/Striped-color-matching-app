import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const execFileAsync=promisify(execFile);
const [sourceHtml]=process.argv.slice(2);
if(!sourceHtml)throw new Error("Expected source HTML path");
const html=await fs.readFile(sourceHtml,"utf8");
const testHtmlPath=new URL("./transition_drag_test.html",import.meta.url);
const injection=`
window.addEventListener('load',async()=>{
  const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  const waitUntil=async(test,timeout=1800)=>{
    const end=performance.now()+timeout;
    while(performance.now()<end){
      if(test())return true;
      await wait(20);
    }
    return false;
  };
  const errors=[];
  window.addEventListener('error',e=>errors.push(String(e.error||e.message)));
  window.addEventListener('unhandledrejection',e=>errors.push(String(e.reason)));
  const motionFrames=el=>(el?.getAnimations()||[])
    .flatMap(animation=>animation.effect?.getKeyframes?.()||[]);
  try{
    for(let i=0;i<50 && !durableVaultReady;i++)await wait(50);
    await wait(80);

    const toLibrary=showColorLibrary();
    const library=$('#colorLibraryPage');
    const design=$('#designPage');
    await waitUntil(()=>library.getAnimations().length>0);
    await wait(45);
    const libraryFrames=motionFrames(library);
    const designFrames=motionFrames(design);
    const pageMid={
      incomingTranslate:getComputedStyle(library).translate,
      outgoingTranslate:getComputedStyle(design).translate,
      incomingFrames:libraryFrames,
      outgoingFrames:designFrames
    };
    await toLibrary;
    const libraryFinal=getComputedStyle(library).translate;

    await showDesignPage();
    state.favorites=[captureFavoriteEntry(state.roles,'motion-test')];
    const toFavorites=showFavoriteCanvas();
    await wait(70);
    const favorite=$('#favoriteOverview');
    const pattern=$('#patternSvg');
    const canvasMid={
      incomingTranslate:getComputedStyle(favorite).translate,
      outgoingTranslate:getComputedStyle(pattern).translate,
      incomingFrames:motionFrames(favorite),
      outgoingFrames:motionFrames(pattern)
    };
    await toFavorites;
    await showCurrentCanvas();

    state.stripes=[
      {lanes:1,role:'A'},
      {lanes:2,role:'B'},
      {lanes:3,role:'C'},
      {lanes:4,role:'D'}
    ];
    ensureStripeSortIds();
    const initialStripeIds=state.stripes.map(item=>item._sortId);
    renderAll();
    await wait(80);
    const firstGrip=$('.stripe-drag-grip[data-i="0"]');
    const gripRect=firstGrip.getBoundingClientRect();
    const lastStripe=$('.stripe-item[data-i="3"]');
    const lastRect=lastStripe.getBoundingClientRect();
    firstGrip.dispatchEvent(new PointerEvent('pointerdown',{
      bubbles:true,cancelable:true,button:0,pointerId:77,
      clientX:gripRect.left+gripRect.width/2,
      clientY:gripRect.top+gripRect.height/2
    }));
    window.dispatchEvent(new PointerEvent('pointermove',{
      bubbles:true,cancelable:true,button:0,pointerId:77,
      clientX:lastRect.left+lastRect.width/2,
      clientY:lastRect.bottom-2
    }));
    window.dispatchEvent(new PointerEvent('pointerup',{
      bubbles:true,cancelable:true,button:0,pointerId:77,
      clientX:lastRect.left+lastRect.width/2,
      clientY:lastRect.bottom-2
    }));
    await wait(320);
    const actualDragOrder=state.stripes.map(item=>item._sortId);
    const actualDragMoved=actualDragOrder.at(-1)===initialStripeIds[0];

    const source=document.createElement('div');
    const proxy=document.createElement('div');
    source.getBoundingClientRect=()=>({
      left:120,top:240,right:340,bottom:300,width:220,height:60
    });
    document.body.append(source,proxy);
    pointerSortSession={
      sourceEls:[source],
      proxy:{el:proxy,x:36,y:72},
      settling:false
    };
    const settlePromise=settlePointerProxyToPlaceholder(230);
    await wait(12);
    const settleFrames=motionFrames(proxy);
    const settleTransforms=settleFrames.map(frame=>frame.transform||'');
    const settleUniquePositions=[...new Set(settleTransforms)];
    await settlePromise;
    proxy.remove();
    source.remove();
    pointerSortSession=null;

    const beforeLayout=Number(document.body.dataset.appleLayoutMotions)||0;
    suppressAppleLayoutMotion(260);
    const mutation=document.createElement('div');
    mutation.dataset.sortKey='suppressed-drag-commit';
    mutation.style.cssText='width:20px;height:20px';
    document.body.appendChild(mutation);
    await wait(50);
    const afterLayout=Number(document.body.dataset.appleLayoutMotions)||0;
    mutation.remove();

    const result={
      pageMid,
      libraryFinal,
      canvasMid,
      settleMode:document.body.dataset.sortSettleMode,
      settleTransforms,
      settleUniquePositions,
      actualDragMoved,
      actualDragOrder,
      layoutSuppressed:beforeLayout===afterLayout,
      reducedMotionForcedOff:uiReducedMotion()===false,
      errors
    };
    document.body.textContent='__TRANSITION_DRAG_RESULT__'+JSON.stringify(result);
  }catch(error){
    document.body.textContent='__TRANSITION_DRAG_RESULT__'+JSON.stringify({
      error:error?.stack||String(error),errors
    });
  }
});
`;
const closurePattern=/\n\}\)\(\);\s*\n\s*<\/script>\s*\n<\/body>/i;
if(!closurePattern.test(html))throw new Error("Could not locate app closure");
await fs.writeFile(
  testHtmlPath,
  html.replace(closurePattern,`${injection}\n})();\n\n</script>\n</body>`),
  "utf8"
);

const electron=path.resolve("node_modules/electron/dist/electron.exe");
const runner=path.resolve("work/electron_dump_dom.cjs");
const {stdout,stderr}=await execFileAsync(electron,[
  runner,fileURLToPath(testHtmlPath),"__TRANSITION_DRAG_RESULT__","30000"
],{maxBuffer:32*1024*1024,windowsHide:true});
const marker="__TRANSITION_DRAG_RESULT__";
const start=stdout.lastIndexOf(marker);
if(start<0)throw new Error(`Electron result missing: ${stderr.slice(0,1000)}`);
const tail=stdout.slice(start+marker.length);
const end=tail.indexOf("</body>");
if(end<0)throw new Error("Electron result terminator missing");
const result=JSON.parse(tail.slice(0,end).trim());
if(result.error)throw new Error(result.error);
console.log(JSON.stringify(result));

const hasVisibleTranslate=frames=>frames.some((frame,index)=>
  index===0 && String(frame.translate||'')!=='' && String(frame.translate||'')!=='0px'
);
const hasOpacityFrame=frames=>frames.some(frame=>frame.opacity!==undefined);
if(
  !hasVisibleTranslate(result.pageMid.incomingFrames) ||
  !hasVisibleTranslate(result.pageMid.outgoingFrames.slice().reverse()) ||
  result.pageMid.incomingTranslate==='none' ||
  !hasVisibleTranslate(result.canvasMid.incomingFrames) ||
  result.canvasMid.incomingTranslate==='none' ||
  hasOpacityFrame(result.pageMid.incomingFrames) ||
  hasOpacityFrame(result.canvasMid.incomingFrames) ||
  result.settleMode!=="direct-embed" ||
  result.settleTransforms.length<2 ||
  result.settleUniquePositions.length!==1 ||
  !result.actualDragMoved ||
  !result.layoutSuppressed ||
  !result.reducedMotionForcedOff ||
  (result.errors||[]).length
){
  throw new Error(`Unexpected transition/drag result: ${JSON.stringify(result)}`);
}
