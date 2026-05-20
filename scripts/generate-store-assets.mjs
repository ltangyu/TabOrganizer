/**
 * 生成 Chrome Web Store 上架素材：
 *   - store-listing/promo-small-440x280.png  (必填 promotional tile)
 *   - store-listing/promo-marquee-1400x560.png  (選填 marquee banner)
 *
 * 使用 sharp 把 SVG 範本渲染成 PNG。
 */
import sharp from 'sharp';
import { mkdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const OUT_DIR = resolve('store-listing');
mkdirSync(OUT_DIR, { recursive: true });

// 從 icons/source.svg 抽出 path 重複利用
const sourceSvg = readFileSync(resolve('icons/source.svg'), 'utf-8');
const pathMatches = [...sourceSvg.matchAll(/<path[^>]*\sd="([^"]+)"[^>]*\/?>/g)];
const iconPaths = pathMatches.map((m) => `<path d="${m[1]}" />`).join('\n      ');

/**
 * 水平佈局 SVG（icon 左、文字右）— 用於 marquee
 */
function tileSvgHorizontal(w, h, cfg) {
  const { iconScale, titleSize, subtitleSize, padding, gap, subtitle } = cfg;
  const iconSize = Math.round(h * iconScale);
  const iconStroke = Math.max(1.5, iconSize / 18);
  const iconY = (h - iconSize) / 2;
  const textX = padding + iconSize + gap;
  const titleY = subtitle ? h / 2 - 6 : h / 2 + titleSize / 3;
  const subtitleY = titleY + titleSize * 0.65;
  const iconInnerScale = iconSize / 24;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <rect width="${w}" height="${h}" fill="#000000"/>
  <g transform="translate(${padding} ${iconY}) scale(${iconInnerScale})"
     fill="none" stroke="#ffffff" stroke-width="${(iconStroke / iconInnerScale).toFixed(2)}"
     stroke-linecap="round" stroke-linejoin="round">
      ${iconPaths}
  </g>
  <text x="${textX}" y="${titleY}"
        font-family="Inter, 'Helvetica Neue', Helvetica, Arial, sans-serif"
        font-weight="700" font-size="${titleSize}" fill="#ffffff"
        dominant-baseline="alphabetic"
        letter-spacing="-0.01em">TabOrganizer</text>
  ${subtitle ? `
  <text x="${textX}" y="${subtitleY}"
        font-family="'Space Grotesk', 'JetBrains Mono', Consolas, monospace"
        font-weight="500" font-size="${subtitleSize}" fill="rgba(255,255,255,0.55)"
        dominant-baseline="hanging"
        letter-spacing="0.02em">${subtitle}</text>` : ''}
</svg>`;
}

/**
 * 垂直佈局 SVG（icon 上、文字下）— 用於 small promo（440×280 太窄）
 */
function tileSvgVertical(w, h, cfg) {
  const { iconSize, titleSize, subtitleSize, subtitle, gapIconTitle, gapTitleSub } = cfg;
  const iconInnerScale = iconSize / 24;
  const iconStroke = Math.max(1.5, iconSize / 18);
  // 計算總高
  const totalH = iconSize + gapIconTitle + titleSize + (subtitle ? gapTitleSub + subtitleSize : 0);
  const startY = (h - totalH) / 2;
  const iconX = (w - iconSize) / 2;
  const iconY = startY;
  const titleY = iconY + iconSize + gapIconTitle + titleSize * 0.8; // baseline
  const subtitleY = titleY + gapTitleSub;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <rect width="${w}" height="${h}" fill="#000000"/>
  <g transform="translate(${iconX} ${iconY}) scale(${iconInnerScale})"
     fill="none" stroke="#ffffff" stroke-width="${(iconStroke / iconInnerScale).toFixed(2)}"
     stroke-linecap="round" stroke-linejoin="round">
      ${iconPaths}
  </g>
  <text x="${w / 2}" y="${titleY}" text-anchor="middle"
        font-family="Inter, 'Helvetica Neue', Helvetica, Arial, sans-serif"
        font-weight="700" font-size="${titleSize}" fill="#ffffff"
        dominant-baseline="alphabetic"
        letter-spacing="-0.01em">TabOrganizer</text>
  ${subtitle ? `
  <text x="${w / 2}" y="${subtitleY}" text-anchor="middle"
        font-family="'Space Grotesk', 'JetBrains Mono', Consolas, monospace"
        font-weight="500" font-size="${subtitleSize}" fill="rgba(255,255,255,0.55)"
        dominant-baseline="hanging"
        letter-spacing="0.06em">${subtitle}</text>` : ''}
</svg>`;
}

// 1. Small promo tile 440×280 — 垂直佈局（icon 在上、文字在下）
{
  const svg = tileSvgVertical(440, 280, {
    iconSize: 110,
    titleSize: 36,
    subtitleSize: 13,
    gapIconTitle: 18,
    gapTitleSub: 14,
    subtitle: 'ONE-CLICK · TAB CLEANUP',
  });
  await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toFile(resolve(OUT_DIR, 'promo-small-440x280.png'));
  console.log('✓ promo-small-440x280.png');
}

// 2. Marquee 1400×560 — 水平佈局
{
  const svg = tileSvgHorizontal(1400, 560, {
    iconScale: 0.5,
    titleSize: 96,
    subtitleSize: 28,
    padding: 100,
    gap: 60,
    subtitle: 'SNAPSHOT TABS · FREE MEMORY · 10 LANGUAGES',
  });
  await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toFile(resolve(OUT_DIR, 'promo-marquee-1400x560.png'));
  console.log('✓ promo-marquee-1400x560.png');
}

console.log(`\n生成完成。檔案寫入 ${OUT_DIR}`);
