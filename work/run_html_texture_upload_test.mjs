import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const execFileAsync=promisify(execFile);
const [sourceHtml]=process.argv.slice(2);
if(!sourceHtml)throw new Error("Expected source HTML path");

const html=await fs.readFile(sourceHtml,"utf8");
const testHtmlPath=new URL("./texture_upload_test.html",import.meta.url);
const injection=String.raw`
window.addEventListener('load',async()=>{
  const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  const errors=[];
  window.addEventListener('error',e=>errors.push(String(e.error||e.message)));
  window.addEventListener('unhandledrejection',e=>errors.push(String(e.reason)));
  const canvasFile=(width,height,name)=>new Promise((resolve,reject)=>{
    const canvas=document.createElement('canvas');
    canvas.width=width;
    canvas.height=height;
    const context=canvas.getContext('2d');
    const image=context.createImageData(width,height);
    let seed=712367;
    for(let i=0;i<image.data.length;i+=4){
      seed=(seed*1664525+1013904223)>>>0;
      image.data[i]=(seed>>>16)&255;
      image.data[i+1]=(seed>>>8)&255;
      image.data[i+2]=seed&255;
      image.data[i+3]=255;
    }
    context.putImageData(image,0,0);
    canvas.toBlob(blob=>{
      if(!blob)return reject(new Error('PNG fixture failed'));
      resolve(new File([blob],name,{type:'image/png'}));
    },'image/png');
  });

  try{
    for(let i=0;i<50 && !durableVaultReady;i++)await wait(50);
    await wait(100);
    const originalCount=colorLibrary.length;
    const file=await canvasFile(1100,900,'细麻花灰.png');
    const dropData=new DataTransfer();
    dropData.items.add(file);
    const button=document.querySelector('#addTextureBtn');
    button.dispatchEvent(new DragEvent('dragover',{
      bubbles:true,cancelable:true,dataTransfer:dropData
    }));
    const dragHighlighted=button.classList.contains('is-dragover');
    button.dispatchEvent(new DragEvent('drop',{
      bubbles:true,cancelable:true,dataTransfer:dropData
    }));
    await wait(80);
    const dialog=document.querySelector('#textureNameDialogBackdrop');
    const dialogOpened=!dialog.classList.contains('hidden') &&
      dialog.getAttribute('aria-hidden')==='false';
    const proposedName=document.querySelector('#textureNameDialogInput').value;
    document.querySelector('#textureNameDialogInput').value='细麻花灰测试';
    await confirmTextureToLibrary();
    for(let i=0;i<80 && !colorLibrary.some(x=>x.name==='细麻花灰测试');i++)await wait(50);
    const item=colorLibrary.find(x=>x.name==='细麻花灰测试');
    const row=item
      ? document.querySelector('.library-resource-row[data-id="'+item.id+'"]')
      : null;
    const slots=await readDurableVaultSlots();
    const stored=slots.current?.data?.colorLibrary?.find(x=>x.id===item?.id);
    const bundle=buildFixedAssetBundle();
    const exported=bundle.assets?.colorLibrary?.find(x=>x.id===item?.id);

    const svg=new File(['<svg xmlns="http://www.w3.org/2000/svg"></svg>'],
      'unsafe.svg',{type:'image/svg+xml'});
    const rejectedSvg=openTextureNameDialog(svg)===false;

    const result={
      originalCount,
      fileBytes:file.size,
      dragHighlighted,
      dialogOpened,
      proposedName,
      dialogClosed:dialog.classList.contains('hidden'),
      itemAdded:!!item,
      id:item?.id||'',
      type:item?.type||'',
      dataPrefix:String(item?.image||'').slice(0,22),
      storedBytes:item?.image ? Math.round(item.image.length*.75) : 0,
      optimizedWidth:item?.sourceWidth||0,
      rowVisible:!!row,
      durableStored:!!stored?.image,
      exportStored:!!exported?.image,
      rejectedSvg,
      errors
    };
    document.body.textContent='__TEXTURE_UPLOAD_RESULT__'+JSON.stringify(result);
  }catch(error){
    document.body.textContent='__TEXTURE_UPLOAD_RESULT__'+JSON.stringify({
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
  runner,fileURLToPath(testHtmlPath),"__TEXTURE_UPLOAD_RESULT__","40000"
],{maxBuffer:32*1024*1024,windowsHide:true});
const marker="__TEXTURE_UPLOAD_RESULT__";
const start=stdout.lastIndexOf(marker);
if(start<0)throw new Error(`Electron result missing: ${stderr.slice(0,1000)}`);
const tail=stdout.slice(start+marker.length);
const end=tail.indexOf("</body>");
if(end<0)throw new Error("Electron result terminator missing");
const result=JSON.parse(tail.slice(0,end).trim());
if(result.error)throw new Error(result.error);
console.log(JSON.stringify(result));
if(
  !result.dragHighlighted ||
  !result.dialogOpened ||
  result.proposedName!=="细麻花灰" ||
  !result.dialogClosed ||
  !result.itemAdded ||
  !/^T/i.test(result.id) ||
  result.type!=="texture" ||
  !/^data:image\//.test(result.dataPrefix) ||
  result.storedBytes>900*1024 ||
  !result.rowVisible ||
  !result.durableStored ||
  !result.exportStored ||
  !result.rejectedSvg ||
  (result.errors||[]).length
){
  throw new Error(`Unexpected texture upload result: ${JSON.stringify(result)}`);
}
