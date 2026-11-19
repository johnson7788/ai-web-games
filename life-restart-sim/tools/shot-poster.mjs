// 生成 poster.jpg（1280×720，截游戏标题屏，用完即关服务）。
// 运行：node tools/shot-poster.mjs
import { loadPlaywright, serve } from '../../../skills/webgame-playbook/scripts/_lib.mjs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const { chromium } = loadPlaywright();
const { server, port } = await serve(ROOT, 8240);

const browser = await chromium.launch({
  headless: true,
  args: ['--use-gl=angle', '--use-angle=metal', '--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'load', timeout: 20000 });
await page.waitForFunction(() => typeof window.__ll !== 'undefined', { timeout: 15000 });
await page.waitForTimeout(1200);

await page.screenshot({ path: join(ROOT, 'poster.jpg'), type: 'jpeg', quality: 90 });

// 附赠一张人生界面图，便于人工抽查
await page.evaluate(() => { window.__ll.debug.setTutorialDone(true); window.__ll.start(); });
await page.waitForTimeout(300);
await page.evaluate(() => window.__ll.debug.pickBestTalents());
await page.evaluate(() => window.__ll.debug.autoAllocate());
await page.evaluate(() => window.__ll.debug.startLife());
await page.waitForTimeout(300);
await page.evaluate(() => window.__ll.debug.advanceTo(10));
await page.waitForTimeout(300);
await page.screenshot({ path: join(ROOT, 'tests', 'artifacts', 'life.png') });

await browser.close();
server.close();
console.log('poster.jpg written');
