// Shadow Ninja Cat · 生成 tests/final/ 视觉评审截图（标题/玩法/结算/三场景/移动端）。
// 用法：node tools/scene-shots.mjs
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';
import pw from '/opt/homebrew/lib/node_modules/playwright/index.js';
const { chromium } = pw;

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'tests', 'final');
mkdirSync(OUT, { recursive: true });
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
await new Promise((r) => server.listen(8167, r));

const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=metal', '--autoplay-policy=no-user-gesture-required'] });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
await page.goto('http://127.0.0.1:8167/');
await page.waitForFunction(() => typeof window.__ll !== 'undefined', { timeout: 15000 });
await page.waitForTimeout(700);

async function shot(name) {
  await page.screenshot({ path: join(OUT, name) });
  console.log('shot', name);
}

// 标题（含猫剪影 + 风铃尾迹）
await shot('01-title.png');

// 玩法（跳过倒计时，跑一段到跳跃）
await page.evaluate(() => {
  window.__ll.debug.setTutorialDone(true);
  window.__ll.debug.startSeeded(0, 3);
  const s = window.__ll.run().state;
  s.phase = 'playing';
  s.countdown = 0;
  window.__ll.debug.autoRun(200);
});
await page.waitForTimeout(200);
await shot('02-playing.png');

// 三场景玩法截图
for (const [level, name] of [[0, '04-scene-dusk.png'], [4, '05-scene-rain.png'], [8, '06-scene-moon.png']]) {
  await page.evaluate((lv) => {
    window.__ll.debug.setTutorialDone(true);
    window.__ll.debug.startSeeded(lv, 3);
    const s = window.__ll.run().state;
    s.phase = 'playing';
    s.countdown = 0;
    window.__ll.debug.autoRun(260);
  }, level);
  await page.waitForTimeout(200);
  await shot(name);
}

// 结算（通关）
await page.evaluate(() => {
  window.__ll.debug.setTutorialDone(true);
  window.__ll.debug.startSeeded(0, 3);
  window.__ll.debug.autoRun(6000);
});
await page.waitForTimeout(300);
await shot('03-result.png');

// 移动端
const mctx = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const mp = await mctx.newPage();
await mp.goto('http://127.0.0.1:8167/');
await mp.waitForFunction(() => typeof window.__ll !== 'undefined', { timeout: 15000 });
await mp.waitForTimeout(600);
await mp.evaluate(() => {
  window.__ll.debug.setTutorialDone(true);
  window.__ll.debug.startSeeded(0, 3);
  const s = window.__ll.run().state;
  s.phase = 'playing';
  s.countdown = 0;
  window.__ll.debug.autoRun(200);
});
await mp.waitForTimeout(200);
await mp.screenshot({ path: join(OUT, '07-mobile-playing.png') });
console.log('shot 07-mobile-playing.png');
await mctx.close();

await browser.close();
server.closeAllConnections?.();
server.close();
console.log('done →', OUT);
process.exit(0);
