// tools/poster.mjs — 生成 1280×720 poster.jpg：真实玩法截图 + HTML 叠大标题（发光描边）+ tagline。
import { statSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadPlaywright, serve } from '../../../skills/webgame-playbook/scripts/_lib.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const OUT = join(root, 'poster.jpg');

const { server, port } = await serve(root, 8175);
const { chromium } = loadPlaywright();
const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=metal', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__ll && window.__ll.state.phase !== 'boot', { timeout: 10000 });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'load' });
await page.waitForFunction(() => window.__ll && window.__ll.state.phase !== 'boot', { timeout: 10000 });
await page.click('#btn-start');
await page.waitForTimeout(600);
const skip = page.locator('[data-tutorial-skip]');
if (await skip.count()) await skip.click({ force: true }).catch(() => {});

// 糖果丘末端：骑士腾空奔向终点旗（星星 + 金币 + 目标同屏）
await page.evaluate(() => {
  const r = window.__ll.run;
  r.player.x = 2750;
  r.player.y = 360;
  r.player.vx = 120;
  r.player.vy = 0;
  r.player.squash = 0.5;
  r.cameraX = 2320;
});
await page.waitForTimeout(250);
const bgBuf = await page.screenshot({ type: 'png' });
await page.close();
server.close();

const b64 = bgBuf.toString('base64');
const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
* { margin: 0; box-sizing: border-box; }
body { width: 1280px; height: 720px; overflow: hidden; font-family: 'PingFang SC','Hiragino Sans','Trebuchet MS',sans-serif; }
.wrap { position: relative; width: 1280px; height: 720px; }
.bg { position: absolute; inset: 0; width: 1280px; height: 720px; }
.shade { position: absolute; inset: 0; background: linear-gradient(180deg, rgba(58,27,46,0.0) 30%, rgba(58,27,46,0.55) 100%); }
.logo { position: absolute; top: 60px; left: 0; right: 0; text-align: center; font-size: 118px; font-weight: 800; letter-spacing: 0.14em; color: #fff;
  text-shadow: 0 0 6px #fff, 0 0 18px #ff5fae, 0 0 40px #ff5fae, 0 0 70px #ff5fae; }
.tag { position: absolute; top: 216px; left: 0; right: 0; text-align: center; font-size: 30px; font-weight: 700; letter-spacing: 0.04em; color: #fff7fb;
  text-shadow: 0 2px 10px rgba(58,27,46,0.9), 0 0 18px rgba(255,95,174,0.9); }
</style></head><body><div class="wrap">
<img class="bg" src="data:image/png;base64,${b64}">
<div class="shade"></div>
<div class="logo">Q ADVENTURE</div>
<div class="tag">Bounce · Wall-jump · Ride the beat · Save the princess</div>
</div></body></html>`;

const p2 = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await p2.setContent(html, { waitUntil: 'load' });
await p2.waitForTimeout(200);
await p2.screenshot({ path: OUT, type: 'jpeg', quality: 90 });
await browser.close();
console.log('poster →', OUT, statSync(OUT).size, 'bytes');
