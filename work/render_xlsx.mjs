import fs from "node:fs/promises";
import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";

const [inputPath, outputDir, ...sheetNames] = process.argv.slice(2);
if (!inputPath || !outputDir || !sheetNames.length) {
  throw new Error("Expected: input.xlsx output_dir sheet_name...");
}

await fs.mkdir(outputDir, { recursive: true });
const input = await FileBlob.load(inputPath);
const workbook = await SpreadsheetFile.importXlsx(input);

for (let index = 0; index < sheetNames.length; index += 1) {
  const sheetName = sheetNames[index];
  const preview = await workbook.render({
    sheetName,
    autoCrop: "all",
    scale: 1.25,
    format: "png",
  });
  await fs.writeFile(
    `${outputDir}/${String(index + 1).padStart(2, "0")}.png`,
    new Uint8Array(await preview.arrayBuffer()),
  );
}
