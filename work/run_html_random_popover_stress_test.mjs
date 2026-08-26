import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync=promisify(execFile);
const [sourceHtml]=process.argv.slice(2);
if(!sourceHtml)throw new Error('Expected source HTML path');

const html=await fs.readFile(sourceHtml,'utf8');
const testPath=path.resolve('work/browser_random_popover_stress_test.html');
const injection=`
window.addEventListener('load',async()=>{
  const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  const errors=[];
  window.addEventListener('error',e=>errors.push(e.error?.stack||e.message||String(e)));
  window.addEventListener('unhandledrejection',e=>errors.push(e.reason?.stack||String(e.reason)));

  const physicalClick=element=>{
    element.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,pointerId:1,pointerType:'mouse'}));
    element.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,pointerId:1,pointerType:'mouse'}));
    element.dispatchEvent(new MouseEvent('click',{bubbles:true,button:0}));
  };

  try{
    for(let i=0;i<40 && !durableVaultReady;i++)await wait(50);
    await wait(160);

    const randomButton=$('#randomStripeOptionsBtn');
    const templateButton=$('#stripeTemplateBtn');
    const randomPanel=$('#randomStripeOptionsPanel');
    const templatePanel=$('#stripeTemplatePanel');
    let reopenFailures=0;
    let visualFailures=0;

    // 重复制造“刚开始关闭又立刻重开”的竞态，正是用户看到回闪的路径。
    for(let i=0;i<40;i++){
      physicalClick(randomButton);
      await wait(3);
      document.body.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,pointerId:2,pointerType:'mouse'}));
      await wait(3);
      physicalClick(randomButton);
      // 等到打开动画真正结束，再检查最终样式；旧测试只检查了动画中途，
      // 因此漏掉了关闭动画 fill:both 残留造成的最终透明状态。
      await wait(270);

      if(
        randomPanel.classList.contains('hidden') ||
        randomPanel.dataset.motionPhase==='closing' ||
        randomButton.getAttribute('aria-expanded')!=='true'
      )reopenFailures++;

      const visual=getComputedStyle(randomPanel);
      const rect=randomPanel.getBoundingClientRect();
      if(
        Number(visual.opacity)<.99 ||
        visual.visibility!=='visible' ||
        visual.display==='none' ||
        visual.pointerEvents==='none' ||
        rect.width<100 || rect.height<100
      )visualFailures++;

      await closeStripeToolPanel(randomPanel);
    }

    // 快速在两个工具之间切换，检查异步退场不会把后来打开的面板误关掉。
    for(let i=0;i<80;i++){
      physicalClick(randomButton);
      await wait(2);
      physicalClick(templateButton);
      await wait(2);
    }
    await closeStripeToolPanels();
    await wait(280);

    // 随机搭配连续运行，验证条纹结构不会产生空段、零路或运行时错误。
    const originalTotal=totalLanes();
    $('#randomKeepTotal').checked=true;
    saveRandomStripeSettings();
    for(let i=0;i<120;i++)randomizeStripeCombination();
    await wait(320);

    const invalidStripes=state.stripes.filter(stripe=>
      !Number.isFinite(Number(stripe?.lanes)) || Number(stripe.lanes)<1 || !state.roles[stripe.role]
    ).length;

    const result={
      recoveryCycles:40,
      rapidPanelSwitches:160,
      randomizeRuns:120,
      reopenFailures,
      visualFailures,
      randomPanelHidden:randomPanel.classList.contains('hidden'),
      templatePanelHidden:templatePanel.classList.contains('hidden'),
      randomExpanded:randomButton.getAttribute('aria-expanded'),
      templateExpanded:templateButton.getAttribute('aria-expanded'),
      originalTotal,
      finalTotal:totalLanes(),
      stripeCount:state.stripes.length,
      invalidStripes,
      errors
    };
    document.body.textContent='__RANDOM_POPOVER_STRESS__'+JSON.stringify(result);
  }catch(error){
    document.body.textContent='__RANDOM_POPOVER_STRESS__'+JSON.stringify({
      error:error?.stack||String(error),errors
    });
  }
});
`;

const closurePattern=/\n\}\)\(\);\s*\n\s*<\/script>\s*\n<\/body>/i;
if(!closurePattern.test(html))throw new Error('Could not locate app closure');
await fs.writeFile(
  testPath,
  html.replace(closurePattern,`${injection}\n})();\n\n</script>\n</body>`),
  'utf8'
);

const electron=path.resolve('node_modules/electron/dist/electron.exe');
const electronRunner=path.resolve('work/electron_dump_dom.cjs');
const {stdout,stderr}=await execFileAsync(electron,[
  electronRunner,testPath,'__RANDOM_POPOVER_STRESS__','50000'
],{maxBuffer:30*1024*1024,windowsHide:true});

const marker='__RANDOM_POPOVER_STRESS__';
const start=stdout.lastIndexOf(marker);
if(start<0)throw new Error(`Missing stress result: ${stderr.slice(0,800)}`);
const tail=stdout.slice(start+marker.length);
const end=tail.indexOf('</body>');
if(end<0)throw new Error('Missing result terminator');
const result=JSON.parse(tail.slice(0,end).trim());
console.log(JSON.stringify(result));
if(result.error)throw new Error(result.error);
if(
  result.reopenFailures!==0 ||
  result.visualFailures!==0 ||
  !result.randomPanelHidden || !result.templatePanelHidden ||
  result.randomExpanded!=='false' || result.templateExpanded!=='false' ||
  result.finalTotal!==result.originalTotal ||
  result.invalidStripes!==0 || result.stripeCount<1 ||
  result.errors.length
){
  throw new Error(`Unexpected stress result: ${JSON.stringify(result)}`);
}
