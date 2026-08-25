import fs from 'node:fs/promises';
import pngToIco from 'png-to-ico';

const pngPath = new URL('../build/icon.png', import.meta.url);
const icoPath = new URL('../build/icon.ico', import.meta.url);
const ico = await pngToIco(pngPath);
await fs.writeFile(icoPath, ico);
console.log(`Created ${icoPath.pathname}`);
