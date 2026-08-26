import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const execFileAsync=promisify(execFile);
const [sourceHtml]=process.argv.slice(2);
if(!sourceHtml)throw new Error("Expected source HTML path");

const html=await fs.readFile(sourceHtml,"utf8");
const testHtmlPath=new URL("./overlay_motion_test.html",import.meta.url);
const injection=`
setTimeout(async()=>{
  document.body.dataset.overlayMotionTest='started';
  const errors=[];
  window.addEventListener('error',e=>errors.push(String(e.error||e.message)));
  window.addEventListener('unhandledrejection',e=>errors.push(String(e.reason)));
  const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  const count=el=>el?.getAnimations({subtree:true}).length||0;

  try{
    for(let i=0;i<30 && !durableVaultReady;i++)await wait(50);
    document.body.dataset.overlayMotionTest='ready';

    openAdvancedColorPicker();
    await wait(24);
    const advancedBackdrop=$('#advancedColorPickerBackdrop');
    const advancedSurface=$('#advancedColorPicker');
    const advancedOpen={
      phase:advancedBackdrop.dataset.motionPhase,
      backdrop:count(advancedBackdrop),
      surface:count(advancedSurface),
      contents:count(advancedSurface)-count(advancedSurface,false)
    };
    const advancedClosePromise=closeAdvancedColorPicker(false);
    await wait(24);
    const advancedClosing={
      phase:advancedBackdrop.dataset.motionPhase,
      hidden:advancedBackdrop.classList.contains('hidden'),
      animations:count(advancedBackdrop)
    };
    await advancedClosePromise;
    const advancedClosed=advancedBackdrop.classList.contains('hidden');
    document.body.dataset.overlayMotionTest='advanced';

    openColorNameDialog('#7289A7');
    await wait(24);
    const nameBackdrop=$('#colorNameDialogBackdrop');
    const nameSurface=nameBackdrop.querySelector('.color-name-dialog');
    const nameOpen={
      phase:nameBackdrop.dataset.motionPhase,
      backdrop:count(nameBackdrop),
      surface:count(nameSurface)
    };
    const nameClosePromise=closeColorNameDialog();
    await wait(24);
    const nameClosing={
      phase:nameBackdrop.dataset.motionPhase,
      hidden:nameBackdrop.classList.contains('hidden'),
      animations:count(nameBackdrop)
    };
    await nameClosePromise;
    const nameClosed=nameBackdrop.classList.contains('hidden');
    document.body.dataset.overlayMotionTest='name';

    const tool=$('#randomStripeOptionsPanel');
    positionStripeToolPanel(tool,$('#randomStripeOptionsBtn'));
    await wait(24);
    const toolOpen={
      phase:tool.dataset.motionPhase,
      hidden:tool.classList.contains('hidden'),
      animations:count(tool)
    };
    const toolClosePromise=closeStripeToolPanels();
    await wait(24);
    const toolClosing={
      phase:tool.dataset.motionPhase,
      hidden:tool.classList.contains('hidden'),
      animations:count(tool)
    };
    await toolClosePromise;
    const toolClosed=tool.classList.contains('hidden');
    document.body.dataset.overlayMotionTest='tool';

    state.stripes=[{lanes:8,role:'A'},{lanes:5,role:'B'}];
    state.roles={
      A:{color:'#111111',locked:false,name:'深色'},
      B:{color:'#EEEEEE',locked:false,name:'浅色'}
    };
    renderAll();
    await wait(40);
    const roleButton=$('.stripe-role-picker');
    openStripeRolePopover(roleButton,0);
    await wait(90);
    const rolePop=stripeRolePopover;
    const roleOpen={
      show:rolePop?.classList.contains('show')||false,
      animations:count(rolePop)
    };
    const roleClosePromise=closeStripeRolePopover();
    await wait(24);
    const roleClosing={
      connected:rolePop?.isConnected||false,
      animations:count(rolePop)
    };
    await roleClosePromise;
    const roleClosed=!rolePop?.isConnected;
    document.body.dataset.overlayMotionTest='role';

    const search=$('#paletteLibrarySearch');
    if(!colorLibrary.length){
      colorLibrary=[{
        id:'C999',
        type:'solid',
        name:'测试蓝灰',
        hex:'#7289A7'
      }];
    }
    search.value='';
    search.focus();
    renderPaletteLibrarySearch();
    await wait(30);
    const results=$('#paletteLibraryResults');
    const searchOpen={
      show:results.classList.contains('show'),
      display:getComputedStyle(results).display,
      animations:count(results)
    };
    results.classList.remove('show');
    await wait(24);
    const searchClosing={
      display:getComputedStyle(results).display,
      animations:count(results)
    };
    await wait(340);
    const searchClosed={
      display:getComputedStyle(results).display,
      visibility:getComputedStyle(results).visibility,
      show:results.classList.contains('show')
    };

    const result={
      advancedOpen,advancedClosing,advancedClosed,
      nameOpen,nameClosing,nameClosed,
      toolOpen,toolClosing,toolClosed,
      roleOpen,roleClosing,roleClosed,
      searchOpen,searchClosing,searchClosed,
      errors
    };
    document.body.textContent='__CODEX_OVERLAY_MOTION_RESULT__'+JSON.stringify(result);
  }catch(error){
    document.body.textContent='__CODEX_OVERLAY_MOTION_RESULT__'+JSON.stringify({
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
  '__CODEX_OVERLAY_MOTION_RESULT__',
  '20000'
],{maxBuffer:24*1024*1024,windowsHide:true});

const marker="__CODEX_OVERLAY_MOTION_RESULT__";
const start=stdout.lastIndexOf(marker);
if(start<0)throw new Error(`Browser result missing. ${stderr.slice(0,1000)}`);
const tail=stdout.slice(start+marker.length);
const end=tail.indexOf("</body>");
if(end<0)throw new Error("Browser result terminator missing");
const result=JSON.parse(tail.slice(0,end).trim());
if(result.error)throw new Error(result.error);
console.log(JSON.stringify(result));

if(
  result.advancedOpen.backdrop<2 ||
  result.advancedOpen.surface<1 ||
  result.advancedClosing.phase!=="closing" ||
  result.advancedClosing.hidden ||
  result.advancedClosing.animations<2 ||
  !result.advancedClosed ||
  result.nameOpen.backdrop<2 ||
  result.nameClosing.phase!=="closing" ||
  result.nameClosing.hidden ||
  result.nameClosing.animations<2 ||
  !result.nameClosed ||
  result.toolOpen.hidden ||
  result.toolOpen.animations<2 ||
  result.toolClosing.phase!=="closing" ||
  result.toolClosing.hidden ||
  result.toolClosing.animations<1 ||
  !result.toolClosed ||
  !result.roleOpen.show ||
  result.roleOpen.animations<1 ||
  !result.roleClosing.connected ||
  result.roleClosing.animations<1 ||
  !result.roleClosed ||
  !result.searchOpen.show ||
  result.searchOpen.display==="none" ||
  result.searchOpen.animations<1 ||
  result.searchClosing.display==="none" ||
  result.searchClosing.animations<1 ||
  result.searchClosed.display==="none" ||
  result.searchClosed.show ||
  (result.errors||[]).length
){
  throw new Error(`Unexpected result: ${JSON.stringify(result)}`);
}
