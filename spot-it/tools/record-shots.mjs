// tools/record-shots.mjs — 生成 tests/final 验收截图（供 vision-review 与交付）。
// 命名刻意让前 8 张（字母序）是玩法截图：01-play..08-title；标题中文 09 排在后面。
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import pw from '/opt/homebrew/lib/node_modules/playwright/index.js';

const { chromium } = pw;
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'tests/final');
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
await new Promise((r) => server.listen(8149, r));

const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=metal', '--autoplay-policy=no-user-gesture-required'] });
const shot = (page, name) => page.screenshot({ path: join(OUT, name) });

async function boot(page) {
  await page.goto('http://127.0.0.1:8149/', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__ll && window.__ll.state.phase !== 'boot', { timeout: 10000 });
  await page.evaluate(() => localStorage.setItem('spot-it:tutorial-done', 'true'));
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__ll && window.__ll.state.phase !== 'boot', { timeout: 10000 });
}

// 把鼠标移到第一个未找到目标的客户坐标（手电扫过去，目标进光圈）
async function moveToTarget(page) {
  const c = await page.evaluate(() => {
    const r = window.__ll.run;
    const t = r && r.items.find((i) => i.isTarget && !i.found);
    if (!t) return null;
    const cv = document.getElementById('canvas');
    const rect = cv.getBoundingClientRect();
    const scale = Math.min(rect.width / 1280, rect.height / 720);
    const ox = (rect.width - 1280 * scale) / 2;
    const oy = (rect.height - 720 * scale) / 2;
    return { cx: rect.left + ox + t.x * scale, cy: rect.top + oy + t.y * scale };
  });
  if (c) await page.mouse.move(c.cx, c.cy);
}

async function targetXY(page) {
  return page.evaluate(() => {
    const r = window.__ll.run;
    const t = r && r.items.find((i) => i.isTarget && !i.found);
    return t ? { x: t.x, y: t.y } : null;
  });
}

// ---------- 桌面 ----------
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await ctx.newPage();
await boot(page);

// 标题（含预览物品，剪影可辨）
await shot(page, '08-title.png');
await page.evaluate(() => { const s = document.getElementById('lang-select'); s.value = 'zh'; s.dispatchEvent(new Event('change', { bubbles: true })); });
await page.waitForTimeout(250);
await shot(page, '09-title-zh.png');
await page.evaluate(() => { const s = document.getElementById('lang-select'); s.value = 'en'; s.dispatchEvent(new Event('change', { bubbles: true })); });
await page.waitForTimeout(250);

await page.click('#btn-start');
await page.waitForTimeout(500);
await moveToTarget(page);
await page.waitForTimeout(350);
await shot(page, '01-play.png');

// 找到一个目标（真实点击 → 绿色对勾）
let t = await targetXY(page);
if (t) { await page.mouse.click(t.x, t.y); await page.waitForTimeout(450); }
await shot(page, '02-found.png');

// 再找一个目标（第二个对勾，画面更丰富）
t = await targetXY(page);
if (t) { await page.mouse.click(t.x, t.y); await page.waitForTimeout(350); }
await moveToTarget(page);
await page.waitForTimeout(300);
await shot(page, '06-play2.png');

// 清完第 1 关（市场点亮动画）
for (let i = 0; i < 3; i += 1) {
  t = await targetXY(page);
  if (!t) break;
  await page.mouse.click(t.x, t.y);
  await page.waitForTimeout(300);
}
await page.waitForTimeout(150);
await shot(page, '03-levelup.png');

// 第 2 关玩法（新清单，闪到目标）
await moveToTarget(page);
await page.waitForTimeout(350);
await shot(page, '07-play3.png');

// 结算（失败）：重启 → 开局 → 快进到超时
await page.evaluate(() => window.__ll.restart());
await page.waitForTimeout(400);
await page.click('#btn-start');
await page.waitForTimeout(400);
await page.evaluate(() => { const r = window.__ll.run; for (let k = 0; k < 60 * 400 && r.phase === 'playing'; k += 1) { r.step({}); r.drainEvents(); } });
await page.waitForTimeout(700);
await shot(page, '04-result.png');
await ctx.close();

// ---------- 移动端 ----------
const mctx = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2 });
const mpage = await mctx.newPage();
await boot(mpage);
await mpage.click('#btn-start');
await mpage.waitForTimeout(700);
await moveToTarget(mpage);
await mpage.waitForTimeout(350);
await shot(mpage, '05-mobile.png');
await mctx.close();

await browser.close();
server.closeAllConnections?.();
server.close();
console.log('screenshots written to', OUT);
