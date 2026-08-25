import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const execFileAsync=promisify(execFile);
const [sourceHtml]=process.argv.slice(2);
if(!sourceHtml)throw new Error("Expected source HTML path");

const html=await fs.readFile(sourceHtml,"utf8");
const here=path.dirname(fileURLToPath(import.meta.url));
const closurePattern=/\n\}\)\(\);\s*\n\s*<\/script>\s*\n<\/body>/i;
if(!closurePattern.test(html))throw new Error("Could not locate app closure");

const makeApp=async(name,injection)=>{
  const file=path.join(here,name);
  await fs.writeFile(
    file,
    html.replace(closurePattern,`${injection}\n})();\n\n</script>\n</body>`),
    "utf8"
  );
  return file;
};

const writer=await makeApp("durable-version-a.html",`
window.addEventListener('load',async()=>{
  const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  try{
    for(let i=0;i<40 && !durableVaultReady;i++)await wait(50);
    await wait(120);
    state.name='新版保险存档';
    state.stripes=[{lanes:9,role:'A'},{lanes:4,role:'B'}];
    state.roles={
      A:{color:'#123456',fillId:'C991',locked:false,name:'36/2兔毛深蓝'},
      B:{color:'#EADFC8',fillId:'C992',locked:false,name:'36/2兔毛米色'}
    };
    colorLibrary=[
      {id:'C991',type:'solid',name:'36/2兔毛深蓝',hex:'#123456'},
      {id:'C992',type:'solid',name:'36/2兔毛米色',hex:'#EADFC8'}
    ];
    state.paletteName='36/2兔毛';
    state.palette=['C991','C992'];
    state.favorites=[captureFavoriteEntry(state.roles,'canvas')];
    writeSavedPalettes([{
      id:'pal_rabbit',name:'36/2兔毛',colors:['C991','C992'],savedAt:Date.now()
    }]);
    writeStripeTemplates([{
      name:'兔毛结构',lanes:[9,4],savedAt:Date.now()
    }]);
    localStorage.setItem(RANDOM_STRIPE_SETTINGS_KEY,JSON.stringify({mode:'width',minLane:2,maxLane:12}));
    saveColorLibrary();
    renderAll();
    await wait(260);
    await saveDurableVaultNow('durable-test-writer',true);
    await wait(180);
    const slots=await readDurableVaultSlots();
    document.body.textContent='__DURABLE_WRITER__'+JSON.stringify({
      db:!!slots.db,
      current:!!slots.current,
      backup1:!!slots.backup1,
      project:state.name,
      favorites:state.favorites.length,
      palettes:savedPalettes().length,
      library:colorLibrary.length
    });
  }catch(error){
    document.body.textContent='__DURABLE_WRITER__'+JSON.stringify({error:error?.stack||String(error)});
  }
});
`);

const legacyDir=path.join(here,"legacy-version");
await fs.mkdir(legacyDir,{recursive:true});
const legacy=path.join(legacyDir,"stripe-studio-old-version.html");
await fs.writeFile(legacy,`<!doctype html><meta charset="utf-8"><body>pending<script>
try{
  const project=JSON.parse(localStorage.getItem('stripeStudioProjectV1')||'{}');
  const library=JSON.parse(localStorage.getItem('stripeStudioColorLibraryV1')||'[]');
  const palettes=JSON.parse(localStorage.getItem('stripeStudioPalettesV1')||'[]');
  const templates=JSON.parse(localStorage.getItem('stripeStudioStructureTemplatesV1')||'[]');
  project.name='旧版修改后仍保留';
  if(library[0])library[0].name='旧版改名也能同步';
  palettes.push({name:'旧版新增色板',colors:['C991'],savedAt:Date.now()});
  templates.push({name:'旧版新增结构',lanes:[3,6,3],savedAt:Date.now()});
  localStorage.setItem('stripeStudioProjectV1',JSON.stringify(project));
  localStorage.setItem('stripeStudioColorLibraryV1',JSON.stringify(library));
  localStorage.setItem('stripeStudioPalettesV1',JSON.stringify(palettes));
  localStorage.setItem('stripeStudioStructureTemplatesV1',JSON.stringify(templates));
  document.body.textContent='__LEGACY_MUTATOR__'+JSON.stringify({ok:true});
}catch(error){
  document.body.textContent='__LEGACY_MUTATOR__'+JSON.stringify({error:String(error)});
}
</script>`,"utf8");

const readerInjection=`
window.addEventListener('load',async()=>{
  const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  try{
    for(let i=0;i<40 && !durableVaultReady;i++)await wait(50);
    await wait(520);
    const slots=await readDurableVaultSlots();
    const result={
      project:state.name,
      favoriteCount:state.favorites.length,
      libraryName:colorLibrary.find(x=>x.id==='C991')?.name||'',
      paletteNames:savedPalettes().map(x=>x.name),
      paletteIds:savedPalettes().map(x=>x.id),
      templateNames:stripeTemplates().map(x=>x.name),
      current:!!slots.current,
      backup1:!!slots.backup1,
      backup2:!!slots.backup2,
      db:!!slots.db,
      recoveryMessage:durableVaultRecoveryMessage
    };
    if(window.__CORRUPT_DURABLE_CURRENT__ && slots.db){
      await new Promise(resolve=>{
        const tx=slots.db.transaction(DURABLE_DB_STORE,'readwrite');
        tx.objectStore(DURABLE_DB_STORE).put({corrupt:true},'current');
        tx.oncomplete=resolve;
        tx.onerror=resolve;
        tx.onabort=resolve;
      });
      result.corrupted=true;
    }else if(window.__CORRUPT_DURABLE_CURRENT__){
      localStorage.setItem(
        'stripeStudioDurableVaultFallbackV1',
        JSON.stringify({corrupt:true})
      );
      result.corrupted=true;
    }
    document.body.textContent='__DURABLE_READER__'+JSON.stringify(result);
  }catch(error){
    document.body.textContent='__DURABLE_READER__'+JSON.stringify({error:error?.stack||String(error)});
  }
});
`;

const reader=await makeApp("durable-version-b.html",readerInjection.replace(
  "window.addEventListener('load'",
  "window.__CORRUPT_DURABLE_CURRENT__=true; window.addEventListener('load'"
));
const recovery=await makeApp("durable-version-c.html",readerInjection);

const edge="C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const profile=await fs.mkdtemp(path.join(here,"edge-durable-profile-"));
const run=async(file,marker)=>{
  const {stdout,stderr}=await execFileAsync(edge,[
    "--headless=new","--disable-gpu","--disable-extensions","--allow-file-access-from-files",
    `--user-data-dir=${profile}`,"--virtual-time-budget=12000","--dump-dom",file
  ],{maxBuffer:30*1024*1024,windowsHide:true});
  const start=stdout.lastIndexOf(marker);
  if(start<0)throw new Error(`Missing ${marker}: ${stderr.slice(0,800)}`);
  const tail=stdout.slice(start+marker.length);
  const end=tail.indexOf("</body>");
  if(end<0)throw new Error(`Missing terminator for ${marker}`);
  return JSON.parse(tail.slice(0,end).trim());
};

const wrote=await run(writer,"__DURABLE_WRITER__");
const mutated=await run(legacy,"__LEGACY_MUTATOR__");
const read=await run(reader,"__DURABLE_READER__");
const recovered=await run(recovery,"__DURABLE_READER__");
const result={wrote,mutated,read,recovered};
console.log(JSON.stringify(result));

for(const value of [wrote,mutated,read,recovered]){
  if(value.error)throw new Error(value.error);
}

if(
  !wrote.current ||
  wrote.project!=='新版保险存档' ||
  read.project!=='旧版修改后仍保留' ||
  read.libraryName!=='旧版改名也能同步' ||
  !read.paletteNames.includes('36/2兔毛') ||
  !read.paletteNames.includes('旧版新增色板') ||
  !read.paletteIds.every(Boolean) ||
  !read.templateNames.includes('兔毛结构') ||
  !read.templateNames.includes('旧版新增结构') ||
  read.favoriteCount!==1 ||
  recovered.project!=='旧版修改后仍保留' ||
  recovered.libraryName!=='旧版改名也能同步' ||
  !recovered.current ||
  !recovered.recoveryMessage
){
  throw new Error(`Unexpected durable result: ${JSON.stringify(result)}`);
}
