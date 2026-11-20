// tools/make-poster.mjs — 从真实玩法截图 + HTML 大标题叠加 → poster.jpg（1280×720）。
import { readFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadPlaywright } from '../../../skills/webgame-playbook/scripts/_lib.mjs';

const { chromium } = loadPlaywright();
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const base = readFileSync(join(ROOT, 'tests/final/04-boss.png')).toString('base64');

const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
* { margin:0; padding:0; box-sizing:border-box; }
body { width:1280px; height:720px; overflow:hidden; background:#000; position:relative; font-family:'Segoe UI','PingFang SC',sans-serif; }
img.bg { position:absolute; inset:0; width:1280px; height:720px; object-fit:cover; }
.overlay { position:absolute; inset:0; background:linear-gradient(180deg, rgba(8,4,20,.25) 0%, rgba(8,4,20,0) 35%, rgba(8,4,20,.82) 100%); }
.title { position:absolute; left:64px; bottom:96px; font-size:96px; font-weight:900; letter-spacing:.12em; color:#f7ecff;
  text-shadow:0 0 10px #b06bff,0 0 26px #b06bff,0 0 60px #7a3fd6,0 0 110px #ffc94a; }
.tagline { position:absolute; left:68px; bottom:56px; font-size:28px; letter-spacing:.06em; color:#ffd9a0;
  text-shadow:0 0 12px rgba(255,201,74,.9); }
</style></head><body>
<img class="bg" src="data:image/png;base64,${base}">
<div class="overlay"></div>
<div class="title">GOBLIN MINES</div>
<div class="tagline">Light the shafts. Dig the night.</div>
</body></html>`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.setContent(html, { waitUntil: 'load' });
await page.waitForTimeout(300);
await page.screenshot({ path: resolve(ROOT, 'poster.jpg'), type: 'jpeg', quality: 90 });
await browser.close();
console.log('saved poster.jpg');
process.exit(0);
