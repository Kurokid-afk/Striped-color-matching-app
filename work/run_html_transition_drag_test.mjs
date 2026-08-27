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
    const stageWidth=$('#pageStage').getBoundingClientRect().width;
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

    const toDesign=showDesignPage();
    await waitUntil(()=>design.getAnimations().length>0);
    await wait(45);
    const pageBackMid={
      incomingTranslate:getComputedStyle(design).translate,
      outgoingTranslate:getComputedStyle(library).translate,
      incomingFrames:motionFrames(design),
      outgoingFrames:motionFrames(library)
    };
    await toDesign;
    state.favorites=[captureFavoriteEntry(state.roles,'motion-test')];
    const canvasWidth=$('.canvas-wrap').getBoundingClientRect().width;
    const toFavorites=showFavoriteCanvas();
    await waitUntil(()=>$('#favoriteOverview').getAnimations().length>0);
    await wait(45);
    const favorite=$('#favoriteOverview');
    const pattern=$('#patternSvg');
    const canvasMid={
      incomingTranslate:getComputedStyle(favorite).translate,
      outgoingTranslate:getComputedStyle(pattern).translate,
      incomingFrames:motionFrames(favorite),
      outgoingFrames:motionFrames(pattern)
    };
    await toFavorites;
    const canvasForwardDirection=document.body.dataset.canvasTransition;

    const toCurrent=showCurrentCanvas();
    await waitUntil(()=>pattern.getAnimations().length>0);
    await wait(45);
    const canvasBackMid={
      incomingTranslate:getComputedStyle(pattern).translate,
      outgoingTranslate:getComputedStyle(favorite).translate,
      incomingFrames:motionFrames(pattern),
      outgoingFrames:motionFrames(favorite)
    };
    await toCurrent;
    const canvasBackDirection=document.body.dataset.canvasTransition;

    const compareRoles=roleNames();
    const compareBase=Object.fromEntries(compareRoles.map(role=>[
      role,
      serializeFillRef(roleFillRef(state.roles[role]))
    ]));
    const reversedRefs=compareRoles
      .map(role=>serializeFillRef(roleFillRef(state.roles[role])))
      .reverse();
    const compareAlternate=Object.fromEntries(
      compareRoles.map((role,index)=>[role,reversedRefs[index]])
    );
    state.schemes=[
      {mapping:compareBase},
      {mapping:compareAlternate}
    ];
    state.selectedSchemes=[0,1];
    renderSchemes(false);

    const toCompare=showCompareCanvas();
    const compareCanvas=$('#compareCanvas');
    await waitUntil(()=>compareCanvas.getAnimations().length>0);
    await wait(45);
    const compareMid={
      incomingTranslate:getComputedStyle(compareCanvas).translate,
      outgoingTranslate:getComputedStyle(pattern).translate,
      incomingFrames:motionFrames(compareCanvas),
      outgoingFrames:motionFrames(pattern)
    };
    await toCompare;
    const compareForwardDirection=document.body.dataset.canvasTransition;

    const compareToCurrent=showCurrentCanvas();
    await waitUntil(()=>pattern.getAnimations().length>0);
    await wait(45);
    const compareBackMid={
      incomingTranslate:getComputedStyle(pattern).translate,
      outgoingTranslate:getComputedStyle(compareCanvas).translate,
      incomingFrames:motionFrames(pattern),
      outgoingFrames:motionFrames(compareCanvas)
    };
    await compareToCurrent;
    const compareBackDirection=document.body.dataset.canvasTransition;

    state.selectedSchemes=[];
    const invalidCompareBefore=currentCanvasPage;
    await showCompareCanvas();
    const invalidCompareRejected=(
      currentCanvasPage===invalidCompareBefore &&
      !persistentCanvasBusy &&
      uiOperation==='idle'
    );

    state.schemeFilter='all';
    renderSchemes(false);
    const schemes=$('#schemes');
    const schemesWidth=schemes.getBoundingClientRect().width;
    const toFavoriteSchemes=switchSchemeFilter('favorites');
    await waitUntil(()=>schemes.getAnimations().length>0);
    await wait(35);
    const schemeForwardOutFrames=motionFrames(schemes);
    await waitUntil(()=>(
      document.body.dataset.schemeFilterPhase==='incoming'
    ));
    await wait(25);
    const schemeForwardInFrames=motionFrames(schemes);
    const schemeForwardInComputed=getComputedStyle(schemes).translate;
    await toFavoriteSchemes;
    const schemeForwardDirection=document.body.dataset.schemeFilterTransition;
    const schemeForwardMotion=JSON.parse(document.body.dataset.schemeFilterMotion);

    const toAllSchemes=switchSchemeFilter('all');
    await waitUntil(()=>schemes.getAnimations().length>0);
    await wait(35);
    const schemeBackOutFrames=motionFrames(schemes);
    await waitUntil(()=>(
      document.body.dataset.schemeFilterPhase==='incoming'
    ));
    await wait(25);
    const schemeBackInFrames=motionFrames(schemes);
    const schemeBackInComputed=getComputedStyle(schemes).translate;
    await toAllSchemes;
    const schemeBackDirection=document.body.dataset.schemeFilterTransition;
    const schemeBackMotion=JSON.parse(document.body.dataset.schemeFilterMotion);

    const rapidForward=switchSchemeFilter('favorites');
    const ignoredReverse=switchSchemeFilter('all');
    await Promise.all([rapidForward,ignoredReverse]);
    const rapidFilterFinal=state.schemeFilter;
    await switchSchemeFilter('all');

    const favoriteBackup=[...state.favorites];
    state.favorites=[];
    renderSchemes(false);
    await switchSchemeFilter('favorites');
    const emptyFavoritesStable=(
      state.schemeFilter==='favorites' &&
      !schemeFilterBusy &&
      uiOperation==='idle'
    );
    await switchSchemeFilter('all');
    state.favorites=favoriteBackup;
    renderSchemes(false);

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
    const initialStripeNodes=new Map(
      [...document.querySelectorAll('#stripeList > .stripe-item')]
        .map(row=>[row.dataset.sortKey,row])
    );
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
    const actualRows=[...document.querySelectorAll('#stripeList > .stripe-item')];
    const stripeDomPreserved=actualRows.every(row=>
      initialStripeNodes.get(row.dataset.sortKey)===row
    );
    const stripeIndicesAligned=actualRows.every((row,index)=>
      Number(row.dataset.i)===index &&
      [...row.querySelectorAll('[data-i]')].every(el=>Number(el.dataset.i)===index)
    );

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
    const settleProxyRemoved=!proxy.isConnected;
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
      pageBackMid,
      stageWidth,
      libraryFinal,
      canvasWidth,
      canvasMid,
      canvasBackMid,
      canvasForwardDirection,
      canvasBackDirection,
      compareMid,
      compareBackMid,
      compareForwardDirection,
      compareBackDirection,
      invalidCompareRejected,
      schemesWidth,
      schemeForwardOutFrames,
      schemeForwardInFrames,
      schemeForwardInComputed,
      schemeForwardMotion,
      schemeBackOutFrames,
      schemeBackInFrames,
      schemeBackInComputed,
      schemeBackMotion,
      schemeForwardDirection,
      schemeBackDirection,
      rapidFilterFinal,
      emptyFavoritesStable,
      schemeFilterBusyFinal:schemeFilterBusy,
      uiOperationFinal:uiOperation,
      settleMode:document.body.dataset.sortSettleMode,
      settleTransforms,
      settleUniquePositions,
      actualDragMoved,
      actualDragOrder,
      stripeDomPreserved,
      stripeIndicesAligned,
      stripeDropDomCommit:document.body.dataset.stripeDropDomCommit,
      settleProxyRemoved,
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
const framePixels=value=>Math.abs(parseFloat(String(value||'0'))||0);
if(
  !hasVisibleTranslate(result.pageMid.incomingFrames) ||
  !hasVisibleTranslate(result.pageMid.outgoingFrames.slice().reverse()) ||
  framePixels(result.pageMid.incomingFrames[0]?.translate)<result.stageWidth*.9 ||
  framePixels(result.pageMid.outgoingFrames.at(-1)?.translate)<result.stageWidth*.9 ||
  !hasVisibleTranslate(result.pageBackMid.incomingFrames) ||
  !hasVisibleTranslate(result.pageBackMid.outgoingFrames.slice().reverse()) ||
  framePixels(result.pageBackMid.incomingFrames[0]?.translate)<result.stageWidth*.9 ||
  framePixels(result.pageBackMid.outgoingFrames.at(-1)?.translate)<result.stageWidth*.9 ||
  result.pageMid.incomingTranslate==='none' ||
  !hasVisibleTranslate(result.canvasMid.incomingFrames) ||
  !hasVisibleTranslate(result.canvasMid.outgoingFrames.slice().reverse()) ||
  framePixels(result.canvasMid.incomingFrames[0]?.translate)<result.canvasWidth*.9 ||
  framePixels(result.canvasMid.outgoingFrames.at(-1)?.translate)<result.canvasWidth*.9 ||
  result.canvasMid.incomingTranslate==='none' ||
  !hasVisibleTranslate(result.canvasBackMid.incomingFrames) ||
  !hasVisibleTranslate(result.canvasBackMid.outgoingFrames.slice().reverse()) ||
  framePixels(result.canvasBackMid.incomingFrames[0]?.translate)<result.canvasWidth*.9 ||
  framePixels(result.canvasBackMid.outgoingFrames.at(-1)?.translate)<result.canvasWidth*.9 ||
  hasOpacityFrame(result.canvasBackMid.incomingFrames) ||
  result.canvasForwardDirection!=='pattern->favorites:forward' ||
  result.canvasBackDirection!=='favorites->pattern:backward' ||
  !hasVisibleTranslate(result.compareMid.incomingFrames) ||
  !hasVisibleTranslate(result.compareMid.outgoingFrames.slice().reverse()) ||
  framePixels(result.compareMid.incomingFrames[0]?.translate)<result.canvasWidth*.9 ||
  framePixels(result.compareMid.outgoingFrames.at(-1)?.translate)<result.canvasWidth*.9 ||
  !hasVisibleTranslate(result.compareBackMid.incomingFrames) ||
  !hasVisibleTranslate(result.compareBackMid.outgoingFrames.slice().reverse()) ||
  framePixels(result.compareBackMid.incomingFrames[0]?.translate)<result.canvasWidth*.9 ||
  framePixels(result.compareBackMid.outgoingFrames.at(-1)?.translate)<result.canvasWidth*.9 ||
  hasOpacityFrame(result.compareMid.incomingFrames) ||
  hasOpacityFrame(result.compareBackMid.incomingFrames) ||
  result.compareForwardDirection!=='pattern->compare:forward' ||
  result.compareBackDirection!=='compare->pattern:backward' ||
  !result.invalidCompareRejected ||
  framePixels(result.schemeForwardOutFrames.at(-1)?.translate)<result.schemesWidth*.9 ||
  framePixels(result.schemeBackOutFrames.at(-1)?.translate)<result.schemesWidth*.9 ||
  hasOpacityFrame(result.schemeForwardOutFrames) ||
  hasOpacityFrame(result.schemeForwardInFrames) ||
  hasOpacityFrame(result.schemeBackOutFrames) ||
  hasOpacityFrame(result.schemeBackInFrames) ||
  result.schemeForwardDirection!=='all->favorites:forward' ||
  result.schemeBackDirection!=='favorites->all:backward' ||
  result.schemeForwardMotion.outgoingX>=0 ||
  result.schemeForwardMotion.incomingX<=0 ||
  result.schemeForwardMotion.distance<result.schemesWidth*.9 ||
  result.schemeBackMotion.outgoingX<=0 ||
  result.schemeBackMotion.incomingX>=0 ||
  result.schemeBackMotion.distance<result.schemesWidth*.9 ||
  result.schemeForwardInComputed==='none' ||
  result.schemeBackInComputed==='none' ||
  result.rapidFilterFinal!=='favorites' ||
  !result.emptyFavoritesStable ||
  result.schemeFilterBusyFinal ||
  result.uiOperationFinal!=='idle' ||
  hasOpacityFrame(result.pageMid.incomingFrames) ||
  hasOpacityFrame(result.canvasMid.incomingFrames) ||
  result.settleMode!=="direct-embed" ||
  result.settleTransforms.length!==0 ||
  !result.settleProxyRemoved ||
  !result.actualDragMoved ||
  !result.stripeDomPreserved ||
  !result.stripeIndicesAligned ||
  result.stripeDropDomCommit!=="in-place" ||
  !result.layoutSuppressed ||
  !result.reducedMotionForcedOff ||
  (result.errors||[]).length
){
  throw new Error(`Unexpected transition/drag result: ${JSON.stringify(result)}`);
}
