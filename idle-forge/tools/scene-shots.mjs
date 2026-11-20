// 生成 tests/final/*.png 验收截图（标题/玩法/三场景/结算/移动端）。
// 用法：node tools/scene-shots.mjs
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync, mkdirSync } from 'node:fs';
import { extname, join, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import pw from '/opt/homebrew/lib/node_modules/playwright/index.js';
const { chromium } = pw;

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'tests', 'final');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.json': 'application/json' };
mkdirSync(OUT, { recursive: true });

const server = createServer(async (req, res) => {
  try {
    const url = decodeURIComponent((req.url || '/').split('?')[0]);
    const file = join(ROOT, normalize(url === '/' ? 'index.html' : url));
    if (!file.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
    if (!existsSync(file)) { res.writeHead(404); res.end(); return; }
    const data = await readFile(file);
    res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream' });
    res.end(data);
  } catch { res.writeHead(404); res.end(); }
});
await new Promise((r) => server.listen(8151, r));

const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=metal'] });

async function shot(page, name) {
  await page.screenshot({ path: join(OUT, name) });
  console.log('shot', name);
}

// ---- 桌面 1280×720 ----
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage();
  await page.goto('http://127.0.0.1:8151/');
  await page.waitForFunction(() => typeof window.__ll !== 'undefined');
  await page.waitForTimeout(600);
  await page.evaluate(() => window.__ll.debug.setTutorialDone(true));
  await shot(page, '01-title.png');

  // 玩法（L1 乡村）
  await page.evaluate(() => window.__ll.debug.startSeeded(0, 3));
  await page.waitForTimeout(1600);
  await shot(page, '02-playing.png');

  // L3 材料短缺
  await page.evaluate(() => window.__ll.debug.loadLevel(2));
  await page.waitForTimeout(1200);
  await shot(page, '03-shortage.png');

  // L4 城塞工坊
  await page.evaluate(() => window.__ll.debug.loadLevel(3));
  await page.waitForTimeout(1200);
  await shot(page, '04-castle.png');

  // L5 炉候窗口（等 5s 窗口开启）
  await page.evaluate(() => window.__ll.debug.loadLevel(4));
  await page.waitForTimeout(5600);
  await shot(page, '05-furnace.png');

  // L6 稀有矿脉
  await page.evaluate(() => window.__ll.debug.loadLevel(5));
  await page.waitForTimeout(1200);
  await shot(page, '06-vein.png');

  // L7 火山锻窑
  await page.evaluate(() => window.__ll.debug.loadLevel(6));
  await page.waitForTimeout(1200);
  await shot(page, '07-volcano.png');

  // 结算（终章 win）
  await page.evaluate(() => { window.__ll.debug.startSeeded(11, 9); window.__ll.debug.fastForward(); });
  await page.waitForTimeout(500);
  await shot(page, '08-result.png');

  // 中文标题
  await page.evaluate(() => window.__ll.home());
  await page.waitForTimeout(300);
  await page.evaluate(() => { const s = document.getElementById('lang-select'); s.value = 'zh'; s.dispatchEvent(new Event('change', { bubbles: true })); });
  await page.waitForTimeout(300);
  await shot(page, '09-title-zh.png');
  await ctx.close();
}

// ---- 移动端 844×390 ----
{
  const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true });
  const page = await ctx.newPage();
  await page.goto('http://127.0.0.1:8151/');
  await page.waitForFunction(() => typeof window.__ll !== 'undefined');
  await page.waitForTimeout(500);
  await page.evaluate(() => window.__ll.debug.setTutorialDone(true));
  await shot(page, '10-m-title.png');
  await page.evaluate(() => window.__ll.debug.startSeeded(0, 3));
  await page.waitForTimeout(1200);
  await shot(page, '11-m-playing.png');
  await ctx.close();
}

await browser.close();
server.closeAllConnections?.();
server.close();
console.log('done');
process.exit(0);
