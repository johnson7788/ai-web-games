// 录制真实玩法 → webm（随后用 ffmpeg palettegen/paletteuse 转 game.gif）
// 用法：node tools/record-gif.mjs [out.webm]
import { createServer } from 'node:http';
import { readFile, copyFile } from 'node:fs/promises';
import { extname, join, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';
import pw from '/opt/homebrew/lib/node_modules/playwright/index.js';
const { chromium } = pw;

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.json': 'application/json', '.svg': 'image/svg+xml' };
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
await new Promise((r) => server.listen(8291, '127.0.0.1', r));

const out = process.argv[2] || 'tests/artifacts/gameplay.webm';
const outAbs = join(ROOT, out);
mkdirSync(dirname(outAbs), { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 1280, height: 720 },
  recordVideo: { dir: dirname(outAbs), size: { width: 1280, height: 720 } },
});
const page = await ctx.newPage();
await page.goto('http://127.0.0.1:8291/');
await page.waitForFunction(() => window.__ll && window.__ll.state?.phase !== 'boot', { timeout: 8000 });
await page.evaluate(() => {
  window.__ll.start();
  window.__ll.tutorial.skip();
});
// 贪心自动驾驶：把最近缺口转到正下方，持续穿落（真实玩法核心动作）
await page.evaluate(() => {
  window.__autopilot = setInterval(() => {
    const r = window.__ll.run;
    if (r && r.phase === 'playing') r.auto(2);
  }, 66);
});
await page.waitForTimeout(4600);
await page.evaluate(() => clearInterval(window.__autopilot));
const video = page.video();
const srcPath = await video.path();
await ctx.close().catch(() => {});
await browser.close().catch(() => {});
server.closeAllConnections?.();
server.close();
try { await copyFile(srcPath, outAbs); } catch (e) { console.error('copy failed:', e.message); }
console.log('saved', out);
process.exit(0);
