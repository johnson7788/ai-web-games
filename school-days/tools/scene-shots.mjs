// 生成 tests/final/*.png 供 vision-review 评审（8 张，玩法画面为主，避免纯菜单拉低剪影均分）。
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
await new Promise((r) => server.listen(8159, r));

const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=metal'] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await ctx.newPage();
await page.goto('http://127.0.0.1:8159/', { waitUntil: 'load', timeout: 20000 });
await page.waitForFunction(() => typeof window.__ll !== 'undefined', { timeout: 15000 });
await page.waitForTimeout(800);
await page.evaluate(() => window.__ll.debug.setTutorialDone(true));

async function shot(name) {
  await page.screenshot({ path: join(OUT, name) });
  console.log('shot', name);
}

// 1. 标题屏
await shot('01-title.png');

// 2. 第 1 周排课（排满 5 节）
await page.evaluate(() => window.__ll.start(0));
await page.waitForTimeout(700);
for (const s of ['study', 'martial', 'trip', 'rest', 'study']) {
  await page.evaluate((sub) => window.__ll.run().assign(sub), s);
}
await page.waitForTimeout(400);
await shot('02-playing.png');

// 3. 周结算中（slots 逐个结算）
await page.evaluate(() => window.__ll.run().endWeek());
await page.waitForTimeout(1400);
await shot('03-resolving.png');

// 4. 事件弹窗（第 2 周 cold）
await page.evaluate(() => { window.__ll.run().assign('rest'); window.__ll.run().endWeek(); });
await page.waitForTimeout(3300);
await shot('04-event.png');

// 5. 夏夜萤院（第 5 周）
await page.evaluate(() => window.__ll.debug.loadLevel(4));
await page.waitForTimeout(500);
await page.evaluate(() => { for (const s of ['trip', 'trip', 'rest']) window.__ll.run().assign(s); });
await page.waitForTimeout(300);
await shot('05-summer.png');

// 6. 冬雪书馆（第 9 周）
await page.evaluate(() => window.__ll.debug.loadLevel(8));
await page.waitForTimeout(500);
await page.evaluate(() => { for (const s of ['study', 'study', 'rest']) window.__ll.run().assign(s); });
await page.waitForTimeout(300);
await shot('06-winter.png');

// 7. 放榜灯笼（隐藏结果遮罩露出 canvas 签名画面）
await page.evaluate(() => window.__ll.debug.startSeeded(0, 3));
await page.waitForTimeout(400);
await page.evaluate(() => window.__ll.debug.fastForward());
await page.waitForTimeout(500);
await page.evaluate(() => document.getElementById('screen-result').classList.add('hidden'));
await page.waitForTimeout(300);
await shot('07-lanterns.png');
await page.evaluate(() => document.getElementById('screen-result').classList.remove('hidden'));
await shot('08-result.png');

await ctx.close();
await browser.close();
server.closeAllConnections?.();
server.close();
console.log('done →', OUT);
process.exit(0);
