// 生成用于 vision-review 的真实运行截图（含球体/结算/特性场景）。
// 自起 http 服务 → 用 __ll.debug 摆好每张场景 → Playwright 截图 → 退出。
// 用法：node tools/scene-shots.mjs
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import pw from '/opt/homebrew/lib/node_modules/playwright/index.js';
const { chromium } = pw;

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.json': 'application/json' };
const server = createServer(async (req, res) => {
  try {
    const url = decodeURIComponent((req.url || '/').split('?')[0]);
    const file = join(ROOT, normalize(url === '/' ? 'index.html' : url));
    if (!file.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
    const data = await readFile(file);
    res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream' });
    res.end(data);
  } catch { res.writeHead(404); res.end(); }
});
await new Promise((r) => server.listen(8199, r));

const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=metal', '--autoplay-policy=no-user-gesture-required'] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await ctx.newPage();
await page.goto('http://127.0.0.1:8199/');
await page.waitForTimeout(700);
await page.evaluate(() => window.__ll.debug.setTutorialDone(true));

async function shot(name) {
  await page.waitForTimeout(350);
  await page.screenshot({ path: join(ROOT, 'tests/final', name) });
  console.log('shot', name);
}

// 投放 n 枚球并让其落定（spread = 均匀摊开 / 否则中心堆叠）
const dropN = (n, spread) => page.evaluate(({ count, sp }) => {
  const r = window.__ll.run();
  if (!r) return;
  const k = r.state.kiln;
  const settle = () => {
    let g = 0;
    while (r.state.balls.some((b) => !b.sleeping) && g++ < 4000) r.step(1 / 60);
  };
  for (let d = 0; d < count; d += 1) {
    let g = 0;
    while ((!r.state.held || r.state.balls.some((b) => !b.sleeping)) && g++ < 4000) r.step(1 / 60);
    if (!r.state.held || r.state.phase !== 'playing') break;
    const rr = r.state.held.r;
    const x = sp
      ? k.left + rr + (k.right - k.left - 2 * rr) * (d % 7) / 6
      : (k.left + k.right) / 2 + (d % 3 - 1) * 70;
    r.setDropX(x);
    r.drop();
    settle();
  }
}, { count: n, sp: spread });

await page.waitForTimeout(500);
await shot('01-title.png');

await page.evaluate(() => window.__ll.debug.startSeeded(0, 3));
await dropN(9, false);
await shot('02-playing.png');

await page.evaluate(() => window.__ll.debug.startSeeded(0, 3));
await page.evaluate(() => window.__ll.debug.autoPlaceSolution());
await page.waitForTimeout(900);
await shot('03-result.png');

await page.evaluate(() => window.__ll.debug.startSeeded(4, 3));
await dropN(10, true);
await shot('04-frozen.png');

await page.evaluate(() => window.__ll.debug.startSeeded(8, 3));
await dropN(10, true);
await shot('05-night.png');

// 移动端：844×390 触屏
const mctx = await browser.newContext({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
const mp = await mctx.newPage();
await mp.goto('http://127.0.0.1:8199/');
await mp.waitForTimeout(700);
await mp.evaluate(() => window.__ll.debug.setTutorialDone(true));
await mp.evaluate(() => window.__ll.debug.startSeeded(0, 3));
await dropN(6, false);
await mp.waitForTimeout(300);
await mp.screenshot({ path: join(ROOT, 'tests/final', '06-m-playing.png') });
await mctx.close();

await ctx.close();
await browser.close();
server.closeAllConnections?.();
server.close();
console.log('done');
process.exit(0);
