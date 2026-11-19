// 生成 poster.jpg（1280×720）：用 playwright 截游戏里最好看的画面（霓虹网格战斗屏）。
// 自带静态服务，用完即关。运行：node tools/poster.mjs
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadPlaywright, serve, waitForBoot } from '../../../skills/webgame-playbook/scripts/_lib.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { server, port } = await serve(ROOT, 8270);
const { chromium } = loadPlaywright();
const browser = await chromium.launch({
  headless: true,
  args: ['--use-gl=angle', '--use-angle=metal', '--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'load', timeout: 20000 });
await waitForBoot(page, 10000);

// 进入游戏并制造一个有反馈的画面（点对 + 点异类 + 连击），再截战斗屏
await page.evaluate(() => window.__ll.start());
await page.waitForTimeout(600);
await page.evaluate(() => {
  const r = window.__ll.run;
  const i = r.items.findIndex((it) => it.cat === r.task.cat && !it.collected && !it.odd);
  if (i >= 0) r.tap(i);
  const o = r.items.findIndex((it) => it.odd && !it.oddResolved);
  if (o >= 0) r.tap(o);
});
await page.waitForTimeout(450);

const out = path.join(ROOT, 'poster.jpg');
await page.screenshot({ path: out, type: 'jpeg', quality: 90 });
console.log(`✓ poster.jpg written: ${out}`);

await browser.close();
server.close();
