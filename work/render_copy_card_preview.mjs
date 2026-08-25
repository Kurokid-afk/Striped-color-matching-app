import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import { promisify } from "node:util";

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
    A:{color:'#1F2937',name:'A'},B:{color:'#F5F0E6',name:'B'},
    C:{color:'#8FA8D8',name:'C'},D:{color:'#D8E8E4',name:'D'}
  };
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

const edge="C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
await execFileAsync(edge,[
  "--headless=new",
  "--disable-gpu",
  "--disable-extensions",
  "--allow-file-access-from-files",
  "--hide-scrollbars",
  "--force-device-scale-factor=1",
  "--window-size=1800,1445",
  `--screenshot=${outputPng}`,
  previewHtmlPath.pathname.slice(1)
],{windowsHide:true,maxBuffer:8*1024*1024});

console.log(outputPng);
