// tools/screenshots.mjs — 截图到 tests/final（供 vision-review / 报告用）
// 用法：node tools/screenshots.mjs
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
await new Promise((r) => server.listen(8162, '127.0.0.1', r));

const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=metal', '--autoplay-policy=no-user-gesture-required'] });

async function jumpTo(page, band) {
  await page.evaluate((b) => window.__ll.run.jumpToBand(b), band);
}

async function main() {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage();
  await page.goto('http://127.0.0.1:8162/');
  await page.waitForFunction(() => !!window.__ll);
  await page.waitForTimeout(700);

  await page.screenshot({ path: join(OUT, '01-title.png') });

  await page.click('#btn-start');
  await page.waitForTimeout(700);
  await page.evaluate(() => window.__ll.debug.setTutorialDone());
  await page.waitForTimeout(1200);
  await page.screenshot({ path: join(OUT, '02-play.png') });

  // 果味车间后期（带 3：移动环）
  await page.evaluate(() => window.__ll.debug.freeze(true));
  await jumpTo(page, 3);
  await page.waitForTimeout(200);
  await page.screenshot({ path: join(OUT, '03-fruity.png') });

  // 薄荷库（带 5）
  await jumpTo(page, 5);
  await page.waitForTimeout(200);
  await page.screenshot({ path: join(OUT, '04-mint.png') });

  // 夜光仓（带 9）
  await jumpTo(page, 9);
  await page.waitForTimeout(200);
  await page.screenshot({ path: join(OUT, '05-glow.png') });
  await page.evaluate(() => window.__ll.debug.freeze(false));

  // 死亡结算
  await page.evaluate(() => {
    const r = window.__ll.run;
    for (let k = 0; k < 60 * 400 && r.phase === 'playing'; k += 1) {
      r.step({ steerX: 640 });
      r.drainEvents();
    }
  });
  await page.waitForTimeout(600);
  await page.screenshot({ path: join(OUT, '06-dead.png') });

  await ctx.close();

  // 移动端
  const mctx = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const mp = await mctx.newPage();
  await mp.goto('http://127.0.0.1:8162/');
  await mp.waitForFunction(() => !!window.__ll);
  await mp.waitForTimeout(700);
  await mp.click('#btn-start');
  await mp.waitForTimeout(700);
  await mp.evaluate(() => window.__ll.debug.setTutorialDone());
  await mp.waitForTimeout(1200);
  await mp.screenshot({ path: join(OUT, '07-mobile.png') });
  await mctx.close();

  console.log('screenshots written to tests/final');
}

await main();
await browser.close();
server.closeAllConnections?.();
server.close();
process.exit(0);
