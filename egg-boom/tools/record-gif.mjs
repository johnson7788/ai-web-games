// 录制真实玩法 → webm，再 ffmpeg 转 game.gif（480×270，4.5s，≤2MB）
// 用法：node tools/record-gif.mjs
// 依赖：/opt/homebrew/lib/node_modules/playwright + /opt/homebrew/bin/ffmpeg
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { mkdirSync, readdirSync, rmSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { extname, join, normalize, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import pw from '/opt/homebrew/lib/node_modules/playwright/index.js';
const { chromium } = pw;

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.json': 'application/json', '.mjs': 'text/javascript' };
const server = createServer(async (req, res) => {
  try {
    const url = decodeURIComponent((req.url || '/').split('?')[0]);
    const file = join(ROOT, normalize(url === '/' ? 'index.html' : url));
    if (!file.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
    const data = await readFile(file);
    res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
    res.end(data);
  } catch { res.writeHead(404); res.end(); }
});
await new Promise((r) => server.listen(8151, r));

const tmpDir = join(ROOT, 'tests', 'artifacts', 'gif-src');
rmSync(tmpDir, { recursive: true, force: true });
mkdirSync(tmpDir, { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 1280, height: 720 },
  recordVideo: { dir: tmpDir, size: { width: 1280, height: 720 } },
});
const page = await ctx.newPage();
await page.goto('http://127.0.0.1:8151/', { waitUntil: 'load' });
await page.waitForFunction(() => window.__ll && window.__ll.state?.phase === 'title', { timeout: 15000 });
await page.waitForTimeout(400);
await page.click('#btn-start');
await page.waitForTimeout(500);
await page.click('[data-tutorial-skip]').catch(() => {});
await page.waitForTimeout(900);

// 核心动词：蓄力跳 + 自动射击（前 3 秒内见跳、见射、见数字目标）
await page.keyboard.down('Space');
await page.waitForTimeout(340);
await page.keyboard.up('Space');
await page.waitForTimeout(600);
await page.mouse.click(640, 360); // 手动加射
await page.waitForTimeout(350);
await page.keyboard.down('Space');
await page.waitForTimeout(300);
await page.keyboard.up('Space');
await page.waitForTimeout(1400);

await ctx.close().catch(() => {});
await browser.close().catch(() => {});
server.closeAllConnections?.();
server.close();

// 取 webm 转 gif
const webm = readdirSync(tmpDir).find((f) => f.endsWith('.webm'));
if (!webm) { console.error('no webm recorded'); process.exit(1); }
const src = join(tmpDir, webm);
const gif = join(ROOT, 'game.gif');
const pal = join(tmpDir, 'palette.png');
execFileSync('/opt/homebrew/bin/ffmpeg', ['-y', '-t', '4.5', '-i', src, '-vf', 'fps=20,scale=480:270:flags=lanczos,palettegen', pal]);
execFileSync('/opt/homebrew/bin/ffmpeg', ['-y', '-t', '4.5', '-i', src, '-i', pal, '-filter_complex', 'fps=20,scale=480:270:flags=lanczos[x];[x][1:v]paletteuse', '-loop', '0', gif]);
const kb = Math.round(statSync(gif).size / 1024);
console.log('saved', gif, kb + 'KB');
process.exit(0);
