// PIXEL SQUADRON · 海报生成：起本地服务 → 进入战斗 → 截 1280×720 到 poster.jpg。
// 运行：node tools/poster.mjs
import { loadPlaywright, serve } from '../../../skills/webgame-playbook/scripts/_lib.mjs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const { server, port } = await serve(ROOT, 8260);
const { chromium } = loadPlaywright();

const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=metal'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'load', timeout: 20000 });
await page.waitForFunction(() => !!window.__ll, { timeout: 15000 });
await page.evaluate(() => window.__ll.debug.setTutorialDone(true));
await page.evaluate(() => window.__ll.start(0));
// 等到至少 2 架敌机进场，再截一张战斗帧
for (let i = 0; i < 40; i += 1) {
  const n = await page.evaluate(() => window.__ll.debug.state()?.enemies.length ?? 0);
  if (n >= 2) break;
  await page.waitForTimeout(150);
}
await page.screenshot({ path: join(ROOT, 'poster.jpg'), type: 'jpeg', quality: 90 });
console.log('poster.jpg written (1280×720)');
await browser.close();
server.close();
