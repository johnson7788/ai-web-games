// 生成上线物料：poster.jpg(1280×720) / poster-1920.jpg(1920×1080) / 玩法截图（供 icon 裁切）。
// 用法：node tools/poster.mjs
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { extname, join, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import pw from '/opt/homebrew/lib/node_modules/playwright/index.js';
const { chromium } = pw;

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.json': 'application/json' };
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
await new Promise((r) => server.listen(8161, r));

const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=metal'] });

async function makePoster(dsf, out) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: dsf });
  const page = await ctx.newPage();
  await page.goto('http://127.0.0.1:8161/');
  await page.waitForFunction(() => typeof window.__ll !== 'undefined');
  await page.waitForTimeout(600);
  await page.evaluate(() => {
    // 海报：隐藏交互控件，放大标题，加一句副标语
    const start = document.getElementById('btn-start');
    const lang = document.getElementById('lang-select');
    if (start) start.style.display = 'none';
    if (lang) lang.style.display = 'none';
    const t = document.getElementById('title-text');
    if (t) { t.style.fontSize = '5.4rem'; t.style.marginTop = '60px'; }
    const sub = document.getElementById('subtitle-text');
    if (sub) sub.textContent = 'Forge endless gear. Grow an empire of apprentices.';
  });
  await page.waitForTimeout(400);
  await page.screenshot({ path: join(ROOT, out) });
  await ctx.close();
  console.log('wrote', out);
}

async function makeIconSrc() {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage();
  await page.goto('http://127.0.0.1:8161/');
  await page.waitForFunction(() => typeof window.__ll !== 'undefined');
  await page.waitForTimeout(500);
  await page.evaluate(() => { window.__ll.debug.setTutorialDone(true); window.__ll.debug.startSeeded(3, 7); });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: join(ROOT, 'tests', 'artifacts', 'icon-src.png') });
  await ctx.close();
  console.log('wrote tests/artifacts/icon-src.png');
}

await makePoster(1, 'poster.jpg');
await makePoster(1.5, 'poster-1920.jpg');
await makeIconSrc();

await browser.close();
server.closeAllConnections?.();
server.close();
console.log('done');
process.exit(0);
