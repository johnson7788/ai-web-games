// tools/make-poster.mjs — 用真实玩法截图 + 发光大标题 + tagline 生成 poster.jpg（1280×720）
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import pw from '/opt/homebrew/lib/node_modules/playwright/index.js';
const { chromium } = pw;

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
mkdirSync(join(ROOT, 'tools', 'artifacts'), { recursive: true });

const base = join(ROOT, 'tests', 'final', '01-play.png');
const b64 = readFileSync(base).toString('base64');

const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { width:1280px; height:720px; overflow:hidden; font-family:'PingFang SC','Hiragino Sans','Segoe UI',sans-serif; }
  .bg { position:absolute; inset:0; width:1280px; height:720px; object-fit:cover; }
  .veil { position:absolute; inset:0; background:radial-gradient(circle at 50% 42%, rgba(4,10,20,0.05) 0%, rgba(4,10,20,0.78) 100%); }
  .title-wrap { position:absolute; left:0; right:0; top:150px; text-align:center; }
  .title {
    font-size:96px; font-weight:800; letter-spacing:0.16em; color:#eaffff;
    text-shadow:0 0 24px rgba(84,231,255,0.95), 0 0 60px rgba(84,231,255,0.55), 0 4px 12px rgba(0,0,0,0.9);
  }
  .tagline { margin-top:18px; font-size:26px; color:#cfe9ff; letter-spacing:0.08em; text-shadow:0 2px 8px rgba(0,0,0,0.9); }
  .tagline em { color:#ffd166; font-style:normal; }
</style></head><body>
  <img class="bg" src="data:image/png;base64,${b64}">
  <div class="veil"></div>
  <div class="title-wrap">
    <div class="title">STAR SLAYER</div>
    <div class="tagline">Pilot the Iron Guard · Fight in sync with <em>Light Core</em></div>
  </div>
</body></html>`;

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.setContent(html, { waitUntil: 'load' });
await page.waitForTimeout(300);
await page.screenshot({ path: join(ROOT, 'poster.jpg'), type: 'jpeg', quality: 88 });
await browser.close();
console.log('saved poster.jpg');
