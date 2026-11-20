// tools/make-poster.mjs — 玩法截图 + HTML 叠大标题 → poster.jpg（1280×720）。
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadPlaywright, serve } from '../../../skills/webgame-playbook/scripts/_lib.mjs';

const { chromium } = loadPlaywright();
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'poster.jpg');

const { server, port } = await serve(ROOT, 8210);
const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=metal', '--autoplay-policy=no-user-gesture-required'] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await ctx.newPage();
await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForFunction(() => window.__ll && window.__ll.state?.phase !== 'boot', { timeout: 15000 }).catch(() => {});
await page.waitForTimeout(300);

await page.click('#btn-start');
await page.waitForTimeout(500);
if (await page.locator('[data-tutorial-skip]').isVisible().catch(() => false)) {
  await page.locator('[data-tutorial-skip]').click({ force: true }).catch(() => {});
}
await page.waitForTimeout(250);

// 玩法最有张力的一帧：按住倒水到中段（水位上升、水温指针、目标线可见）
const box = await page.locator('#canvas').boundingBox();
await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
await page.mouse.down();
await page.waitForTimeout(900);

// 叠大标题 + tagline（发光描边）
await page.evaluate(() => {
  const ov = document.createElement('div');
  ov.id = 'poster-ov';
  ov.style.cssText = 'position:absolute;inset:0;z-index:50;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;padding-bottom:70px;pointer-events:none;background:linear-gradient(180deg, rgba(30,20,8,0) 40%, rgba(30,20,8,0.55) 100%);';
  ov.innerHTML =
    '<div style="font:800 88px/1.05 PingFang SC, Segoe UI, sans-serif;letter-spacing:0.18em;color:#fff7e6;text-shadow:0 2px 0 #7a4a12,0 0 22px rgba(232,180,74,0.9),0 0 60px rgba(232,180,74,0.55);">WATER RITUAL</div>' +
    '<div style="margin-top:14px;font:600 26px/1.4 PingFang SC, Segoe UI, sans-serif;letter-spacing:0.06em;color:#ffe6b0;text-shadow:0 1px 0 rgba(60,40,10,0.7),0 0 16px rgba(232,180,74,0.6);">Hold to pour · Hit the line · Catch the heat</div>';
  document.getElementById('game-container').appendChild(ov);
});
await page.waitForTimeout(200);
await page.screenshot({ path: OUT, type: 'jpeg', quality: 88 });
await page.mouse.up().catch(() => {});

await browser.close();
server.close();
console.log('✓ poster.jpg', OUT);
process.exit(0);
