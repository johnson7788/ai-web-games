// tools/poster.mjs — 截一张最有张力的战斗图 → HTML 叠大标题（发光描边）+ tagline → poster.jpg
// 用法：node tools/poster.mjs（先跑 tools/shots.mjs 生成 tests/final/06-boss.png）
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadPlaywright } from '../../../skills/webgame-playbook/scripts/_lib.mjs';

const { chromium } = loadPlaywright();
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SHOT = join(ROOT, 'tests', 'final', '06-boss.png');
const OUT = join(ROOT, 'poster.jpg');

const b64 = readFileSync(SHOT).toString('base64');
const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
  * { margin:0; padding:0; box-sizing:border-box; }
  html,body { width:1280px; height:720px; overflow:hidden; background:#05030d; font-family:'PingFang SC','Hiragino Sans','Segoe UI',sans-serif; }
  .bg { position:absolute; inset:0; }
  .bg img { width:1280px; height:720px; object-fit:cover; display:block; }
  .veil { position:absolute; inset:0; background:linear-gradient(180deg, rgba(5,3,13,0.1) 0%, rgba(5,3,13,0.45) 55%, rgba(5,3,13,0.94) 100%); }
  .wrap { position:absolute; left:60px; right:60px; bottom:52px; display:flex; flex-direction:column; gap:12px; }
  .title {
    font-size:88px; font-weight:800; letter-spacing:0.14em; color:#eaf6ff; line-height:1;
    text-shadow:0 0 18px rgba(0,240,255,0.9), 0 0 50px rgba(0,240,255,0.5), 0 0 3px rgba(255,255,255,0.9);
  }
  .tagline { font-size:26px; color:#d8f5ff; letter-spacing:0.05em; text-shadow:0 2px 12px rgba(0,0,0,0.85); max-width:920px; }
  .cn { font-size:21px; color:#7df9ff; letter-spacing:0.12em; text-shadow:0 2px 10px rgba(0,0,0,0.85); }
</style></head><body>
  <div class="bg"><img src="data:image/png;base64,${b64}"></div>
  <div class="veil"></div>
  <div class="wrap">
    <div class="title">HEROES CHARGE</div>
    <div class="tagline">Slash, dash, and chain combos through the neon synth city.</div>
    <div class="cn">霓虹街机 · 横版格斗 · 三关解放合成都市</div>
  </div>
</body></html>`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.setContent(html, { waitUntil: 'load' });
await page.waitForTimeout(300);
await page.screenshot({ path: OUT, type: 'jpeg', quality: 90 });
await browser.close();
console.log('saved', OUT);
