// tools/poster.mjs — 生成 poster.jpg（1280×720）：玩法截图 + HTML 叠大标题（发光描边）+ tagline。
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadPlaywright, serve } from '/Users/admin/git/webgames/skills/webgame-playbook/scripts/_lib.mjs';
const { chromium } = loadPlaywright();

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// 1) 录一张最有张力的玩法图（多产业 + 股市日）
const { server, port } = await serve(ROOT, 8152);
const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=metal'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__ll && window.__ll.state.phase !== 'boot', { timeout: 15000 }).catch(() => {});
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__ll && window.__ll.state.phase !== 'boot', { timeout: 15000 }).catch(() => {});
await page.locator('#btn-start').click({ force: true, timeout: 8000 });
await page.waitForTimeout(400);
await page.locator('[data-tutorial-skip]').first().click({ force: true });
await page.evaluate(() => window.__ll.debug.advance(34));
await page.waitForTimeout(500);
const bg = join(ROOT, 'tests', 'artifacts', 'poster-bg.png');
await page.screenshot({ path: bg });
await browser.close();
server.close();

// 2) HTML 叠大标题 + tagline → jpg
const b64 = readFileSync(bg).toString('base64');
const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
* { margin:0; padding:0; box-sizing:border-box; }
body { width:1280px; height:720px; overflow:hidden; font-family:'Georgia','PingFang SC','Microsoft YaHei',serif; }
.bg { position:absolute; inset:0; width:1280px; height:720px; object-fit:cover; }
.shade { position:absolute; inset:0; background:linear-gradient(180deg, rgba(10,4,0,0.25) 0%, rgba(10,4,0,0.05) 30%, rgba(10,4,0,0.72) 100%); }
.txt { position:absolute; left:56px; bottom:52px; right:56px; }
.title { font-size:88px; font-weight:900; letter-spacing:0.08em; color:#fff4d8;
  text-shadow:0 0 18px rgba(255,207,74,0.95), 0 0 46px rgba(255,207,74,0.6), 0 3px 0 #7a4a10, 0 6px 14px rgba(0,0,0,0.6); }
.tag { margin-top:14px; font-size:30px; letter-spacing:0.04em; color:#ffd88a;
  text-shadow:0 0 12px rgba(255,207,74,0.8), 0 2px 8px rgba(0,0,0,0.7); }
</style></head><body>
<img class="bg" src="data:image/png;base64,${b64}">
<div class="shade"></div>
<div class="txt">
  <div class="title">TYCOON EMPIRE</div>
  <div class="tag">Tap. Build. Ride the market. Borrow to the sky.</div>
</div>
</body></html>`;
const tmp = join(ROOT, 'tests', 'artifacts', 'poster.html');
writeFileSync(tmp, html);
const browser2 = await chromium.launch({ headless: true });
const page2 = await browser2.newPage({ viewport: { width: 1280, height: 720 } });
await page2.goto('file://' + tmp);
await page2.waitForTimeout(300);
await page2.screenshot({ path: join(ROOT, 'poster.jpg'), type: 'jpeg', quality: 88 });
await browser2.close();
console.log('poster saved to poster.jpg');
process.exit(0);
