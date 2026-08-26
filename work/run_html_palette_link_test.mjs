import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const execFileAsync=promisify(execFile);
const [sourceHtml]=process.argv.slice(2);
if(!sourceHtml)throw new Error("Expected source HTML path");
const html=await fs.readFile(sourceHtml,"utf8");
const testHtmlPath=new URL("./palette_link_test.html",import.meta.url);
const injection=`
window.addEventListener('load',async()=>{
  const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  const errors=[];
  window.addEventListener('error',e=>errors.push(String(e.error||e.message)));
  window.addEventListener('unhandledrejection',e=>errors.push(String(e.reason)));
  try{
    for(let i=0;i<40 && !durableVaultReady;i++)await wait(50);
    await wait(100);
    colorLibrary=[
      {id:'C023',type:'solid',name:'231深藏蓝',hex:'#2D2F3D'}
    ];
    state.paletteName='36/2兔毛';
    state.palette=['#2D2F3D','#AABBCC'];
    state.activeSavedPaletteId='';
    localStorage.setItem(PALETTE_KEY,'[]');
    saveColorLibrary();
    renderAll();

    await savePalette();
    await wait(120);
    const first=savedPalettes();
    const newResource=colorLibrary.find(x=>normalizeHex(x.hex)==='#AABBCC');

    await savePalette();
    await wait(80);
    const afterExact=savedPalettes();

    const extra={id:'C024',type:'solid',name:'新增米灰',hex:'#DDD3C5'};
    colorLibrary.push(extra);
    state.palette.push(extra.id);
    await savePalette();
    await wait(100);
    const afterSameName=savedPalettes();

    state.paletteName='第二色板';
    await savePalette();
    await wait(100);
    const afterNewName=savedPalettes();

    const firstIndex=afterNewName.findIndex(x=>x.name==='36/2兔毛');
    document.querySelector('#savedPalettes').value=String(firstIndex);
    await loadSelectedPalette();
    const loadedActive=state.activeSavedPaletteId;
    const loadedNames=state.palette.map(ref=>findFillById(ref)?.name||'');

    const libraryCountBeforeDelete=colorLibrary.length;
    document.querySelector('#savedPalettes').value=String(firstIndex);
    window.confirm=()=>true;
    await deleteSelectedPalette();
    await wait(120);

    const slots=await readDurableVaultSlots();
    const result={
      firstCount:first.length,
      firstRefs:first[0]?.colors||[],
      firstId:first[0]?.id||'',
      existingName:findFillById('C023')?.name||'',
      newName:newResource?.name||'',
      exactCount:afterExact.length,
      sameNameCount:afterSameName.length,
      sameNameColors:afterSameName[0]?.colors?.length||0,
      newNameCount:afterNewName.length,
      loadedActive,
      loadedNames,
      afterDeleteCount:savedPalettes().length,
      libraryPreserved:colorLibrary.length===libraryCountBeforeDelete,
      durableCurrent:!!slots.current,
      errors
    };
    document.body.textContent='__PALETTE_LINK_RESULT__'+JSON.stringify(result);
  }catch(error){
    document.body.textContent='__PALETTE_LINK_RESULT__'+JSON.stringify({
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
  runner,fileURLToPath(testHtmlPath),"__PALETTE_LINK_RESULT__","20000"
],{maxBuffer:24*1024*1024,windowsHide:true});
const marker="__PALETTE_LINK_RESULT__";
const start=stdout.lastIndexOf(marker);
if(start<0)throw new Error(`Browser result missing: ${stderr.slice(0,800)}`);
const tail=stdout.slice(start+marker.length);
const end=tail.indexOf("</body>");
if(end<0)throw new Error("Browser result terminator missing");
const result=JSON.parse(tail.slice(0,end).trim());
if(result.error)throw new Error(result.error);
console.log(JSON.stringify(result));
if(
  result.firstCount!==1 ||
  result.firstRefs[0]!=='C023' ||
  !/^C\d+$/i.test(result.firstRefs[1]||'') ||
  !result.firstId ||
  result.existingName!=='231深藏蓝' ||
  /^#[0-9A-F]{6}$/i.test(result.newName) ||
  result.exactCount!==1 ||
  result.sameNameCount!==1 ||
  result.sameNameColors!==3 ||
  result.newNameCount!==2 ||
  !result.loadedActive ||
  !result.loadedNames.includes('231深藏蓝') ||
  result.afterDeleteCount!==1 ||
  !result.libraryPreserved ||
  !result.durableCurrent ||
  (result.errors||[]).length
){
  throw new Error(`Unexpected palette result: ${JSON.stringify(result)}`);
}
