/**
 * 把單一 SVG icon 渲染為 Chrome MV3 所需的 4 個尺寸 PNG（16/32/48/128）。
 * 規則：黑底 + 白色 stroke icon + 18% 圓角 + 18% inner padding。
 *
 * 使用：node scripts/svg-to-icon-pngs.mjs icons/source.svg
 *      （source.svg 必須是 viewBox="0 0 24 24" 的 outline icon，如 Heroicons）
 */
import sharp from 'sharp';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const SRC = process.argv[2] || 'icons/source.svg';
const OUT_DIR = resolve('icons');
const SIZES = [16, 32, 48, 128];

const svgText = readFileSync(SRC, 'utf-8');

// 抽出 path d 屬性（簡易解析，假設 source 是單一 path 或多個 path 在同一 g 內）
const pathMatches = [...svgText.matchAll(/<path[^>]*\sd="([^"]+)"[^>]*\/?>/g)];
if (pathMatches.length === 0) {
  console.error('找不到 <path d="..."/>，請確認 source.svg 格式');
  process.exit(1);
}
const paths = pathMatches.map((m) => m[1]);

// 偵測原始 viewBox（預設 24×24）
const viewBoxMatch = svgText.match(/viewBox="([^"]+)"/);
const vb = viewBoxMatch ? viewBoxMatch[1].split(/\s+/).map(Number) : [0, 0, 24, 24];
const [vx, vy, vw, vh] = vb;
const viewSize = Math.max(vw, vh); // 假設正方形

function wrap(targetSize) {
  // 圓角半徑：18% of size（接近 Chrome 推薦的 icon shape）
  const rx = Math.round(targetSize * 0.18);
  // Padding：18% 兩側
  const pad = Math.round(targetSize * 0.18);
  const inner = targetSize - 2 * pad;
  const scale = inner / viewSize;
  // Stroke width：以 1.5 為基準依比例放大；最小不低於 0.85 px（極小尺寸下仍可見）
  const stroke = Math.max(0.85, +(1.5 * scale).toFixed(2));

  const pathTags = paths
    .map((d) => `<path d="${d}" />`)
    .join('\n    ');

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${targetSize}" height="${targetSize}" viewBox="0 0 ${targetSize} ${targetSize}">
  <rect width="${targetSize}" height="${targetSize}" rx="${rx}" ry="${rx}" fill="#000000"/>
  <g transform="translate(${pad} ${pad}) scale(${scale}) translate(${-vx} ${-vy})"
     fill="none" stroke="#ffffff" stroke-width="${stroke}"
     stroke-linecap="round" stroke-linejoin="round">
    ${pathTags}
  </g>
</svg>`;
}

for (const s of SIZES) {
  const svg = wrap(s);
  const out = resolve(OUT_DIR, `icon-${s}.png`);
  await sharp(Buffer.from(svg))
    .resize(s, s)
    .png({ compressionLevel: 9 })
    .toFile(out);
  console.log(`✓ icon-${s}.png  (stroke ${(1.5 * ((s - 2 * Math.round(s * 0.18)) / viewSize)).toFixed(2)}px)`);
}
console.log(`\n生成完成。共 ${SIZES.length} 個 PNG 寫入 ${OUT_DIR}`);
