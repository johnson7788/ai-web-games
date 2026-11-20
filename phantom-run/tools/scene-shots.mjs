// PHANTOM RUN · 生成 tests/final/ 的验收截图（供 vision-review）。
// 用法：node tools/scene-shots.mjs
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { mkdirSync } from 'node:fs';
import { extname, join, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import pw from '/opt/homebrew/lib/node_modules/playwright/index.js';
const { chromium } = pw;

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'tests', 'final');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.json': 'application/json' };
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
await new Promise((r) => server.listen(8157, r));
await mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=metal'] });

async function shot(page, name) {
  await page.screenshot({ path: join(OUT, name) });
  console.log('  shot', name);
}

// 冻结模拟 + 把玩家移到指定世界 x，让目标物进入取景框
async function pos(page, x) {
  await page.evaluate((X) => {
    window.__ll.debug.hold(true);
    const r = window.__ll.run();
    if (!r) return;
    r.state.player.x = X;
    r.state.player.y = 554;
    r.state.player.vy = 0;
    r.state.player.onGround = true;
    if (r.state.chase) r.state.chase.x = X - 240;
  }, x);
}
const release = (page) => page.evaluate(() => window.__ll.debug.hold(false));

// 桌面
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await ctx.newPage();
await page.goto('http://127.0.0.1:8157/');
await page.waitForTimeout(700);
await page.evaluate(() => window.__ll.debug.setTutorialDone(true));

await shot(page, '01-title.png');

await page.evaluate(() => window.__ll.debug.startSeeded(0, 3));
await pos(page, 600);
await page.waitForTimeout(80);
await shot(page, '02-playing.png');
await release(page);

await page.evaluate(() => { window.__ll.debug.startSeeded(0, 3); window.__ll.debug.fastForward(); });
await page.waitForTimeout(400);
await shot(page, '03-result.png');

await page.evaluate(() => window.__ll.debug.startSeeded(2, 3));
await pos(page, 1380);
await page.waitForTimeout(80);
await shot(page, '04-rune.png');
await release(page);

await page.evaluate(() => window.__ll.debug.startSeeded(3, 3));
await pos(page, 1180);
await page.waitForTimeout(80);
await shot(page, '05-wall.png');
await release(page);

await page.evaluate(() => window.__ll.debug.startSeeded(5, 3));
await pos(page, 1180);
await page.waitForTimeout(80);
await shot(page, '06-chase.png');
await release(page);

await page.evaluate(() => window.__ll.debug.startSeeded(8, 3));
await pos(page, 2800);
await page.waitForTimeout(80);
await shot(page, '07-dawn.png');
await release(page);

await ctx.close();

// 移动端
const mctx = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const mpage = await mctx.newPage();
await mpage.goto('http://127.0.0.1:8157/');
await mpage.waitForTimeout(600);
await mpage.evaluate(() => window.__ll.debug.setTutorialDone(true));
await mpage.evaluate(() => window.__ll.debug.startSeeded(0, 3));
await pos(mpage, 600);
await mpage.waitForTimeout(80);
await shot(mpage, '08-mobile.png');
await release(mpage);
await mctx.close();

await browser.close();
server.closeAllConnections?.();
server.close();
console.log('done →', OUT);
process.exit(0);
