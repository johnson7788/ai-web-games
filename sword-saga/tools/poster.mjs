// tools/poster.mjs — 截一张最有张力的玩法图 → HTML 叠大标题（发光描边）+ tagline → 存 poster.jpg
// 用法：node tools/poster.mjs
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import pw from '/opt/homebrew/lib/node_modules/playwright/index.js';

const { chromium } = pw;
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SHOT = join(ROOT, 'tests', 'final', '05-boss.png');
const OUT = join(ROOT, 'poster.jpg');

const b64 = readFileSync(SHOT).toString('base64');
const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
  * { margin:0; padding:0; box-sizing:border-box; }
  html,body { width:1280px; height:720px; overflow:hidden; background:#07130f; font-family:'PingFang SC','Hiragino Sans','Segoe UI',sans-serif; }
  .bg { position:absolute; inset:0; }
  .bg img { width:1280px; height:720px; object-fit:cover; display:block; }
  .veil { position:absolute; inset:0; background:linear-gradient(180deg, rgba(7,19,15,0.25) 0%, rgba(7,19,15,0.55) 60%, rgba(7,19,15,0.92) 100%); }
  .wrap { position:absolute; left:64px; right:64px; bottom:56px; display:flex; flex-direction:column; gap:14px; }
  .title {
    font-size:86px; font-weight:800; letter-spacing:0.16em; color:#eafff2; line-height:1;
    text-shadow:0 0 18px rgba(83,231,160,0.9), 0 0 46px rgba(83,231,160,0.5), 0 0 3px rgba(255,255,255,0.9);
  }
  .tagline { font-size:26px; color:#d8f5e6; letter-spacing:0.05em; text-shadow:0 2px 12px rgba(0,0,0,0.8); max-width:900px; }
  .cn { font-size:22px; color:#9ef0b0; letter-spacing:0.1em; text-shadow:0 2px 10px rgba(0,0,0,0.8); }
</style></head><body>
  <div class="bg"><img src="data:image/png;base64,${b64}"></div>
  <div class="veil"></div>
  <div class="wrap">
    <div class="title">SWORD SAGA</div>
    <div class="tagline">Strike with the five elements. Defend to charge your sword. Let your spirit fox shield you.</div>
    <div class="cn">云隐剑歌 · 十二章水墨仙侠</div>
  </div>
</body></html>`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.setContent(html, { waitUntil: 'load' });
await page.waitForTimeout(300);
await page.screenshot({ path: OUT, type: 'jpeg', quality: 88 });
await browser.close();
console.log('saved', OUT);
