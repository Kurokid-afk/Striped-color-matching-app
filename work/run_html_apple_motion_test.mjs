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
  const waitUntil=async(test,timeout=1200)=>{
    const end=performance.now()+timeout;
    while(performance.now()<end){
      if(test())return true;
      await wait(20);
    }
    return false;
  };

  try {
    for(let i=0;i<60 && !durableVaultReady;i++)await wait(50);
    await wait(80);
    pendingRoleReplace=null;
    stripeSelection.clear();
    state.stripes=[
      {lanes:8,role:'A'},
      {lanes:4,role:'B'}
    ];
    state.roles={
      A:{color:'#17191C',locked:false,name:'深色'},
      B:{color:'#E8EBED',locked:false,name:'浅色'}
    };
    state.palette=['#17191C','#E8EBED','#7B5D4E'];
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

    stripeSelection.clear();
    updateStripeSelectionUI();
    const stripeCheckbox=$('.stripe-select[data-i="0"]');
    const stripeBadge=$('.stripe-item[data-i="0"] .idx');
    const stripeFill=stripeBadge.querySelector('.idx-selection-fill');
    const stripeBadgeBefore=getComputedStyle(stripeFill).clipPath;
    stripeCheckbox.checked=true;
    stripeCheckbox.dispatchEvent(new Event('change',{bubbles:true}));
    await wait(85);
    const selectedStripeBadge=$('.stripe-item[data-i="0"] .idx');
    const selectedStripeFill=selectedStripeBadge.querySelector('.idx-selection-fill');
    const stripeBadgeMid=getComputedStyle(selectedStripeFill).clipPath;
    const stripeBadgeFrames=(selectedStripeFill.getAnimations()||[])
      .flatMap(animation=>animation.effect?.getKeyframes?.()||[]);
    const stripeCheckboxHasScale=(stripeCheckbox.getAnimations()||[])
      .flatMap(animation=>animation.effect?.getKeyframes?.()||[])
      .some(frame=>String(frame.transform||'').includes('scale('));
    await wait(260);
    const stripeBadgeAfter=getComputedStyle(selectedStripeFill).clipPath;
    const selectedNumberColor=getComputedStyle(
      selectedStripeBadge.querySelector('.idx-number')
    ).color;
    const stripeBadgeConnectedAtSelection=selectedStripeBadge.isConnected;
    const selectionSetAfterFill=stripeSelection.has(0);

    const drainCheckbox=$('.stripe-select[data-i="0"]');
    drainCheckbox.checked=false;
    drainCheckbox.dispatchEvent(new Event('change',{bubbles:true}));
    await wait(45);
    const drainedFill=$('.stripe-item[data-i="0"] .idx-selection-fill');
    const stripeDrainFrames=(drainedFill.getAnimations()||[])
      .flatMap(animation=>animation.effect?.getKeyframes?.()||[]);
    const selectionClearedAfterDrain=!stripeSelection.has(0);

    beginRoleReplace('A');
    await wait(70);
    const replaceTargetBefore=$('#roles .role-item[data-role="A"]');
    const replaceFrame=replaceTargetBefore.querySelector('.role-replace-frame');
    const replaceFrameStyle=getComputedStyle(replaceFrame);
    const replaceFrameAnimationName=replaceFrameStyle.animationName;
    const replaceFrameAnimationIterations=replaceFrameStyle.animationIterationCount;
    const replaceFrameAnimations=(replaceFrame.getAnimations()||[])
      .flatMap(animation=>animation.effect?.getKeyframes?.()||[]);
    const replaceTargetHasScale=beginRoleReplace.toString().includes('scale(');

    delete document.body.dataset.roleFillMotion;
    const replacementApplied=applyPaletteRefToPendingRole('#7B5D4E');
    await waitUntil(()=>!!document.body.dataset.roleFillMotion);
    await wait(35);
    const replaceTargetAfter=$('#roles .role-item[data-role="A"]');
    const roleCardFrames=(replaceTargetAfter?.getAnimations()||[])
      .flatMap(animation=>animation.effect?.getKeyframes?.()||[]);
    const roleCardHasTransformMotion=roleCardFrames.some(
      frame=>String(frame.transform||'').trim() && String(frame.transform)!=='none'
    );
    const fillReveal=replaceTargetAfter?.querySelector('.role-fill-reveal-new');
    const fillRevealFrames=(fillReveal?.getAnimations()||[])
      .flatMap(animation=>animation.effect?.getKeyframes?.()||[]);
    const fillMotionMeta=JSON.parse(document.body.dataset.roleFillMotion||'{}');
    await waitUntil(()=>(
      !replaceTargetAfter?.querySelector('.role-fill-reveal-new')
    ),1000);
    const fillRevealCleaned=!replaceTargetAfter?.querySelector('.role-fill-reveal-new');

    renderPalette();
    await wait(30);
    const swapSwatch=$('#paletteGrid .swatch[data-index="1"]');
    const swapCandidateClass=swapSwatch?.classList.contains('role-replace-swap')||false;
    const swapCandidateEnabled=swapSwatch?.getAttribute('aria-disabled')!=='true';
    delete document.body.dataset.roleSwapMotion;
    const swapApplied=applyPaletteRefToPendingRole('#E8EBED');
    await waitUntil(()=>(
      !!$('#roles .role-item[data-role="A"] .role-fill-reveal-new') &&
      !!$('#roles .role-item[data-role="B"] .role-fill-reveal-new')
    ));
    const swapTargetA=$('#roles .role-item[data-role="A"]');
    const swapTargetB=$('#roles .role-item[data-role="B"]');
    const swapAHasFill=!!swapTargetA?.querySelector('.role-fill-reveal-new');
    const swapBHasFill=!!swapTargetB?.querySelector('.role-fill-reveal-new');
    const swapCardHasTransform=[swapTargetA,swapTargetB].some(card=>(card?.getAnimations()||[])
      .flatMap(animation=>animation.effect?.getKeyframes?.()||[])
      .some(frame=>String(frame.transform||'').trim() && String(frame.transform)!=='none'));
    const swapMeta=JSON.parse(document.body.dataset.roleSwapMotion||'{}');
    const swappedA=roleFillRef(state.roles.A);
    const swappedB=roleFillRef(state.roles.B);
    const usedFillKeys=usedRoleKeys().map(role=>fillVisualKey(roleFillRef(state.roles[role])));
    const swapKeptUnique=new Set(usedFillKeys).size===usedFillKeys.length;

    const textureId='T998';
    colorLibrary.push({
      id:textureId,type:'texture',name:'旧版重复纹理测试',
      image:'data:image/png;base64,iVBORw0KGgo=',brightness:50,scale:100
    });
    state.roles={
      A:{fillId:textureId,color:'#777777',name:'纹理一',locked:false},
      C:{fillId:textureId,color:'#777777',name:'纹理二',locked:false}
    };
    state.stripes=[
      {lanes:4,role:'A'},
      {lanes:3,role:'C'}
    ];
    ensureStripeSortIds();
    normalizeStateIntegrity();
    const legacyTextureDuplicateCollapsed=
      new Set(state.stripes.map(stripe=>stripe.role)).size===1 &&
      state.stripes.every(stripe=>stripe.role==='A');

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
      stripeSelectionMotion:{
        before:stripeBadgeBefore,
        mid:stripeBadgeMid,
        after:stripeBadgeAfter,
        frameCount:stripeBadgeFrames.length,
        frameClipPaths:stripeBadgeFrames.map(frame=>frame.clipPath||''),
        drainFrameClipPaths:stripeDrainFrames.map(frame=>frame.clipPath||''),
        fillDirection:document.body.dataset.stripeBadgeFillMotion,
        selectedNumberColor,
        checkboxHasScale:stripeCheckboxHasScale,
        selected:selectionSetAfterFill,
        clearedAfterDrain:selectionClearedAfterDrain,
        selectedRowClass:selectedStripeBadge.parentElement.className,
        badgeConnectedAtSelection:stripeBadgeConnectedAtSelection
      },
      roleReplaceMotion:{
        frameAnimationName:replaceFrameAnimationName,
        frameAnimationIterations:replaceFrameAnimationIterations,
        frameOpacityMotion:replaceFrameAnimations.some(frame=>frame.opacity!==undefined),
        targetHasScale:replaceTargetHasScale,
        roleCardHasTransformMotion,
        roleCardFrameTransforms:roleCardFrames.map(frame=>frame.transform||''),
        replacementApplied,
        fillRevealFrames,
        fillMotionMeta,
        fillRevealCleaned,
        pendingRoleReplace,
        resultingColor:state.roles.A.color
      },
      roleSwapMotion:{
        swapCandidateClass,
        swapCandidateEnabled,
        swapApplied,
        swapAHasFill,
        swapBHasFill,
        swapCardHasTransform,
        swapMeta,
        swappedA,
        swappedB,
        swapKeptUnique,
        legacyTextureDuplicateCollapsed
      },
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
  result.stripeSelectionMotion.frameCount<2 ||
  !result.stripeSelectionMotion.frameClipPaths.some(value=>String(value).includes('100%')) ||
  !result.stripeSelectionMotion.frameClipPaths.some(value=>String(value).includes('0px')) ||
  !result.stripeSelectionMotion.drainFrameClipPaths.some(value=>String(value).includes('0px')) ||
  !result.stripeSelectionMotion.drainFrameClipPaths.some(value=>String(value).includes('100%')) ||
  result.stripeSelectionMotion.checkboxHasScale ||
  !result.stripeSelectionMotion.selected ||
  !result.stripeSelectionMotion.clearedAfterDrain ||
  result.roleReplaceMotion.frameAnimationName!=='roleReplaceBorderBreath' ||
  result.roleReplaceMotion.frameAnimationIterations!=='infinite' ||
  !result.roleReplaceMotion.frameOpacityMotion ||
  result.roleReplaceMotion.targetHasScale ||
  result.roleReplaceMotion.roleCardHasTransformMotion ||
  !result.roleReplaceMotion.replacementApplied ||
  result.roleReplaceMotion.fillRevealFrames.length<2 ||
  !result.roleReplaceMotion.fillRevealFrames.some(frame=>String(frame.clipPath||'').includes('100%')) ||
  result.roleReplaceMotion.fillMotionMeta.direction!=='left-to-right' ||
  result.roleReplaceMotion.fillMotionMeta.duration!==320 ||
  !result.roleReplaceMotion.fillRevealCleaned ||
  result.roleReplaceMotion.pendingRoleReplace!=='A' ||
  !result.roleSwapMotion.swapCandidateClass ||
  !result.roleSwapMotion.swapCandidateEnabled ||
  !result.roleSwapMotion.swapApplied ||
  !result.roleSwapMotion.swapAHasFill ||
  !result.roleSwapMotion.swapBHasFill ||
  result.roleSwapMotion.swapCardHasTransform ||
  result.roleSwapMotion.swapMeta.mode!=='swap-used-fill' ||
  result.roleSwapMotion.swappedA!=='#E8EBED' ||
  result.roleSwapMotion.swappedB!=='#7B5D4E' ||
  !result.roleSwapMotion.swapKeptUnique ||
  !result.roleSwapMotion.legacyTextureDuplicateCollapsed ||
  (result.runtimeErrors||[]).length
) {
  throw new Error(`Unexpected result: ${JSON.stringify(result)}`);
}
