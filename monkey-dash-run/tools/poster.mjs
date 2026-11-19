// 生成 poster.jpg（1280×720）：起临时静态服务 → 进游戏 → 注入收集物/障碍/冲刺 → 截最漂亮的战斗画面。
// 运行：/opt/homebrew/bin/node tools/poster.mjs
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadPlaywright, serve } from '../../../skills/webgame-playbook/scripts/_lib.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'poster.jpg');

const { server, port } = await serve(ROOT, 8260);
const { chromium } = loadPlaywright();
const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=metal'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'load', timeout: 20000 });
await page.waitForFunction(() => typeof window.__ll !== 'undefined', { timeout: 15000 });
await page.waitForTimeout(800);

// 直接进游戏并布置一个信息量丰富的画面
await page.evaluate(() => {
  window.__ll.start();
  return true;
});
await page.waitForTimeout(200);
await page.evaluate(() => window.__ll.debug.endTutorial());
await page.waitForTimeout(1200);
await page.evaluate(() => {
  window.__ll.debug.spawnPickups();
  window.__ll.debug.spawnObstacles();
  window.__ll.debug.forceRush();
  return true;
});
await page.waitForTimeout(300);
await page.screenshot({ path: OUT, type: 'jpeg', quality: 92 });

await browser.close();
server.close();
console.log(`✓ poster.jpg written (1280×720)`);
