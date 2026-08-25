import fs from "node:fs/promises";
import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";

const [inputPath,outputPath,previewPath]=process.argv.slice(2);
if(!inputPath||!outputPath||!previewPath)throw new Error("Expected input, output, and preview paths");

const input=await FileBlob.load(inputPath);
const workbook=await SpreadsheetFile.importXlsx(input);
const sheet=workbook.worksheets.getItemAt(0);

// 动态测试只改真实输入路数，不碰合并关系、填充色或既有版式。
// 原首段为 8 路，改为 9 路；正确数格结果必须随之变化。
sheet.getRange("B2").values=[[9]];

const keyRange=await workbook.inspect({
  kind:"table",
  sheetId:sheet.name,
  range:"B1:D6",
  include:"values,formulas",
  tableMaxRows:6,
  tableMaxCols:3,
  maxChars:3000
});
const errors=await workbook.inspect({
  kind:"match",
  searchTerm:"#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A",
  options:{useRegex:true,maxResults:100},
  summary:"dynamic input formula error scan"
});
const preview=await workbook.render({
  sheetName:sheet.name,
  range:"A1:X60",
  scale:1,
  format:"png"
});
await fs.writeFile(previewPath,new Uint8Array(await preview.arrayBuffer()));

const output=await SpreadsheetFile.exportXlsx(workbook);
await output.save(outputPath);
console.log(JSON.stringify({keyRange:keyRange.ndjson,errors:errors.ndjson,outputPath}));
