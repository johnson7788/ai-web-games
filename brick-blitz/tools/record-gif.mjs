// BRICK BLITZ · 录制真实玩法 → webm（ffmpeg 转 game.gif 用）。
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
await new Promise((r) => server.listen(8152, r));

const out = process.argv[2] || 'tests/artifacts/gameplay.webm';
const levelIdx = Number(process.argv[3] ?? 0);
const seed = Number(process.argv[4] ?? 5);

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=metal'] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, recordVideo: { dir: dirname(join(ROOT, out)), size: { width: 1280, height: 720 } } });
const page = await ctx.newPage();
await page.goto('http://127.0.0.1:8152/');
await page.waitForTimeout(700);
await page.evaluate(([lv, sd]) => {
  window.__ll.debug.setTutorialDone(true);
  window.__ll.debug.startSeeded(lv, sd);
  window.__ll.run().launch();
  // 自动挡板：跟随陶珠 + 轻微扫掠，制造真实击打画面
  const t0 = Date.now();
  window.__gifAuto = setInterval(() => {
    const r = window.__ll.run();
    if (!r || r.state.phase !== 'playing') return;
    const b = r.state.balls.find((x) => !x.dead);
    if (!b) return;
    const s = r.state;
    const bias = Math.sin((Date.now() - t0) / 420) * 46;
    r.setPaddleTarget(b.x + bias - s.paddle.w / 2);
  }, 16);
}, [levelIdx, seed]);
await page.waitForTimeout(5200);
await page.evaluate(() => clearInterval(window.__gifAuto));
try { await page.video().saveAs(out); } catch (e) { console.error('saveAs failed:', e.message); }
await ctx.close().catch(() => {});
await browser.close().catch(() => {});
server.closeAllConnections?.();
server.close();
console.log('saved', out);
process.exit(0);
