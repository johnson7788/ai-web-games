// 生成 tests/final/ 的 8 张验收截图（vision-review 前 8 张，按字母序）。
// 驱动 __ll 调试钩子进入真实状态后截图；自起 http 服务、用完即关。
// 用法：node tools/make-shots.mjs
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import pw from '/opt/homebrew/lib/node_modules/playwright/index.js';
const { chromium } = pw;

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'tests', 'final');
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
await new Promise((r) => server.listen(8161, r));

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=metal', '--autoplay-policy=no-user-gesture-required'] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await ctx.newPage();
await page.goto('http://127.0.0.1:8161/');
await page.waitForTimeout(700);
await page.evaluate(() => window.__ll.debug.setTutorialDone(true));

const shot = async (name) => {
  await page.screenshot({ path: join(OUT, name) });
  console.log('shot', name);
};

// 1. 标题屏
await page.evaluate(() => window.__ll.home());
await page.waitForTimeout(400);
await shot('01-title.png');

// 命中 t 之前所有真实 note，保证不扣血、不弹 MISS（只用于截图状态）。
const PLAY_TO = `(t) => {
  const run = window.__ll.run();
  const REAL = new Set(['tap','hold','slide','slideEnd']);
  const real = run.state.notes.filter(n => REAL.has(n.kind) && n.time < t - 0.001);
  const stepTo = (tt) => {
    let g = 0;
    while (run.state.phase === 'countdown' && g++ < 500) run.step(1 / 60);
    g = 0;
    while (run.state.time < tt && run.state.phase === 'playing' && g++ < 200000) run.step(Math.min(1 / 60, tt - run.state.time));
  };
  for (const n of real) { stepTo(n.time); run.tap(n.track); }
  stepTo(t);
}`;

// 2. 游戏进行中（多轨 note 下落，干净的双轨交替）
await page.evaluate(`window.__ll.debug.startSeeded(1, 5); (${PLAY_TO})(3.2); window.__ll.debug.freeze();`);
await page.waitForTimeout(100);
await shot('02-playing.png');

// 3. Perfect 命中特效
await page.evaluate(() => {
  window.__ll.debug.startSeeded(0, 5);
  const run = window.__ll.run();
  const REAL = new Set(['tap', 'hold', 'slide', 'slideEnd']);
  const n = run.state.notes.find((x) => REAL.has(x.kind));
  window.__ll.debug.seek(n.time);
  run.tap(n.track);
});
await page.waitForTimeout(90);
await shot('03-perfect.png');

// 4. 长按 note
await page.evaluate(`window.__ll.debug.startSeeded(2, 5); const run = window.__ll.run(); const hold = run.state.notes.find(n => n.kind === 'hold'); (${PLAY_TO})(hold.time - 0.28); window.__ll.debug.freeze();`);
await page.waitForTimeout(100);
await shot('04-hold.png');

// 5. 律动模式（连续 8 Perfect 后，前景仍有 note 下落）
await page.evaluate(() => {
  window.__ll.debug.startSeeded(5, 5);
  const run = window.__ll.run();
  const REAL = new Set(['tap', 'hold', 'slide', 'slideEnd']);
  const real = run.state.notes.filter((n) => REAL.has(n.kind));
  const stepTo = (t) => {
    let g = 0;
    while (run.state.phase === 'countdown' && g++ < 500) run.step(1 / 60);
    g = 0;
    while (run.state.time < t && run.state.phase === 'playing' && g++ < 200000) run.step(Math.min(1 / 60, t - run.state.time));
  };
  for (let i = 0; i < 8; i += 1) { stepTo(real[i].time); run.tap(real[i].track); }
  stepTo(real[8].time - 0.7);
  window.__ll.debug.freeze();
});
await page.waitForTimeout(100);
await shot('05-groove.png');

// 6. 天台电音场景
await page.evaluate(`window.__ll.debug.startSeeded(5, 5); (${PLAY_TO})(3.0); window.__ll.debug.freeze();`);
await page.waitForTimeout(100);
await shot('06-rooftop.png');

// 7. 深夜地铁场景
await page.evaluate(`window.__ll.debug.loadLevel(8); (${PLAY_TO})(3.0); window.__ll.debug.freeze();`);
await page.waitForTimeout(100);
await shot('07-subway.png');

// 8. 胜利结算
await page.evaluate(() => { window.__ll.debug.startSeeded(0, 5); window.__ll.debug.autoPlay(); });
await page.waitForTimeout(400);
await shot('08-result.png');

await browser.close();
server.closeAllConnections?.();
server.close();
console.log('done →', OUT);
process.exit(0);
