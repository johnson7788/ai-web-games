// 生成 poster.jpg（1280×720）：抓游戏本身「最好看」的战斗屏——厨师 + 发光上菜台信标 + 食材。
// 用完即关，端口 8240 自增。用法：node tools/poster.mjs
import { serve, loadPlaywright } from '../../../skills/webgame-playbook/scripts/_lib.mjs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { server, port } = await serve(ROOT, 8240);
const { chromium } = loadPlaywright();
const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=metal'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
try {
  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'load', timeout: 20000 });
  await page.waitForFunction(() => window.__ll && window.__ll.state.phase === 'title', { timeout: 10000 });
  await page.evaluate(() => window.__ll.start());
  await page.waitForTimeout(400);
  await page.evaluate(() => window.__ll.tutorial.skip());
  await page.evaluate(() => {
    const r = window.__ll.run();
    r.state.player.x = 2700;
    r.state.player.y = 500;
    r.state.player.vx = 0;
    r.state.player.vy = 0;
  });
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(ROOT, 'poster.jpg'), type: 'jpeg', quality: 92 });
  console.log('wrote poster.jpg');
} finally {
  await browser.close();
  server.close();
}
