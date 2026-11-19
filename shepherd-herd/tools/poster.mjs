// 生成 poster.jpg（1280×720）：用 playwright 截游戏自身最亮眼的战斗画面。
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
await page.waitForFunction(() => window.__ll && window.__ll.state.phase !== 'boot', { timeout: 15000 }).catch(() => {});
await page.evaluate(() => window.__ll.debug.setTutorialDone(true));
// L4（金色羊 + 岩石 + 6 只羊）画面元素最丰富
await page.evaluate(() => window.__ll.start(3));
await page.waitForTimeout(2400);
await page.screenshot({ path: join(ROOT, 'poster.jpg'), type: 'jpeg', quality: 90 });
await browser.close();
server.close();
console.log(`poster.jpg written (1280x720)`);
