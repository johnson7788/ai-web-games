// 生成 poster.jpg：起本地服务 → 进战斗 → 铺一排塔 → 截图（服务用完即关）。
import { loadPlaywright, serve } from '../../../skills/webgame-playbook/scripts/_lib.mjs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const { server, port } = await serve(ROOT, 8240);
const { chromium } = loadPlaywright();
const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=metal'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'load', timeout: 20000 });
await page.waitForFunction(() => !!window.__ll, { timeout: 10000 });
await page.evaluate(() => window.__ll.debug.setTutorialDone(true));
await page.evaluate(() => window.__ll.start(0));
await page.waitForTimeout(300);
// 铺一排塔（前两列 6 座 + 轨道炮/特斯拉混搭）
await page.evaluate(() => {
  const g = window.__ll.debug;
  for (let lane = 0; lane < 3; lane += 1) {
    g.build(lane * 6 + 0, 'laser');
    g.build(lane * 6 + 1, lane === 1 ? 'rail' : 'laser');
  }
  g.build(2, 'rail');
  g.build(8, 'tesla');
  g.build(14, 'rail');
  return true;
});
// 等到敌人压进中路、塔开火
await page.waitForTimeout(9000);
await page.screenshot({ path: join(ROOT, 'poster.jpg'), type: 'jpeg', quality: 90 });
console.log('poster.jpg written');
await browser.close();
server.close();
