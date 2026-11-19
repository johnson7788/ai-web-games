// poster.mjs — 用 Playwright 截取游戏最漂亮的「放水中」画面，产出 poster.jpg（1280×720）
// 与 tests/final/02-pour.png。自带服务用完即关，端口 8260 起。
import { loadPlaywright, serve } from '../../../skills/webgame-playbook/scripts/_lib.mjs';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
mkdirSync(path.join(ROOT, 'tests', 'final'), { recursive: true });

const { server, port } = await serve(ROOT, 8260);
const { chromium } = loadPlaywright();
const browser = await chromium.launch({
  headless: true,
  args: ['--use-gl=angle', '--use-angle=metal', '--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'load', timeout: 20000 });
await page.waitForFunction(() => typeof window.__ll !== 'undefined', { timeout: 10000 });
await page.waitForTimeout(700);

// 进入 L1，画出霓虹轨道并放水，截取水在轨道上流动的画面
await page.evaluate(() => {
  window.__ll.debug.setTutorialDone(true);
  window.__ll.start(0);
  window.__ll.debug.drawSolution();
  window.__ll.debug.pour();
});
await page.waitForTimeout(1300);

await page.screenshot({ path: path.join(ROOT, 'poster.jpg'), type: 'jpeg', quality: 88 });
await page.screenshot({ path: path.join(ROOT, 'tests', 'final', '02-pour.png') });

await browser.close();
server.close();
console.log(`✓ poster.jpg + tests/final/02-pour.png written (1280×720)`);
