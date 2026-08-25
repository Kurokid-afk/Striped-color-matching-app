import fs from "node:fs/promises";
import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";

const [actualPath,targetPath,outDir]=process.argv.slice(2);
if(!actualPath||!targetPath||!outDir){
  throw new Error("Expected actual.xlsx target.xlsx outputDir");
}

await fs.mkdir(outDir,{recursive:true});

const open=async filePath=>{
  const blob=await FileBlob.load(filePath);
  return SpreadsheetFile.importXlsx(blob);
};

const actual=await open(actualPath);
const target=await open(targetPath);
const sheetNames=["数格结果","仅配色文本"];
const comparisons=[];

for(const name of sheetNames){
  const actualSheet=actual.worksheets.getItem(name);
  const targetSheet=target.worksheets.getItem(name);
  const actualUsed=actualSheet.getUsedRange();
  const targetUsed=targetSheet.getUsedRange();
  const actualValues=actualUsed.values;
  const targetValues=targetUsed.values;
  const same=JSON.stringify(actualValues)===JSON.stringify(targetValues);

  comparisons.push({
    name,
    same,
    actualRows:actualValues.length,
    targetRows:targetValues.length,
    actualCols:Math.max(0,...actualValues.map(row=>row.length)),
    targetCols:Math.max(0,...targetValues.map(row=>row.length))
  });

  const preview=await actual.render({
    sheetName:name,
    autoCrop:"all",
    scale:1.25,
    format:"png"
  });
  await fs.writeFile(
    `${outDir}/${name}.png`,
    new Uint8Array(await preview.arrayBuffer())
  );
}

const summary=await actual.inspect({
  kind:"workbook,sheet,table",
  maxChars:4000,
  tableMaxRows:5,
  tableMaxCols:6,
  tableMaxCellChars:80
});

console.log(JSON.stringify({comparisons,summary:summary.ndjson}));

if(comparisons.some(item=>!item.same)){
  throw new Error(`Workbook mismatch: ${JSON.stringify(comparisons)}`);
}
