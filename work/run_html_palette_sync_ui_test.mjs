import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const execFileAsync=promisify(execFile);
const [sourceHtml]=process.argv.slice(2);
if(!sourceHtml)throw new Error("Expected source HTML path");

const html=await fs.readFile(sourceHtml,"utf8");
const testHtmlPath=new URL("./palette_sync_ui_test.html",import.meta.url);

const injection=String.raw`
window.addEventListener('load',async()=>{
  const useRealAnimation=${JSON.stringify(process.env.REAL_ANIMATION==='1')};
  const errors=[];
  window.addEventListener('error',e=>errors.push(String(e.error||e.message)));
  window.addEventListener('unhandledrejection',e=>errors.push(String(e.reason)));
  const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  const animationLog=[];
  const nativeAnimate=Element.prototype.animate;

  try{
    for(let i=0;i<100 && !durableVaultReady;i++)await wait(20);
    colorLibrary=[
      {id:'ID_C1',type:'solid',name:'颜色1',hex:'#111111'},
      {id:'ID_C2',type:'solid',name:'颜色2',hex:'#777777'},
      {id:'ID_C3',type:'solid',name:'颜色3',hex:'#EEEEEE'}
    ];
    localStorage.setItem(PALETTE_KEY,JSON.stringify([
      {id:'pal_test',name:'测试色板',colors:['ID_C1','ID_C2','ID_C3'],savedAt:1}
    ]));
    state.paletteName='测试色板';
    state.activeSavedPaletteId='pal_test';
    state.palette=['ID_C1','ID_C2','ID_C3'];
    renderAll();
    await wait(60);

    const mainButtons=[...document.querySelectorAll('.palette-actions button')]
      .filter(button=>getComputedStyle(button).display!=='none');

    $('#savedPaletteTrigger').click();
    await wait(30);
    const customMenuOpen=$('#savedPalettePicker').classList.contains('open');
    const nativeSelectHidden=getComputedStyle($('#savedPalettes')).pointerEvents==='none';
    const customMenuRect=$('#savedPaletteMenu').getBoundingClientRect();
    const customMenuRows=document.querySelectorAll('#savedPaletteMenu .saved-palette-option-row').length;

    state.palette=['ID_C3','ID_C1','ID_C2'];
    const forwardChanged=syncActiveSavedPaletteFromCurrent();
    const forwardOrder=savedPalettes()[0].colors.join('|');

    const reverseList=savedPalettes();
    reverseList[0].colors=['ID_C2','ID_C3','ID_C1'];
    writeSavedPalettes(reverseList);
    $('#savedPalettes').value='';
    const reverseChanged=syncCurrentPaletteFromSavedMutation(
      reverseList,
      new Set([0]),
      ''
    );
    const reverseOrder=state.palette.join('|');

    renderPalette();
    syncInterfaceMotionBaseline();
    animationLog.length=0;
    Element.prototype.animate=function(frames,options){
      animationLog.push({element:this,frames:Array.isArray(frames)?frames:[]});
      if(useRealAnimation)return nativeAnimate.call(this,frames,options);
      let finishHandler=null;
      const animation={
        finished:Promise.resolve(),
        cancel(){},
        get onfinish(){return finishHandler},
        set onfinish(handler){
          finishHandler=handler;
          if(typeof handler==='function')queueMicrotask(handler);
        }
      };
      return animation;
    };
    const serialBefore=Number(document.body.dataset.motionSerial||0);
    const grip=$('#paletteGrid .palette-drag-grip');
    const r=grip.getBoundingClientRect();

    grip.onpointerdown({
      button:0,
      pointerId:81,
      clientX:r.left+r.width/2,
      clientY:r.top+r.height/2,
      currentTarget:grip,
      preventDefault(){},
      stopPropagation(){}
    });

    pendingPaletteDrop={insertAt:2};
    movePlaceholderTo(2);
    const committed=await commitPalettePendingDrop();
    await wait(30);
    Element.prototype.animate=nativeAnimate;

    const opacityOnPaletteCard=animationLog.some(entry=>
      entry.element?.classList?.contains('swatch') &&
      entry.frames.some(frame=>frame.opacity!==undefined && Number(frame.opacity)<.999)
    );

    const postCommitAnimations=$('#paletteGrid').getAnimations({subtree:true}).length;
    const serialAfter=Number(document.body.dataset.motionSerial||0);
    const commitOrder=state.palette.join('|');
    const savedCommitOrder=savedPalettes()[0].colors.join('|');

    await createBlankPalette();
    await wait(30);

    const result={
      mainButtonCount:mainButtons.length,
      mainButtonId:mainButtons[0]?.id||'',
      customMenuOpen,
      nativeSelectHidden,
      customMenuHeight:customMenuRect.height,
      customMenuRows,
      forwardChanged,
      forwardOrder,
      reverseChanged,
      reverseOrder,
      committed,
      commitOrder,
      savedCommitOrder,
      opacityOnPaletteCard,
      postCommitAnimations,
      serialBefore,
      serialAfter,
      savedCountAfterBlank:savedPalettes().length,
      blankPaletteLength:state.palette.length,
      blankActive:!!state.activeSavedPaletteId,
      errors
    };

    document.body.textContent='__CODEX_PALETTE_SYNC_UI_RESULT__'+JSON.stringify(result);
  }catch(error){
    document.body.textContent='__CODEX_PALETTE_SYNC_UI_RESULT__'+JSON.stringify({
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
  runner,fileURLToPath(testHtmlPath),"__CODEX_PALETTE_SYNC_UI_RESULT__","20000"
],{maxBuffer:24*1024*1024,windowsHide:true});

const marker="__CODEX_PALETTE_SYNC_UI_RESULT__";
const start=stdout.lastIndexOf(marker);
if(start<0)throw new Error(`Browser result missing. ${stderr.slice(0,1000)}`);
const tail=stdout.slice(start+marker.length);
const end=tail.indexOf("</body>");
if(end<0)throw new Error("Browser result terminator missing");

const result=JSON.parse(tail.slice(0,end).trim());
if(result.error)throw new Error(result.error);
console.log(JSON.stringify(result));

if(
  result.mainButtonCount!==1 ||
  result.mainButtonId!=="newBlankPaletteBtn" ||
  !result.customMenuOpen ||
  !result.nativeSelectHidden ||
  result.customMenuHeight<60 ||
  result.customMenuRows!==2 ||
  !result.forwardChanged ||
  result.forwardOrder!=="ID_C3|ID_C1|ID_C2" ||
  !result.reverseChanged ||
  result.reverseOrder!=="ID_C2|ID_C3|ID_C1" ||
  !result.committed ||
  result.commitOrder!=="ID_C3|ID_C1|ID_C2" ||
  result.savedCommitOrder!==result.commitOrder ||
  result.opacityOnPaletteCard ||
  result.postCommitAnimations!==0 ||
  result.serialAfter!==result.serialBefore ||
  result.savedCountAfterBlank!==2 ||
  result.blankPaletteLength!==0 ||
  !result.blankActive ||
  (result.errors||[]).length
){
  throw new Error(`Unexpected result: ${JSON.stringify(result)}`);
}
