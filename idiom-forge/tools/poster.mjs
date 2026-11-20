// tools/poster.mjs — 生成海报 poster.jpg（1280×720）：玩法截图叠大标题（发光描边）+ tagline。
// 底图用 tests/final/04-forge.png（铸兵喷发瞬间）；标题/副题叠在顶部，Playwright 截图存 jpg。
import { readFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import pw from '/opt/homebrew/lib/node_modules/playwright/index.js';

const { chromium } = pw;
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
mkdirSync(ROOT, { recursive: true });

const hero = join(ROOT, 'tests', 'final', '04-forge.png');
const b64 = readFileSync(hero).toString('base64');

const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: 1280px; height: 720px; overflow: hidden; }
  body { position: relative; background: #140a04; font-family: 'PingFang SC','Segoe UI','Microsoft YaHei',sans-serif; }
  .bg { position: absolute; inset: 0; width: 1280px; height: 720px; object-fit: cover; }
  .scrim { position: absolute; inset: 0; background: linear-gradient(180deg, rgba(10,4,1,0.82) 0%, rgba(10,4,1,0.1) 34%, rgba(10,4,1,0) 60%, rgba(10,4,1,0.55) 100%); }
  .wrap { position: absolute; left: 64px; top: 52px; }
  .title {
    font-size: 92px; font-weight: 800; letter-spacing: 0.1em; line-height: 1;
    color: #ffe9d0;
    text-shadow: 0 0 6px #1a0e06, 0 0 18px #ff8c3a, 0 0 46px #ff8c3a, 0 0 90px #ff6a1a;
  }
  .tag { margin-top: 18px; font-size: 30px; letter-spacing: 0.08em; color: #ffd08a; text-shadow: 0 0 10px rgba(26,14,6,0.9); }
  .zh { margin-top: 6px; font-size: 22px; letter-spacing: 0.34em; color: #e8c49a; }
</style></head>
<body>
  <img class="bg" src="data:image/png;base64,${b64}">
  <div class="scrim"></div>
  <div class="wrap">
    <div class="title">IDIOM FORGE</div>
    <div class="tag">Fill the idiom. Forge the blade.</div>
    <div class="zh">成语熔炉 · 锻字成刃</div>
  </div>
</body></html>`;

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.setContent(html, { waitUntil: 'load' });
await page.waitForTimeout(300);
await page.screenshot({ path: join(ROOT, 'poster.jpg'), type: 'jpeg', quality: 88 });
await browser.close();
console.log('saved poster.jpg');
