import fs from "node:fs/promises";

const [sourceHtml,outputHtml]=process.argv.slice(2);
if(!sourceHtml||!outputHtml)throw new Error("Expected source and output paths");
const html=await fs.readFile(sourceHtml,"utf8");
const injection=`
window.addEventListener('load',()=>{
  setTimeout(()=>{
    const scroller=document.querySelector('.rightbar-palette-scroll');
    if(scroller)scroller.scrollTop=scroller.scrollHeight;
    document.querySelector('#savedPaletteTrigger')?.click();
  },850);
});
`;
const closurePattern=/\n\}\)\(\);\s*\n\s*<\/script>\s*\n<\/body>/i;
if(!closurePattern.test(html))throw new Error("Could not locate app closure");
await fs.writeFile(
  outputHtml,
  html.replace(closurePattern,`${injection}\n})();\n\n</script>\n</body>`),
  "utf8"
);
