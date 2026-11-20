// tools/make-poster.mjs — 玩法截图 + HTML 叠大标题/tagline → poster.jpg（1280×720，游戏根目录）。
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pw from '/opt/homebrew/lib/node_modules/playwright/index.js';
const { chromium } = pw;

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const bgPath = join(ROOT, 'tests/final/04-ripple.png');
const outPath = join(ROOT, 'poster.jpg');

const bg = readFileSync(bgPath).toString('base64');

const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
  * { margin:0; padding:0; box-sizing:border-box; }
  html,body { width:1280px; height:720px; overflow:hidden; background:#0a0f1a; }
  .bg { position:absolute; inset:0; width:1280px; height:720px; object-fit:cover; }
  .veil { position:absolute; inset:0; background:linear-gradient(180deg, rgba(6,10,18,0.15) 0%, rgba(6,10,18,0) 45%, rgba(6,10,18,0.78) 100%); }
  .wrap { position:absolute; inset:0; display:flex; flex-direction:column; justify-content:flex-end; align-items:center; padding-bottom:52px; text-align:center; }
  h1 {
    font: 900 78px/1 'Arial Black','Segoe UI',system-ui,sans-serif;
    letter-spacing: 0.06em;
    color:#eaffff;
    text-shadow: 0 0 6px #0a1420, 0 0 22px #5ad4ff, 0 0 46px rgba(90,212,255,0.75), 0 4px 0 #0a1420;
  }
  .tag {
    margin-top: 16px;
    font: 600 26px/1.3 system-ui,'Segoe UI',sans-serif;
    letter-spacing: 0.12em;
    color:#ffd166;
    text-shadow: 0 0 8px #0a1420, 0 0 16px rgba(255,209,102,0.7);
  }
</style></head><body>
  <img class="bg" src="data:image/png;base64,${bg}">
  <div class="veil"></div>
  <div class="wrap">
    <h1>SKY DROP DODGE</h1>
    <div class="tag">DODGE THE DROP · RIDE THE WIND</div>
  </div>
</body></html>`;

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.setContent(html, { waitUntil: 'load' });
await page.waitForTimeout(300);
await page.screenshot({ path: outPath, type: 'jpeg', quality: 88 });
await browser.close();
writeFileSync(outPath, readFileSync(outPath)); // noop keep file
console.log('saved', outPath);
process.exit(0);
