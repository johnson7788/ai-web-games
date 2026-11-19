// 生成 poster.jpg（1280x720，游戏战斗画面）—— 服务用完即关。
import { loadPlaywright, serve, waitForBoot } from '../../../skills/webgame-playbook/scripts/_lib.mjs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'poster.jpg');

const { server, port } = await serve(ROOT, 8250);
const { chromium } = loadPlaywright();
const browser = await chromium.launch({
  headless: true,
  args: ['--use-gl=angle', '--use-angle=metal', '--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

try {
  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'load', timeout: 20000 });
  await waitForBoot(page, 10000);
  await page.evaluate(() => {
    localStorage.clear();
    window.__ll.start();
    window.__ll.tutorial.skip();
  });
  await page.waitForTimeout(1500);
  // 补两只动物保证画面充实
  await page.evaluate(() => {
    window.__ll.debug.forceMonster(0, 'cat');
    window.__ll.debug.forceMonster(2, 'gold');
    window.__ll.debug.forceMonster(4, 'pup');
  });
  await page.waitForTimeout(400);
  await page.screenshot({ path: OUT, type: 'jpeg', quality: 90 });
  console.log(`poster: ${OUT}`);
} finally {
  await browser.close();
  server.close();
}
