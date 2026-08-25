import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync=promisify(execFile);
const [sourceHtml,outputPng]=process.argv.slice(2);
if(!sourceHtml||!outputPng)throw new Error('Expected source.html output.png');

const html=await fs.readFile(sourceHtml,'utf8');
const previewHtml=path.resolve('work/random_popover_visual_preview.html');
const injection=`
window.addEventListener('load',async()=>{
  const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  for(let i=0;i<40 && !durableVaultReady;i++)await wait(50);
  await wait(500);
  const button=$('#randomStripeOptionsBtn');
  button.scrollIntoView({block:'center'});
  await wait(80);
  button.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,pointerId:1,pointerType:'mouse'}));
  button.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,pointerId:1,pointerType:'mouse'}));
  button.dispatchEvent(new MouseEvent('click',{bubbles:true,button:0}));
  await wait(380);
});
`;
const closurePattern=/\n\}\)\(\);\s*\n\s*<\/script>\s*\n<\/body>/i;
if(!closurePattern.test(html))throw new Error('Could not locate app closure');
await fs.writeFile(
  previewHtml,
  html.replace(closurePattern,`${injection}\n})();\n\n</script>\n</body>`),
  'utf8'
);

const profile=await fs.mkdtemp(path.resolve('work/edge-popover-preview-'));
const edge='C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
await execFileAsync(edge,[
  '--headless=new','--disable-gpu','--disable-extensions','--allow-file-access-from-files',
  `--user-data-dir=${profile}`,'--window-size=1708,958','--force-device-scale-factor=1',
  '--virtual-time-budget=2600',`--screenshot=${path.resolve(outputPng)}`,previewHtml
],{maxBuffer:8*1024*1024,windowsHide:true});

console.log(path.resolve(outputPng));
