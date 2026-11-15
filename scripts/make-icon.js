/* 아이콘 생성: node scripts/make-icon.js  (개발 PC에서 1회 실행, 결과물 build/icon.ico · build/icon.png 는 저장소에 포함)
   필요: playwright, png-to-ico (npm i -D 없이 npx/전역 설치로 실행해도 됨) */
'use strict';
const fs = require('fs');
const path = require('path');
const E = require('../src/js/emblem.js');

const OUT = path.join(__dirname, '..', 'build');
const BG = '#0A0B0C';

function tileSvg(size) {
  const px = E.build();
  const small = size <= 32;
  const pts = small ? px.filter(p => p.part === 'shield') : px;
  const xs = pts.map(p => p.x), ys = pts.map(p => p.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const gw = maxX - minX + 1, gh = maxY - minY + 1;
  const inner = Math.round(size * (small ? 0.94 : 0.9));
  const cell = Math.max(1, Math.floor(inner / Math.max(gw, gh)));
  const ox = Math.floor((size - gw * cell) / 2), oy = Math.floor((size - gh * cell) / 2);
  const rects = pts.map(p => `<rect x="${ox + (p.x - minX) * cell}" y="${oy + (p.y - minY) * cell}" width="${cell}" height="${cell}" fill="${E.COLORS[p.c]}"/>`).join('');
  const r = Math.round(size * 0.14);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges"><rect width="${size}" height="${size}" rx="${r}" fill="${BG}" shape-rendering="geometricPrecision"/>${rects}</svg>`;
}

(async () => {
  const { chromium } = require('playwright');
  const pngToIco = require('png-to-ico');
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const sizes = [16, 24, 32, 48, 64, 128, 256, 512];
  const files = {};
  for (const s of sizes) {
    await page.setViewportSize({ width: s, height: s });
    await page.setContent(`<html><body style="margin:0;background:transparent">${tileSvg(s)}</body></html>`);
    const buf = await page.screenshot({ omitBackground: true, clip: { x: 0, y: 0, width: s, height: s } });
    const f = path.join(OUT, `icon-${s}.png`);
    fs.writeFileSync(f, buf);
    files[s] = f;
  }
  await browser.close();
  fs.copyFileSync(files[512], path.join(OUT, 'icon.png'));
  fs.copyFileSync(files[256], path.join(__dirname, '..', 'src', 'icon.png'));
  const ico = await pngToIco([16, 24, 32, 48, 64, 128, 256].map(s => files[s]));
  fs.writeFileSync(path.join(OUT, 'icon.ico'), ico);
  for (const s of sizes) fs.unlinkSync(files[s]);
  console.log('build/icon.ico, build/icon.png, src/icon.png 생성 완료');
})();
