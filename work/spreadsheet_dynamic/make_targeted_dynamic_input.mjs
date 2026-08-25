import fs from 'node:fs/promises';
import JSZip from 'jszip';

const [sourcePath, outputPath] = process.argv.slice(2);
if (!sourcePath || !outputPath) {
  throw new Error('Expected source.xlsx output.xlsx');
}

const zip = await JSZip.loadAsync(await fs.readFile(sourcePath));
const sheetPath = 'xl/worksheets/sheet1.xml';
const sheetFile = zip.file(sheetPath);
if (!sheetFile) throw new Error('sheet1.xml missing');

const xml = await sheetFile.async('string');
const routeCellPattern = /(<c\s+r="B2"[^>]*>\s*<v>)8(<\/v>\s*<\/c>)/;
const totalCellPattern = /(<c\s+r="B54"[^>]*>[\s\S]*?<v>)26(<\/v>\s*<\/c>)/;
if (!routeCellPattern.test(xml)) throw new Error('Expected B2 value 8 was not found');
if (!totalCellPattern.test(xml)) throw new Error('Expected B54 cached total 26 was not found');

zip.file(
  sheetPath,
  xml
    .replace(routeCellPattern, (_match, before, after) => `${before}9${after}`)
    .replace(totalCellPattern, (_match, before, after) => `${before}27${after}`)
);
await fs.writeFile(
  outputPath,
  await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' })
);

console.log(JSON.stringify({ changed: 'B2', from: 8, to: 9 }));
