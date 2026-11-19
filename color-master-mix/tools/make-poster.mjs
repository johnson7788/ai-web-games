// COLOR MASTER MIX · 生成 poster.jpg（1280×720）：服务起来、把「脉冲蝶」涂成彩虹、截最漂亮的一帧。
// 运行：node tools/make-poster.mjs
import { serve, loadPlaywright } from '../../../skills/webgame-playbook/scripts/_lib.mjs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const { server, port } = await serve(ROOT, 8270);
const { chromium } = loadPlaywright();

const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=metal'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(e.message));

await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'load', timeout: 20000 });
await page.waitForFunction(() => typeof window.__ll !== 'undefined', { timeout: 15000 });
await page.waitForTimeout(500);

await page.evaluate(() => {
  window.__ll.start(6); // 脉冲蝶（51 分格，最饱满）
  const r = window.__ll.run;
  let guard = 0;
  while (r.state.phase === 'playing' && guard < 2000) {
    const t = r.regions.find((x) => !x.colored && x.unlocked);
    if (!t) break;
    const idx = (t.r + t.c) % 64;
    r.selectFamily(Math.floor(idx / 8));
    r.selectShade(idx % 8);
    r.tap(t.id);
    guard += 1;
  }
});
await page.waitForTimeout(400);

await page.screenshot({ path: join(ROOT, 'poster.jpg'), type: 'jpeg', quality: 88 });
console.log(`✓ poster.jpg 写入（errors=${errors.length}）`);
if (errors.length) console.error(errors.join('\n'));

await browser.close();
server.close();
