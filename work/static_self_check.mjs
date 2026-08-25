import fs from "node:fs";

const [htmlPath] = process.argv.slice(2);
if (!htmlPath) throw new Error("Expected HTML path");

const source = fs.readFileSync(htmlPath,"utf8");
const ids = [...source.matchAll(/\bid="([^"]+)"/g)]
  .map(match=>match[1])
  .filter(id=>!id.includes("${"));
const duplicateIds = [...new Set(ids.filter((id,index)=>ids.indexOf(id)!==index))];
const boundIds = [...source.matchAll(/\$\('#([^']+)'\)\.(?:onclick|onchange|oninput|onblur|onfocus|onkeydown|onpointerdown)\s*=/g)]
  .map(match=>match[1]);
const missingDirectBindingIds = [...new Set(boundIds.filter(id=>!ids.includes(id)))];

let inlineScriptsChecked=0;
for (const match of source.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi)) {
  new Function(match[1]);
  inlineScriptsChecked+=1;
}

const result={
  staticIds:ids.length,
  duplicateIds,
  directBindings:[...new Set(boundIds)].length,
  missingDirectBindingIds,
  inlineScriptsChecked
};

console.log(JSON.stringify(result));
if(duplicateIds.length || missingDirectBindingIds.length)process.exit(1);
