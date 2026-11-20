// tools/poster.mjs — 用玩法截图叠大标题 + tagline → poster.jpg（1280×720）。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadPlaywright } from '../../../skills/webgame-playbook/scripts/_lib.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const BASE = path.join(ROOT, 'tests/final/03-mid.png');
const OUT = path.join(ROOT, 'poster.jpg');

const b64 = fs.readFileSync(BASE).toString('base64');
const html = `<!doctype html><html><head><meta charset="utf-8"><style>
  * { margin:0; padding:0; box-sizing:border-box; }
  html,body { width:1280px; height:720px; overflow:hidden; }
  body { position:relative; }
  img.bg { position:absolute; inset:0; width:100%; height:100%; object-fit:cover; }
  .ov { position:absolute; left:70px; top:96px; color:#eaffff; font-family:'Arial Black','PingFang SC',sans-serif; }
  h1 { font-size:96px; letter-spacing:0.12em; margin:0; color:#eaffff;
       text-shadow:0 0 18px rgba(63,224,255,0.95), 0 0 46px rgba(63,224,255,0.6), 0 4px 0 rgba(4,20,30,0.9); }
  p { margin-top:14px; font-size:26px; color:#d9f4ff; letter-spacing:0.04em;
       text-shadow:0 0 14px rgba(4,20,30,0.95), 0 0 26px rgba(63,224,255,0.5); }
</style></head><body>
  <img class="bg" src="data:image/png;base64,${b64}">
  <div class="ov"><h1>CELL WARS</h1><p>Infect the dish. Outgrow the red strain.</p></div>
</body></html>`;

const { chromium } = loadPlaywright();
const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=metal'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.setContent(html, { waitUntil: 'load' });
await page.screenshot({ path: OUT, type: 'jpeg', quality: 88 });
await browser.close();
console.log('poster.jpg written:', (fs.statSync(OUT).size / 1024).toFixed(0), 'KB');
