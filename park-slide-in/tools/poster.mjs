// PARK SLIDE IN · 生成 poster.jpg（1280×720，游戏本身最好看的画面）
// 起本地服务 → 进入 L1 → 跳过教程 → 把车摆到接近车位的动作姿态 → 截图 → 关服务。
import { loadPlaywright, serve, createErrorCollector } from '../../../skills/webgame-playbook/scripts/_lib.mjs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'poster.jpg');

const { server, port } = await serve(ROOT, 8260);
const { chromium } = loadPlaywright();
const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=metal'] });
const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await context.newPage();
const collector = createErrorCollector();
collector.attach(page, port);

try {
  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'load', timeout: 20000 });
  await page.waitForFunction(() => typeof window.__ll !== 'undefined', { timeout: 10000 });
  await page.waitForTimeout(800);
  await page.evaluate(() => window.__ll.start(0));
  await page.waitForTimeout(400);
  await page.evaluate(() => window.__ll.tutorial.skip());
  await page.evaluate(() => {
    const s = window.__ll.debug.state();
    s.car.x = 820;
    s.car.y = 356;
    s.car.heading = -0.12;
    s.car.speed = 0;
    return true;
  });
  await page.waitForTimeout(500);
  await page.screenshot({ path: OUT, type: 'jpeg', quality: 92 });
  console.log(`✓ poster.jpg written (${OUT})`);
} finally {
  await browser.close();
  server.close();
}
