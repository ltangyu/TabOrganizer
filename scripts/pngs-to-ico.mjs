/**
 * 把 icons/icon-{16,32,48,128}.png 合併為 icons/TabOrganizer.ico
 * 用於 Windows .lnk 桌面捷徑。每個尺寸的 PNG 直接內嵌（Windows Vista+ 支援）。
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const SIZES = [16, 32, 48, 128];
const ICON_DIR = resolve('icons');
const OUT = resolve('icons/TabOrganizer.ico');

const pngs = SIZES.map((s) => readFileSync(resolve(ICON_DIR, `icon-${s}.png`)));

const HEADER_SIZE = 6;
const ENTRY_SIZE = 16;

// Header (ICONDIR)
const header = Buffer.alloc(HEADER_SIZE);
header.writeUInt16LE(0, 0);                // reserved
header.writeUInt16LE(1, 2);                // type: ICO = 1
header.writeUInt16LE(SIZES.length, 4);     // image count

// Entries (ICONDIRENTRY × N)
const entries = Buffer.alloc(ENTRY_SIZE * SIZES.length);
let offset = HEADER_SIZE + ENTRY_SIZE * SIZES.length;

SIZES.forEach((s, i) => {
  const e = entries.subarray(i * ENTRY_SIZE, (i + 1) * ENTRY_SIZE);
  e[0] = s === 256 ? 0 : s;                // width (0 means 256)
  e[1] = s === 256 ? 0 : s;                // height
  e[2] = 0;                                 // colors in palette (0 = no palette)
  e[3] = 0;                                 // reserved
  e.writeUInt16LE(1, 4);                    // color planes
  e.writeUInt16LE(32, 6);                   // bits per pixel
  e.writeUInt32LE(pngs[i].length, 8);       // image data size
  e.writeUInt32LE(offset, 12);              // image data offset from file start
  offset += pngs[i].length;
});

const ico = Buffer.concat([header, entries, ...pngs]);
writeFileSync(OUT, ico);
console.log(`✓ ${OUT}  (${ico.length} bytes, ${SIZES.length} sizes embedded)`);
