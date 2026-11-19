// 生成 poster.jpg（1280×720）：起本地服务 → 开局 → 选中一手可出牌 → 截战斗屏。
// 用完即关服务。运行：node tools/shot-poster.mjs
import { loadPlaywright, serve, waitForBoot } from '../../../skills/webgame-playbook/scripts/_lib.mjs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'poster.jpg');

const { server, port } = await serve(ROOT, 8260);
const { chromium } = loadPlaywright();
const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=metal'] });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'load', timeout: 20000 });
  await waitForBoot(page, 8000);
  await page.evaluate(() => window.__ll.debug.setTutorialDone(true));
  await page.evaluate(() => window.__ll.start(0));
  await page.waitForTimeout(500);
  await page.evaluate(() => window.__ll.run().hint());
  await page.waitForTimeout(400);
  await page.screenshot({ path: OUT, type: 'jpeg', quality: 90 });
  console.log(`wrote ${OUT}`);
} finally {
  await browser.close();
  server.close();
}
