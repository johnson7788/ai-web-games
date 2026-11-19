// BEACH SOCCER 2V2 · 生成 tests/final 评审截图 + poster.jpg（1280×720，战斗屏）。
// 用完后即关服务；端口 8200-8299 自增。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadPlaywright, serve, waitForBoot } from '../../../skills/webgame-playbook/scripts/_lib.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'tests', 'final');
fs.mkdirSync(OUT, { recursive: true });

const { server, port } = await serve(ROOT, 8200);
const { chromium } = loadPlaywright();
const browser = await chromium.launch({
  headless: true,
  args: ['--use-gl=angle', '--use-angle=metal', '--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const url = `http://127.0.0.1:${port}/`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

try {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await waitForBoot(page, 10000);
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'domcontentloaded' });
  await waitForBoot(page, 10000);
  await page.evaluate(() => window.__ll.debug.setTutorialDone(true));

  // 第 1 关战斗屏（也作为海报底图）
  await page.evaluate(() => window.__ll.start(0));
  await sleep(500);
  await page.screenshot({ path: path.join(OUT, '01-playing.png') });

  // 第 2 关
  await page.evaluate(() => window.__ll.debug.loadLevel(1));
  await sleep(450);
  await page.screenshot({ path: path.join(OUT, '02-playing-l2.png') });

  // 第 3 关
  await page.evaluate(() => window.__ll.debug.loadLevel(2));
  await sleep(450);
  await page.screenshot({ path: path.join(OUT, '03-playing-l3.png') });

  // 结算屏（进球后，球门可见）
  await page.evaluate(() => { window.__ll.start(0); });
  await sleep(400);
  await page.evaluate(() => window.__ll.debug.forceWin());
  await sleep(400);
  await page.screenshot({ path: path.join(OUT, '04-result.png') });

  // 海报：第 1 关 + 瞄准线（从球拖向球门）
  await page.evaluate(() => window.__ll.start(0));
  await sleep(500);
  const ballScreen = { x: 135, y: 648 };
  await page.mouse.move(ballScreen.x, ballScreen.y);
  await page.mouse.down();
  await page.mouse.move(450, 330, { steps: 10 });
  await sleep(150);
  await page.screenshot({ path: path.join(ROOT, 'poster.jpg'), type: 'jpeg', quality: 92 });
  await page.mouse.up();

  console.log('wrote tests/final/*.png + poster.jpg');
  console.log('final:', fs.readdirSync(OUT).sort().join(', '));
} finally {
  await browser.close();
  server.close();
}
