// 生成 poster.jpg（1280×720）：起服务 → 开始游戏 → 等战斗展开 → 截取战斗画面 → 关服务。
// 用完即关，不起常驻服务器。
import { serve, loadPlaywright } from '../../../skills/webgame-playbook/scripts/_lib.mjs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const { server, port } = await serve(ROOT, 8260);
const url = `http://127.0.0.1:${port}/`;

const { chromium } = loadPlaywright();
const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=metal'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
try {
  await page.goto(url, { waitUntil: 'load', timeout: 20000 });
  await page.waitForFunction(() => typeof window.__ll !== 'undefined', { timeout: 15000 });
  await page.evaluate(() => {
    window.__ll.debug.setTutorialDone(true);
    window.__ll.start(0);
  });
  // 让第一波病毒充分进入画面，同时保持开火，形成完整战斗场景
  await page.waitForTimeout(5200);
  await page.screenshot({ path: join(ROOT, 'poster.jpg') });
  console.log('✓ poster.jpg');
} finally {
  await browser.close();
  server.close();
}
