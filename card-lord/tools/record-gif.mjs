// tools/record-gif.mjs — 录制真实玩法 → webm（再用 ffmpeg 转 game.gif）。
// 用法：node tools/record-gif.mjs   （输出 tools/gameplay.webm，随后 ffmpeg 转 gif）
import { createServer } from 'node:http';
import { readFile, readdir, rename } from 'node:fs/promises';
import { mkdirSync } from 'node:fs';
import { extname, join, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import pw from '/opt/homebrew/lib/node_modules/playwright/index.js';

const { chromium } = pw;
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg' };
const REC_DIR = join(ROOT, 'tests', 'artifacts', 'gif');
mkdirSync(REC_DIR, { recursive: true });

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
await new Promise((r) => server.listen(8147, r));

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 1280, height: 720 },
  recordVideo: { dir: REC_DIR, size: { width: 1280, height: 720 } },
});
const page = await ctx.newPage();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

await page.goto('http://127.0.0.1:8147/', { waitUntil: 'load' });
await page.waitForFunction(() => window.__ll && window.__ll.state.phase !== 'boot', { timeout: 10000 });
await sleep(500);

// 开始 + 跳过引导
await page.click('#btn-start');
await sleep(500);
await page.click('[data-tutorial-skip]').catch(() => {});
await sleep(250);

// 叫分（真实操作：点 1）
await page.click('[data-bid="1"]');
await sleep(550);
// 不加倍
await page.evaluate(() => window.__ll.act({ action: 'double', double: false }));
await sleep(450);

// 连续几手真实出牌：选提示牌 → 出牌
for (let i = 0; i < 4; i += 1) {
  await page.evaluate(() => {
    if (window.__ll.run && window.__ll.run.roundPhase === 'playing') {
      const h = window.__ll.run.hint();
      if (h) window.__ll.act({ action: 'play', cards: h });
      else window.__ll.act({ action: 'pass' });
    }
  });
  await sleep(520);
}

await sleep(400);
await ctx.close().catch(() => {});   // 关闭 context 触发 webm 落盘（避免 saveAs 卡死）
await browser.close().catch(() => {});
server.closeAllConnections?.();
server.close();

// 读取录制的 webm 并移动到 tools/gameplay.webm
const files = await readdir(REC_DIR);
const webm = files.find((f) => f.endsWith('.webm'));
if (!webm) { console.error('未找到 webm 录制文件'); process.exit(1); }
await rename(join(REC_DIR, webm), join(ROOT, 'tools', 'gameplay.webm'));
console.log('saved tools/gameplay.webm');
process.exit(0);
