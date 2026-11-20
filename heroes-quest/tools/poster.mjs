// tools/poster.mjs — 玩法截图 + HTML 叠大标题 → poster.jpg（1280×720）
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { loadPlaywright } from '../../../skills/webgame-playbook/scripts/_lib.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const shot = join(root, 'tests', 'final', '03-battle.png');
const b64 = readFileSync(shot).toString('base64');

const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
* { margin:0; padding:0; box-sizing:border-box; }
body { width:1280px; height:720px; overflow:hidden; background:#0a0e14; font-family:'PingFang SC','Segoe UI',system-ui,sans-serif; }
.bg { position:absolute; inset:0; background:url('data:image/png;base64,${b64}') center/cover no-repeat; }
.shade { position:absolute; inset:0; background:linear-gradient(180deg, rgba(10,14,20,.55) 0%, rgba(10,14,20,.1) 40%, rgba(10,14,20,.72) 100%); }
.title { position:absolute; left:70px; top:56px; font-size:88px; font-weight:800; letter-spacing:.12em; color:#fff7e0;
  text-shadow: 0 0 24px rgba(255,210,74,.95), 0 0 60px rgba(255,210,74,.5), 0 4px 0 rgba(0,0,0,.4); }
.tagline { position:absolute; left:74px; top:178px; font-size:26px; letter-spacing:.05em; color:#e8eef5;
  text-shadow: 0 2px 8px rgba(0,0,0,.8); }
.sub { position:absolute; left:74px; top:224px; font-size:18px; letter-spacing:.08em; color:#ffd24a; }
</style></head><body>
<div class="bg"></div><div class="shade"></div>
<div class="title">HEROES QUEST</div>
<div class="tagline">Arrange your formation. Spend your supplies. Unleash the Expedition Might.</div>
<div class="sub">TACTICAL EXPEDITION · 3 HEROES · 12 NODES</div>
</body></html>`;

const file = join(root, 'tests', 'artifacts', 'poster.html');
writeFileSync(file, html);
const { chromium } = loadPlaywright();
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto('file://' + file, { waitUntil: 'load' });
await page.waitForTimeout(400);
await page.screenshot({ path: join(root, 'poster.jpg'), type: 'jpeg', quality: 88 });
await browser.close();
console.log('saved', join(root, 'poster.jpg'));
