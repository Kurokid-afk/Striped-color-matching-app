import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const execFileAsync=promisify(execFile);
const [sourceHtml]=process.argv.slice(2);
if(!sourceHtml)throw new Error("Expected source HTML path");

const html=await fs.readFile(sourceHtml,"utf8");
const testHtmlPath=new URL("./favorite_motion_test.html",import.meta.url);
const injection=`
window.addEventListener('load',async()=>{
  const errors=[];
  window.addEventListener('error',e=>errors.push(String(e.error||e.message)));
  window.addEventListener('unhandledrejection',e=>errors.push(String(e.reason)));
  const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  const animationCount=el=>el ? el.getAnimations({subtree:true}).length : 0;
  window.confirm=()=>true;

  try{
    for(let i=0;i<30 && !durableVaultReady;i++)await wait(50);

    state.stripes=[{lanes:8,role:'A'},{lanes:5,role:'B'}];
    state.roles={
      A:{color:'#111111',locked:false,name:'深色'},
      B:{color:'#EEEEEE',locked:false,name:'浅色'}
    };
    state.schemes=[
      {mapping:{A:'#C79A62',B:'#B56F74'}},
      {mapping:{A:'#345691',B:'#E8E2D8'}},
      {mapping:{A:'#7B5D4E',B:'#D4B0B5'}}
    ];
    state.favorites=[];
    state.schemeFilter='all';
    favoriteOverviewMode=false;
    currentCanvasPage='pattern';
    renderAll();
    await wait(80);

    state.schemeFilter='favorites';
    renderSchemes();
    await wait(80);

    const firstPromise=toggleFavorite(state.schemes[0].mapping);
    const firstKey=state.favorites[0]?.key||'';
    const firstCard=findSchemeCardByKey(firstKey,'favorite');
    const firstCardAnimations=animationCount(firstCard);
    const firstCountAnimations=animationCount(document.querySelector('#favoriteCount'));
    await wait(360);

    const secondPromise=toggleFavorite(state.schemes[1].mapping);
    const secondKey=state.favorites[1]?.key||'';
    const secondCard=findSchemeCardByKey(secondKey,'favorite');
    const secondCardAnimations=animationCount(secondCard);
    const firstReflowAnimations=animationCount(findSchemeCardByKey(firstKey,'favorite'));
    await wait(360);

    favoriteOverviewMode=true;
    currentCanvasPage='favorites';
    renderFavoriteCanvasOverview();
    await wait(120);

    const thirdPromise=toggleFavorite(state.schemes[2].mapping);
    const thirdKey=state.favorites[2]?.key||'';
    await wait(24);
    const thirdTile=document.querySelector('.favorite-tile[data-favorite-key="'+CSS.escape(thirdKey)+'"]');
    const thirdOverviewAnimations=animationCount(thirdTile);
    const existingOverviewAnimations=animationCount(
      document.querySelector('.favorite-tile[data-favorite-key="'+CSS.escape(firstKey)+'"]')
    );
    await wait(360);

    const originalDeleteAway=animateDeleteAway;
    const deleteCalls=[];
    animateDeleteAway=(elements,options)=>{
      const list=(Array.isArray(elements)?elements:[elements]).filter(Boolean);
      originalDeleteAway(elements,options);
      deleteCalls.push(list.reduce((sum,el)=>sum+animationCount(el),0));
      return Promise.resolve();
    };

    await removeFavoriteByKey(secondKey);
    const removeAnimations=deleteCalls.shift()||0;
    await wait(60);

    await clearAllFavorites();
    const clearAnimations=deleteCalls.shift()||0;
    animateDeleteAway=originalDeleteAway;
    await wait(80);

    const result={
      firstCardAnimations,
      firstCountAnimations,
      secondCardAnimations,
      firstReflowAnimations,
      thirdOverviewAnimations,
      existingOverviewAnimations,
      removeAnimations,
      clearAnimations,
      favoritesAfterClear:state.favorites.length,
      hasSchemeEmpty:!!document.querySelector('#schemes .scheme-empty-state'),
      hasOverviewEmpty:!!document.querySelector('#favoriteOverview .favorite-empty'),
      favoriteCountText:document.querySelector('#favoriteCount')?.textContent||'',
      errors
    };
    document.body.textContent='__CODEX_FAVORITE_MOTION_RESULT__'+JSON.stringify(result);
  }catch(error){
    document.body.textContent='__CODEX_FAVORITE_MOTION_RESULT__'+JSON.stringify({
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

const electron=path.resolve('node_modules/electron/dist/electron.exe');
const electronRunner=path.resolve('work/electron_dump_dom.cjs');
const {stdout,stderr}=await execFileAsync(electron,[
  electronRunner,
  fileURLToPath(testHtmlPath),
  '__CODEX_FAVORITE_MOTION_RESULT__',
  '20000'
],{maxBuffer:24*1024*1024,windowsHide:true});

const marker="__CODEX_FAVORITE_MOTION_RESULT__";
const start=stdout.lastIndexOf(marker);
if(start<0)throw new Error(`Browser result missing. ${stderr.slice(0,1000)}`);
const tail=stdout.slice(start+marker.length);
const end=tail.indexOf("</body>");
if(end<0)throw new Error("Browser result terminator missing");
const result=JSON.parse(tail.slice(0,end).trim());
if(result.error)throw new Error(result.error);
console.log(JSON.stringify(result));

if(
  result.firstCardAnimations<1 ||
  result.firstCountAnimations<1 ||
  result.secondCardAnimations<1 ||
  result.removeAnimations<1 ||
  result.clearAnimations<1 ||
  result.favoritesAfterClear!==0 ||
  !result.hasSchemeEmpty ||
  !result.hasOverviewEmpty ||
  !/收藏\s*0\s*套/.test(result.favoriteCountText) ||
  (result.errors||[]).length
){
  throw new Error(`Unexpected result: ${JSON.stringify(result)}`);
}
