// 生成 tests/final 验收截图（标题 / 玩法 / 结算 / 移动端 / 中文标题），供 vision-review 与报告引用。
// 用法：node tools/shots-final.mjs
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { mkdirSync } from 'node:fs';
import { extname, join, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import pw from '/opt/homebrew/lib/node_modules/playwright/index.js';
const { chromium } = pw;

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'tests/final');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.json': 'application/json' };
mkdirSync(OUT, { recursive: true });
const server = createServer(async (req, res) => {
  try {
    const url = decodeURIComponent((req.url || '/').split('?')[0]);
    let file = join(ROOT, normalize(url === '/' ? 'index.html' : url));
    if (!file.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
    const data = await readFile(file);
    res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream' });
    res.end(data);
  } catch { res.writeHead(404); res.end(); }
});
await new Promise((r) => server.listen(8167, r));

const browser = await chromium.launch();
async function newPage(viewport) {
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  await page.goto('http://127.0.0.1:8167/', { waitUntil: 'load' });
  await page.waitForFunction(() => window.__ll && window.__ll.state?.phase !== 'boot', { timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(400);
  return { ctx, page };
}

// 1) 标题屏（英文）
{
  const { ctx, page } = await newPage({ width: 1280, height: 720 });
  await page.screenshot({ path: join(OUT, '01-title.png') });
  await ctx.close();
}

// 2) 玩法：播种开局，实时追吃 2s，让洞长大一圈再截
{
  const { ctx, page } = await newPage({ width: 1280, height: 720 });
  await page.evaluate(() => {
    window.__ll.debug.setTutorialDone();
    window.__ll.debug.startSeeded(123);
  });
  for (let i = 0; i < 9; i += 1) {
    await page.evaluate(() => {
      const r = window.__ll.run;
      if (!r || r.phase !== 'playing' || !r.player.alive) return;
      let best = null; let bestD = Infinity;
      for (const o of r.objects) {
        if (o.r >= r.player.r * 0.9) continue;
        const d = Math.hypot(o.x - r.player.x, o.y - r.player.y);
        if (d < bestD) { bestD = d; best = o; }
      }
      if (best) window.__ll.debug.steerWorld(best.x, best.y);
    });
    await page.waitForTimeout(240);
  }
  await page.waitForTimeout(300);
  await page.screenshot({ path: join(OUT, '02-play.png') });
  await ctx.close();
}

// 3) 结算：放大后快进到本场结束（玩家夺冠 → 显示场间三选一成长）
{
  const { ctx, page } = await newPage({ width: 1280, height: 720 });
  await page.evaluate(() => {
    window.__ll.debug.setTutorialDone();
    window.__ll.debug.startSeeded(7);
    const r = window.__ll.run;
    r.player.mass = 3000;
    r.player.r = 150;
    for (let k = 0; k < 60 * 160 && r.phase === 'playing'; k += 1) {
      r.step({ steerX: r.player.x, steerY: r.player.y });
      r.drainEvents();
    }
  });
  await page.waitForTimeout(800);
  await page.screenshot({ path: join(OUT, '03-result.png') });
  await ctx.close();
}

// 4) 移动端玩法
{
  const { ctx, page } = await newPage({ width: 844, height: 390 });
  await page.evaluate(() => {
    window.__ll.debug.setTutorialDone();
    window.__ll.debug.startSeeded(456);
  });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: join(OUT, '04-mobile-play.png') });
  await ctx.close();
}

// 5) 中文标题
{
  const { ctx, page } = await newPage({ width: 1280, height: 720 });
  await page.evaluate(() => {
    window.__ll.setLang('zh');
  });
  await page.waitForTimeout(300);
  await page.screenshot({ path: join(OUT, '05-title-zh.png') });
  await ctx.close();
}

await browser.close().catch(() => {});
server.closeAllConnections?.();
server.close();
console.log('saved tests/final screenshots');
process.exit(0);
