import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const execFileAsync=promisify(execFile);
const [sourceHtml,outputPng]=process.argv.slice(2);
if(!sourceHtml || !outputPng)throw new Error("Expected source HTML and output PNG");

const html=await fs.readFile(sourceHtml,"utf8");
const previewHtmlPath=new URL("./copy_card_preview.html",import.meta.url);

const injection=`
window.addEventListener('load',()=>{
  const mappings=[
    {A:'#1F2937',B:'#F5F0E6',C:'#8FA8D8',D:'#D8E8E4'},
    {A:'#202838',B:'#F8E8E8',C:'#A7956D',D:'#D7ECE6'},
    {A:'#3A3026',B:'#EEEBDD',C:'#4064A0',D:'#D9AFB2'},
    {A:'#202637',B:'#E8F0F2',C:'#687078',D:'#B56B34'},
    {A:'#3A3935',B:'#E8E4DD',C:'#88802B',D:'#B8DF38'},
    {A:'#171919',B:'#FFF5DD',C:'#98662D',D:'#F19A48'}
  ];
  state.stripes=[
    {lanes:2,role:'D'},{lanes:8,role:'A'},{lanes:3,role:'B'},
    {lanes:1,role:'A'},{lanes:7,role:'C'},{lanes:1,role:'A'},
    {lanes:4,role:'B'},{lanes:8,role:'A'},{lanes:2,role:'B'}
  ];
  state.roles={
    A:{color:'#1F2937',name:'深海黑'},B:{color:'#F5F0E6',name:'暖米白'},
    C:{color:'#8FA8D8',name:'雾蓝'},D:{color:'#D8E8E4',name:'薄荷灰'}
  };
  state.name='秋冬针织系列';
  ensureStripeSortIds();
  state.favorites=mappings.map((mapping,index)=>captureFavoriteEntry(mapping,'preview-'+index));
  currentCanvasPage='favorites';
  const data=buildCurrentDisplayExportSvg();
  document.documentElement.style.background='#fff';
  document.body.style.margin='0';
  document.body.style.width=data.width+'px';
  document.body.style.height=data.height+'px';
  document.body.innerHTML=data.svg;
});
`;

const closurePattern=/\n\}\)\(\);\s*\n\s*<\/script>\s*\n<\/body>/i;
if(!closurePattern.test(html))throw new Error("Could not locate app closure");
await fs.writeFile(
  previewHtmlPath,
  html.replace(closurePattern,`${injection}\n})();\n\n</script>\n</body>`),
  "utf8"
);

const electron=path.resolve("node_modules/electron/dist/electron.exe");
const screenshotRunner=path.resolve("work/electron_screenshot.cjs");
const resolvedOutput=path.resolve(outputPng);
await execFileAsync(electron,[
  screenshotRunner,
  fileURLToPath(previewHtmlPath),
  resolvedOutput,
  "1800",
  "1540"
],{windowsHide:true,maxBuffer:8*1024*1024});

console.log(resolvedOutput);
