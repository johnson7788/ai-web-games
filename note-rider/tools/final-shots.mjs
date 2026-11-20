// 生成 tests/final 的验收截图（1280×720 桌面 + 844×390 移动端），供 vision-review 评审。
// 用法：node tools/final-shots.mjs
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import pw from '/opt/homebrew/lib/node_modules/playwright/index.js';
const { chromium } = pw;

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'tests', 'final');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.json': 'application/json' };
mkdirSync(OUT, { recursive: true });

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
await new Promise((r) => server.listen(8153, r));

const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=metal', '--autoplay-policy=no-user-gesture-required'] });

// 桌面
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage();
  await page.goto('http://127.0.0.1:8153/');
  await page.waitForTimeout(900);
  await page.screenshot({ path: join(OUT, '01-title.png') });

  await page.evaluate(() => window.__ll.debug.setTutorialDone(true));
  // 中文标题
  await page.evaluate(() => { const s = document.getElementById('lang-select'); s.value = 'zh'; s.dispatchEvent(new Event('change', { bubbles: true })); });
  await page.waitForTimeout(300);
  await page.screenshot({ path: join(OUT, '06-title-zh.png') });
  await page.evaluate(() => { const s = document.getElementById('lang-select'); s.value = 'en'; s.dispatchEvent(new Event('change', { bubbles: true })); });
  await page.waitForTimeout(300);

  // 玩法：晨曦弦桥（单弦，note 逼近 + 落线）
  await page.evaluate(() => { window.__ll.debug.startSeeded(0, 3); window.__ll.run().state.beatClock = 2.8; });
  await page.waitForTimeout(500);
  await page.screenshot({ path: join(OUT, '02-playing.png') });

  // 雨夜琴城
  await page.evaluate(() => { window.__ll.debug.loadLevel(5); window.__ll.run().state.beatClock = 5.0; });
  await page.waitForTimeout(500);
  await page.screenshot({ path: join(OUT, '03-rain.png') });

  // 星海音阶
  await page.evaluate(() => { window.__ll.debug.loadLevel(8); window.__ll.run().state.beatClock = 5.0; });
  await page.waitForTimeout(500);
  await page.screenshot({ path: join(OUT, '04-star.png') });

  // 结算
  await page.evaluate(() => window.__ll.debug.startSeeded(0, 3));
  await page.waitForTimeout(200);
  await page.evaluate(() => window.__ll.debug.fastForward());
  await page.waitForTimeout(400);
  await page.screenshot({ path: join(OUT, '05-result.png') });

  await ctx.close();
}

// 移动端
{
  const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  await page.goto('http://127.0.0.1:8153/');
  await page.waitForTimeout(900);
  await page.screenshot({ path: join(OUT, '07-mobile-title.png') });
  await page.evaluate(() => { try { window.__ll.debug.setTutorialDone(true); } catch (e) {} });
  await page.evaluate(() => { window.__ll.debug.startSeeded(0, 3); window.__ll.run().state.beatClock = 2.8; });
  await page.waitForTimeout(500);
  await page.screenshot({ path: join(OUT, '08-mobile-playing.png') });
  await ctx.close();
}

await browser.close().catch(() => {});
server.closeAllConnections?.();
server.close();
console.log('wrote', OUT);
process.exit(0);
