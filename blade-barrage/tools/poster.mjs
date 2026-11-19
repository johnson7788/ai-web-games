// BLADE BARRAGE · 生成 poster.jpg（1280×720，截游戏战斗画面，不用灰屏）
// 用法：node tools/poster.mjs
// 自带静态服务，用完即关；端口 8200-8299 自增。
import { loadPlaywright, serve, waitForBoot } from '../../../skills/webgame-playbook/scripts/_lib.mjs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

const { server, port } = await serve(ROOT, 8200);
const { chromium } = loadPlaywright();
const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=metal', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

try {
  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'domcontentloaded', timeout: 20000 });
  await waitForBoot(page, 10000);
  await page.waitForTimeout(600);
  await page.evaluate(() => window.__ll.start(3));
  await page.waitForTimeout(500);
  await page.evaluate(() => { if (window.__ll.tutorial.active) window.__ll.tutorial.skip(); });
  await page.evaluate(() => { window.__ll.debug.perfectHit(); });
  await page.waitForTimeout(120);
  await page.evaluate(() => { window.__ll.debug.perfectHit(); });
  await page.waitForTimeout(260);
  await page.screenshot({ path: join(ROOT, 'poster.jpg'), type: 'jpeg', quality: 92 });
  console.log(`poster.jpg written (viewport 1280×720)`);
} finally {
  await browser.close();
  server.close();
}
