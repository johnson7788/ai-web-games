// 生成 poster.jpg（1280×720）：玩法截图 + HTML 叠大标题（发光描边）+ tagline。
// 用法：node tools/make-poster.mjs
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import pw from '/opt/homebrew/lib/node_modules/playwright/index.js';

const { chromium } = pw;
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const bgPath = process.argv[2] || join(ROOT, 'tests/final/04-combo.png');
if (!existsSync(bgPath)) { console.error('background screenshot missing:', bgPath); process.exit(1); }
const b64 = readFileSync(bgPath).toString('base64');

const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>
* { margin:0; padding:0; box-sizing:border-box; }
html,body { width:1280px; height:720px; overflow:hidden; background:#1a060f; font-family:'PingFang SC','Segoe UI',system-ui,sans-serif; }
.bg { position:absolute; inset:0; width:1280px; height:720px; object-fit:cover; }
.vignette { position:absolute; inset:0; background:linear-gradient(180deg, rgba(26,6,15,0.55) 0%, rgba(26,6,15,0.05) 40%, rgba(26,6,15,0.15) 62%, rgba(26,6,15,0.82) 100%); }
.title-wrap { position:absolute; left:0; right:0; top:40px; text-align:center; }
h1 { font-size:96px; font-weight:900; letter-spacing:0.12em; color:#fff6e6;
  text-shadow: 0 0 8px #ffb347, 0 0 22px #ffb347, 0 0 44px #ff6a5a, 0 3px 0 rgba(90,20,40,0.9); }
.tagline { margin-top:10px; font-size:26px; letter-spacing:0.08em; color:#ffd166;
  text-shadow: 0 0 12px rgba(255,179,71,0.9), 0 2px 0 rgba(60,12,28,0.9); }
.cta { position:absolute; left:0; right:0; bottom:34px; text-align:center; font-size:22px; letter-spacing:0.06em; color:#fff1e0; text-shadow:0 0 10px rgba(255,179,71,0.8); }
</style></head><body>
<img class="bg" src="data:image/png;base64,${b64}">
<div class="vignette"></div>
<div class="title-wrap"><h1>CARNIVAL SHOT</h1><div class="tagline">Shoot the lantern fair · chain ×8 for a golden lantern rain</div></div>
<div class="cta">点击射击 · 打空换弹 · 12 关夜市庙会</div>
</body></html>`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.setContent(html, { waitUntil: 'load' });
await page.waitForTimeout(300);
await page.screenshot({ path: join(ROOT, 'poster.jpg'), type: 'jpeg', quality: 92 });
await browser.close();
console.log('saved poster.jpg');
process.exit(0);
