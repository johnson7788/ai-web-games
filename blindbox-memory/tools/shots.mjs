#!/usr/bin/env node
// 全套验收截图：标题 / 牌局（多关） / 图鉴 / 过关 / 失败 / 移动端
import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const { chromium } = require('/opt/homebrew/lib/node_modules/playwright');

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webp': 'image/webp', '.mp3': 'audio/mpeg', '.png': 'image/png' };

function serve(dir) {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      let file = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
      if (file === '/' || file.endsWith('/')) file += 'index.html';
      fs.readFile(path.join(dir, file), (err, data) => {
        if (err) { res.writeHead(404); res.end('nf'); return; }
        res.writeHead(200, { 'Content-Type': MIME[path.extname(file).toLowerCase()] || 'application/octet-stream' });
        res.end(data);
      });
    });
    server.listen(0, () => resolve({ server, port: server.address().port }));
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const outDir = path.join(root, 'tests/final');
fs.mkdirSync(outDir, { recursive: true });

const { server, port } = await serve(root);
const browser = await chromium.launch({
  headless: true,
  args: ['--use-gl=angle', '--use-angle=metal', '--autoplay-policy=no-user-gesture-required'],
});
const errors = [];

async function shotPage(width, height, name) {
  const context = await browser.newContext({ viewport: { width, height } });
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push(`${name}: pageerror ${e}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`${name}: console ${m.text()}`); });
  await page.goto(`http://localhost:${port}/`);
  await page.waitForFunction(() => window.__ll && window.__ll.state.phase === 'title', null, { timeout: 15000 });
  return { context, page };
}

// ---- 桌面 1280×720 ----
{
  const { context, page } = await shotPage(1280, 720, 'desktop');
  await sleep(1000);
  await page.screenshot({ path: path.join(outDir, '01-title.png') });

  // L1 牌局（教学引导自动弹出）
  await page.evaluate(() => window.__ll.start(1));
  await sleep(600);
  await page.evaluate(() => window.__ll.tutorial.skip());
  await sleep(300);
  await page.screenshot({ path: path.join(outDir, '02-level1.png') });

  // 翻几张牌
  await page.evaluate(() => {
    const run = window.__ll.run;
    const seen = new Map();
    for (const c of run.deck) { if (!seen.has(c.char)) seen.set(c.char, c.id); }
    const first = seen.values().next().value;
    const twin = run.deck.find((c) => c.char === run.deck[first].char && c.id !== first);
    window.G.ui.cardEl(first).click();
    window.G.ui.cardEl(twin.id).click();
  });
  await sleep(400);
  await page.screenshot({ path: path.join(outDir, '03-level1-matched.png') });

  // L3 星卡关
  await page.evaluate(() => window.__ll.start(3));
  await sleep(500);
  await page.evaluate(() => {
    // 翻开星卡对
    const run = window.__ll.run;
    const star = run.deck.find((c) => c.kind === 'star');
    const twin = run.deck.find((c) => c.char === star.char && c.id !== star.id);
    window.G.ui.cardEl(star.id).click();
    window.G.ui.cardEl(twin.id).click();
  });
  await sleep(500);
  await page.screenshot({ path: path.join(outDir, '04-level3-star.png') });

  // L4 障碍关
  await page.evaluate(() => window.__ll.start(4));
  await sleep(500);
  await page.screenshot({ path: path.join(outDir, '05-level4-obstacle.png') });

  // L12 Boss 关
  await page.evaluate(() => window.__ll.start(12));
  await sleep(500);
  await page.screenshot({ path: path.join(outDir, '06-level12-boss.png') });

  // 图鉴
  await page.evaluate(() => { document.getElementById('btn-pause').click(); });
  await sleep(200);
  await page.evaluate(() => { document.getElementById('btn-quit').click(); });
  await sleep(200);
  await page.evaluate(() => document.getElementById('btn-collection').click());
  await sleep(400);
  await page.screenshot({ path: path.join(outDir, '07-collection.png') });

  // 商店
  await page.evaluate(() => { document.getElementById('btn-collection-back').click(); });
  await sleep(200);
  await page.evaluate(() => document.getElementById('btn-shop').click());
  await sleep(400);
  await page.screenshot({ path: path.join(outDir, '08-shop.png') });
  await context.close();
}

// ---- 过关 / 失败 面板 ----
{
  const { context, page } = await shotPage(1280, 720, 'panels');
  await page.evaluate(() => window.__ll.start(1));
  await sleep(400);
  // 直接用 sim 完美通关（截图用途）
  await page.evaluate(() => {
    const run = window.__ll.run;
    const byChar = new Map();
    const order = [];
    for (const c of run.deck) {
      if (c.kind === 'obstacle') continue;
      if (!byChar.has(c.char)) byChar.set(c.char, []);
      byChar.get(c.char).push(c.id);
    }
    for (const ids of byChar.values()) order.push(...ids);
    for (const id of order) window.G.ui.cardEl(id).click();
  });
  await sleep(900);
  await page.screenshot({ path: path.join(outDir, '09-win.png') });
  await context.close();
}
{
  const { context, page } = await shotPage(1280, 720, 'fail');
  await page.evaluate(() => window.__ll.start(2));
  await sleep(400);
  await page.evaluate(() => {
    const run = window.__ll.run;
    // 疯狂误配烧完步数
    const chars = [...new Set(run.deck.filter((c) => c.kind !== 'obstacle').map((c) => c.char))];
    let i = 0;
    while (window.__ll.run.phase === 'playing' && i < 200) {
      const c1 = run.deck.find((c) => c.state === 'down' && c.char === chars[0] && c.kind !== 'obstacle');
      const c2 = run.deck.find((c) => c.state === 'down' && c.char !== chars[0] && c.kind !== 'obstacle');
      if (!c1 || !c2) break;
      window.G.ui.cardEl(c1.id).click();
      window.G.ui.cardEl(c2.id).click();
      i += 2;
    }
  });
  await sleep(900);
  await page.screenshot({ path: path.join(outDir, '10-fail.png') });
  await context.close();
}

// ---- 移动端 844×390 ----
{
  const { context, page } = await shotPage(844, 390, 'mobile');
  await sleep(800);
  await page.screenshot({ path: path.join(outDir, '11-mobile-title.png') });
  await page.evaluate(() => window.__ll.start(1));
  await sleep(500);
  await page.evaluate(() => window.__ll.tutorial.skip());
  await page.evaluate(() => {
    const run = window.__ll.run;
    const seen = new Map();
    for (const c of run.deck) { if (!seen.has(c.char)) seen.set(c.char, c.id); }
    const first = seen.values().next().value;
    const twin = run.deck.find((c) => c.char === run.deck[first].char && c.id !== first);
    window.G.ui.cardEl(first).click();
    window.G.ui.cardEl(twin.id).click();
  });
  await sleep(400);
  await page.screenshot({ path: path.join(outDir, '12-mobile-game.png') });
  await context.close();
}

await browser.close();
server.close();
console.log(JSON.stringify({ shots: fs.readdirSync(outDir).filter((f) => f.endsWith('.png')), errors }));
process.exit(errors.length ? 1 : 0);
