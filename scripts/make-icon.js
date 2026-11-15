/* 아이콘 생성: node scripts/make-icon.js  (개발 PC에서 1회 실행, 결과물 build/icon.ico · build/icon.png 는 저장소에 포함)
   필요: playwright, png-to-ico (npm i -D 없이 npx/전역 설치로 실행해도 됨) */
'use strict';
const fs = require('fs');
const path = require('path');
const E = require('../src/js/emblem.js');

const OUT = path.join(__dirname, '..', 'build');
const BG = '#07080A';

function tileSvg(size) {
  const small = size <= 32;
  // 작은 크기는 방패만, 큰 크기는 날개 포함 (벡터, 픽셀 아님)
  const vb = small ? '-42 -39 84 84' : '-110 -130 220 220';
  const r = Math.round(size * 0.18);
  const em = E.svg({ mode: 'solid', color: '#FFB020', ink: BG, viewBox: vb, attrs: ` width="${size}" height="${size}"` });
  const inner = small ? em.replace(/<path d="M[^"]*" fill="#FFB020"\/>/g, (m) => m.includes('M-25,-34') ? m : '') : em;
  return `<div style="width:${size}px;height:${size}px;border-radius:${r}px;background:radial-gradient(circle at 50% 42%, #1A1408, ${BG} 70%);overflow:hidden;box-shadow:inset 0 0 0 ${Math.max(1, Math.round(size / 64))}px rgba(255,176,32,.45)">${inner}</div>`;
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
