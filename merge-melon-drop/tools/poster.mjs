// MERGE MELON DROP · 封面截图：起服务 → 铺一个好看的彩虹盘面 → 截 1280×720 → poster.jpg。
// 用完即关服务。运行：node tools/poster.mjs
import { loadPlaywright, serve, createErrorCollector } from '../../../skills/webgame-playbook/scripts/_lib.mjs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'poster.jpg');

const { server, port } = await serve(ROOT, 8230);
const { chromium } = loadPlaywright();
const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=metal'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const collector = createErrorCollector();
collector.attach(page, port);

try {
  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'load', timeout: 20000 });
  await page.waitForFunction(() => typeof window.__ll !== 'undefined', { timeout: 10000 });
  await page.waitForTimeout(600);
  // 进入游戏并铺彩虹盘面
  await page.evaluate(() => {
    window.__ll.debug.setTutorialDone(true);
    window.__ll.start();
    window.__ll.debug.loadBoard('merge');
  });
  await page.waitForTimeout(700);
  await page.screenshot({ path: OUT, type: 'jpeg', quality: 90 });
  console.log(`✓ poster: ${OUT}`);
} finally {
  await browser.close();
  server.close();
}

if (collector.hasErrors()) {
  console.error(JSON.stringify(collector.toJSON(), null, 2));
  process.exit(1);
}
