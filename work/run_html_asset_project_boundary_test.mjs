import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const [sourceHtml] = process.argv.slice(2);
if (!sourceHtml) throw new Error('Expected source HTML path');

const html = await fs.readFile(sourceHtml, 'utf8');
const testPath = path.resolve('work/browser_asset_project_boundary_test.html');
const injection = `
window.addEventListener('load',async()=>{
  const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  try{
    for(let i=0;i<40 && !durableVaultReady;i++)await wait(50);
    await wait(160);

    colorLibrary=[
      {id:'C_LOCAL',type:'solid',name:'本机颜色',hex:'#111111'}
    ];
    writeSavedPalettes([{
      id:'pal_local',name:'本机色板',colors:['C_LOCAL'],savedAt:1
    }],{touchAssets:false});
    state.palette=['C_LOCAL'];
    state.paletteName='本机色板';
    state.activeSavedPaletteId='pal_local';
    writeFixedAssetMeta({revision:5,updatedAt:5});
    saveColorLibrary({touchAssets:false});

    const payload=buildProjectExportPayload();
    const exportBoundary={
      version:payload.version,
      policy:payload.assetPolicy,
      hasTopLibrary:Object.prototype.hasOwnProperty.call(payload,'colorLibrary'),
      hasTopPalettes:Object.prototype.hasOwnProperty.call(payload,'savedPalettes'),
      hasProjectPalette:Object.prototype.hasOwnProperty.call(payload.project,'palette'),
      hasProjectPaletteName:Object.prototype.hasOwnProperty.call(payload.project,'paletteName'),
      hasProjectActiveId:Object.prototype.hasOwnProperty.call(payload.project,'activeSavedPaletteId')
    };

    const imported=await applyImportedProjectData({
      type:'stripe-studio-project',version:3,
      project:{
        ...projectStateForTransfer(state),
        name:'外来条纹项目',
        stripes:[{lanes:7,role:'A'}],
        palette:['C_BAD'],paletteName:'外来色板',activeSavedPaletteId:'pal_bad'
      },
      colorLibrary:[{id:'C_BAD',type:'solid',name:'不应覆盖',hex:'#FF0000'}],
      savedPalettes:[{id:'pal_bad',name:'不应覆盖色板',colors:['C_BAD']}]
    },{silent:true});

    const projectBoundary={
      name:state.name,
      lanes:state.stripes[0]?.lanes,
      localColor:colorLibrary.find(x=>x.id==='C_LOCAL')?.name||'',
      badColorExists:colorLibrary.some(x=>x.id==='C_BAD'),
      paletteName:state.paletteName,
      paletteRefs:[...(state.palette||[])],
      savedNames:savedPalettes().map(x=>x.name),
      ignored:imported.ignoredEmbeddedAssets
    };

    const merged=await applyFixedAssetBundleData({
      type:'stripe-studio-fixed-assets',version:2,assetRevision:5,
      assets:{
        colorLibrary:[
          {id:'C_LOCAL',type:'solid',name:'外来改名',hex:'#EEEEEE'},
          {id:'C_EXTRA',type:'solid',name:'补充颜色',hex:'#223344'}
        ],
        savedPalettes:[
          {id:'pal_local',name:'外来色板名',colors:['C_EXTRA','C_LOCAL']},
          {id:'pal_extra',name:'补充色板',colors:['C_EXTRA']}
        ]
      }
    },{silent:true});

    const mergeBoundary={
      mode:merged.mode,
      localName:colorLibrary.find(x=>x.id==='C_LOCAL')?.name||'',
      localHex:colorLibrary.find(x=>x.id==='C_LOCAL')?.hex||'',
      extraExists:colorLibrary.some(x=>x.id==='C_EXTRA'),
      localPalette:savedPalettes().find(x=>x.id==='pal_local'),
      extraPaletteExists:savedPalettes().some(x=>x.id==='pal_extra')
    };

    const replaced=await applyFixedAssetBundleData({
      type:'stripe-studio-fixed-assets',version:2,assetRevision:99,
      assets:{
        colorLibrary:[
          {id:'C_NEW',type:'solid',name:'新版颜色',hex:'#ABCDEF'}
        ],
        savedPalettes:[
          {id:'pal_new',name:'新版色板',colors:['C_NEW']}
        ]
      }
    },{silent:true});

    const replaceBoundary={
      mode:replaced.mode,
      revision:readFixedAssetMeta().revision,
      colorIds:colorLibrary.map(x=>x.id),
      paletteNames:savedPalettes().map(x=>x.name),
      currentPalette:[...(state.palette||[])],
      currentPaletteName:state.paletteName
    };

    document.body.textContent='__ASSET_PROJECT_BOUNDARY__'+JSON.stringify({
      exportBoundary,projectBoundary,mergeBoundary,replaceBoundary
    });
  }catch(error){
    document.body.textContent='__ASSET_PROJECT_BOUNDARY__'+JSON.stringify({
      error:error?.stack||String(error)
    });
  }
});
`;

const closurePattern = /\n\}\)\(\);\s*\n\s*<\/script>\s*\n<\/body>/i;
if (!closurePattern.test(html)) throw new Error('Could not locate app closure');
await fs.writeFile(
  testPath,
  html.replace(closurePattern, `${injection}\n})();\n\n</script>\n</body>`),
  'utf8'
);

const edge = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const { stdout, stderr } = await execFileAsync(edge, [
  '--headless=new','--disable-gpu','--disable-extensions',
  '--allow-file-access-from-files','--virtual-time-budget=16000',
  '--dump-dom',testPath
], { maxBuffer:30*1024*1024, windowsHide:true });

const marker='__ASSET_PROJECT_BOUNDARY__';
const start=stdout.lastIndexOf(marker);
if(start<0)throw new Error(`Missing result marker: ${stderr.slice(0,800)}`);
const tail=stdout.slice(start+marker.length);
const end=tail.indexOf('</body>');
if(end<0)throw new Error('Missing result terminator');
const result=JSON.parse(tail.slice(0,end).trim());
console.log(JSON.stringify(result));
if(result.error)throw new Error(result.error);

const e=result.exportBoundary;
const p=result.projectBoundary;
const m=result.mergeBoundary;
const r=result.replaceBoundary;

if(
  e.version!==4 || e.policy!=='external-fixed-assets' ||
  e.hasTopLibrary || e.hasTopPalettes || e.hasProjectPalette ||
  e.hasProjectPaletteName || e.hasProjectActiveId ||
  p.name!=='外来条纹项目' || p.lanes!==7 || p.localColor!=='本机颜色' ||
  p.badColorExists || p.paletteName!=='本机色板' ||
  JSON.stringify(p.paletteRefs)!==JSON.stringify(['C_LOCAL']) ||
  p.savedNames.join(',')!=='本机色板' || !p.ignored ||
  m.mode!=='merge' || m.localName!=='本机颜色' || m.localHex!=='#111111' ||
  !m.extraExists || m.localPalette?.name!=='本机色板' ||
  JSON.stringify(m.localPalette?.colors)!==JSON.stringify(['C_LOCAL']) ||
  !m.extraPaletteExists ||
  r.mode!=='replace' || r.revision!==99 ||
  JSON.stringify(r.colorIds)!==JSON.stringify(['C_NEW']) ||
  JSON.stringify(r.paletteNames)!==JSON.stringify(['新版色板']) ||
  JSON.stringify(r.currentPalette)!==JSON.stringify(['C_NEW']) ||
  r.currentPaletteName!=='新版色板'
){
  throw new Error(`Unexpected boundary result: ${JSON.stringify(result)}`);
}
