// 生成 poster.jpg（1280×720）：玩法截图 → HTML 叠大标题（发光描边）+ tagline → playwright 截图
// 用法：node tools/record-poster.mjs
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import pw from '/opt/homebrew/lib/node_modules/playwright/index.js';
const { chromium } = pw;

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BASE = join(ROOT, 'tests', 'final', '07-finale.png');
const baseB64 = readFileSync(BASE).toString('base64');

const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>
* { margin:0; padding:0; }
body { width:1280px; height:720px; overflow:hidden; font-family:'Segoe UI','PingFang SC',sans-serif; }
.stage { position:relative; width:1280px; height:720px; }
.bg { position:absolute; inset:0; width:1280px; height:720px; object-fit:cover; filter:saturate(1.05) brightness(0.92); }
.vignette { position:absolute; inset:0; background:radial-gradient(ellipse at 50% 40%, rgba(0,0,0,0) 40%, rgba(6,10,20,0.85) 100%); }
.title-wrap { position:absolute; left:0; right:0; top:150px; text-align:center; }
.logo {
  font-size:120px; font-weight:900; letter-spacing:0.1em; color:#fff4ea;
  text-shadow: 0 0 14px #ff9d4d, 0 0 34px #ff6a3a, 0 0 70px #ff9d4d, 0 4px 0 #7a3a16;
}
.tagline { margin-top:18px; font-size:30px; color:#cfe8ff; letter-spacing:0.06em; text-shadow:0 2px 8px rgba(0,0,0,0.8); }
.cta { margin-top:42px; display:inline-block; padding:14px 46px; border-radius:999px; background:rgba(255,157,77,0.2); border:2px solid #ff9d4d; color:#ffe0c0; font-size:26px; letter-spacing:0.08em; }
</style></head><body>
<div class="stage">
  <img class="bg" src="data:image/png;base64,${baseB64}">
  <div class="vignette"></div>
  <div class="title-wrap">
    <div class="logo">PLUMBER RUN</div>
    <div class="tagline">Run. Jump. Wrench-Boomerang. Fix the Steam City.</div>
    <div><span class="cta">▶ PLAY</span></div>
  </div>
</div>
</body></html>`;

const outHtml = join(ROOT, 'tests', 'artifacts', 'poster.html');
mkdirSync(dirname(outHtml), { recursive: true });
writeFileSync(outHtml, html);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto('file://' + outHtml);
await page.waitForTimeout(300);
await page.screenshot({ path: join(ROOT, 'poster.jpg'), type: 'jpeg', quality: 90 });
await browser.close();
console.log('saved', join(ROOT, 'poster.jpg'));
process.exit(0);
