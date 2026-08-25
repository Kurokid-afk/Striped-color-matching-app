import fs from "node:fs/promises";
import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";

const [inputPath,previewPath]=process.argv.slice(2);
if(!inputPath||!previewPath)throw new Error("Expected input and preview paths");

const input=await FileBlob.load(inputPath);
const workbook=await SpreadsheetFile.importXlsx(input);
const overview=await workbook.inspect({
  kind:"workbook,sheet,table",
  maxChars:5000,
  tableMaxRows:8,
  tableMaxCols:12,
  tableMaxCellChars:60
});
const region=await workbook.inspect({
  kind:"region",
  sheetId:workbook.worksheets.getItemAt(0).name,
  range:"A1:X35",
  maxChars:9000
});
const preview=await workbook.render({
  sheetName:workbook.worksheets.getItemAt(0).name,
  range:"A1:X60",
  scale:1,
  format:"png"
});
await fs.writeFile(previewPath,new Uint8Array(await preview.arrayBuffer()));
console.log(JSON.stringify({overview:overview.ndjson,region:region.ndjson}));
