// 录制真实玩法 → webm（ffmpeg 转 game.gif 用）
// 用法：node tools/record-gif.mjs [out.webm] [levelIndex] [seed]
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
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
    const data = await readFile(file);
    res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream' });
    res.end(data);
  } catch { res.writeHead(404); res.end(); }
});
await new Promise((r) => server.listen(8161, r));

const out = process.argv[2] || 'tests/artifacts/gameplay.webm';
const levelIdx = Number(process.argv[3] ?? 0);
const seed = Number(process.argv[4] ?? 7);

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, recordVideo: { dir: dirname(join(ROOT, out)), size: { width: 1280, height: 720 } } });
const page = await ctx.newPage();
await page.goto('http://127.0.0.1:8161/');
await page.waitForTimeout(700);
await page.evaluate(([lv, sd]) => {
  window.__ll.debug.setTutorialDone(true);
  window.__ll.debug.startSeeded(lv, sd);
}, [levelIdx, seed]);
await page.waitForTimeout(600);
// 连续点击最大群，展示核心动作（点击→爆破→连锁→升空）
for (let i = 0; i < 14; i += 1) {
  const ok = await page.evaluate(() => window.__ll.debug.popLargest());
  if (!ok) break;
  await page.waitForTimeout(300);
}
await page.waitForTimeout(900);
const video = page.video();
await ctx.close().catch(() => {});
try {
  const recorded = await video.path();
  await import('node:fs/promises').then((fs) => fs.copyFile(recorded, join(ROOT, out)));
  console.log('saved', out);
} catch (e) { console.error('video save failed:', e.message); }
await browser.close().catch(() => {});
server.closeAllConnections?.();
server.close();
process.exit(0);
