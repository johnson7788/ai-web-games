// tools/record-gif.mjs — 录制真实玩法 → game.gif（480×270、4.5s、≤2MB）
// 用法：node tools/record-gif.mjs
// 流程：Playwright 录屏（真实鼠标 steering）→ ctx.close() → 读 webm → ffmpeg palettegen/paletteuse。
import { createServer } from 'node:http';
import { mkdirSync, rmSync, statSync } from 'node:fs';
import { readFile, readdir } from 'node:fs/promises';
import { extname, join, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import pw from '/opt/homebrew/lib/node_modules/playwright/index.js';
const { chromium } = pw;

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const RAW_DIR = join(ROOT, 'tests', 'artifacts', 'gifraw');
const OUT_GIF = join(ROOT, 'game.gif');
const FFMPEG = '/opt/homebrew/bin/ffmpeg';

mkdirSync(RAW_DIR, { recursive: true });
rmSync(RAW_DIR, { recursive: true, force: true });
mkdirSync(RAW_DIR, { recursive: true });

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.json': 'application/json' };
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
// 端口自增：避免与其它并行任务的截图/录屏服务抢端口
import net from 'node:net';
function portBusy(p) {
  return new Promise((resolve) => {
    const sock = net.connect({ port: p, host: '127.0.0.1' });
    const done = (busy) => { sock.destroy(); resolve(busy); };
    sock.setTimeout(250);
    sock.once('connect', () => done(true));
    sock.once('timeout', () => done(true));
    sock.once('error', () => done(false));
  });
}
let PORT = 8185;
while (await portBusy(PORT)) PORT += 1;
await new Promise((r) => server.listen(PORT, '127.0.0.1', r));

const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=metal', '--autoplay-policy=no-user-gesture-required'] });
const ctx = await browser.newContext({
  viewport: { width: 1280, height: 720 },
  recordVideo: { dir: RAW_DIR, size: { width: 1280, height: 720 } },
});
const page = await ctx.newPage();
page.on('console', (m) => { if (m.type() === 'error') console.error('CONSOLE_ERR:', m.text().slice(0, 200)); });
page.on('pageerror', (e) => console.error('PAGE_ERROR:', e.message.slice(0, 200)));
await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'domcontentloaded' });
for (let i = 0; i < 150; i += 1) {
  if (await page.evaluate(() => typeof window.__ll !== 'undefined').catch(() => false)) break;
  await page.waitForTimeout(100);
}
const ready = await page.evaluate(() => typeof window.__ll !== 'undefined').catch(() => false);
if (!ready) throw new Error(`__ll not ready (port=${PORT}, url=${page.url()})`);
await page.waitForTimeout(400);

// 直接进玩法，跳过标题/教程，前 3 秒即见核心动词（横向 steering 吃同色环）
await page.click('#btn-start');
await page.waitForTimeout(400);
await page.evaluate(() => window.__ll.debug.setTutorialDone());

// 真实鼠标 steering：每 90ms 把指针移到下一个同色环目标（连续微调，不是假输入）
const t0 = Date.now();
while (Date.now() - t0 < 5200) {
  const targetX = await page.evaluate(() => {
    const r = window.__ll.run;
    if (!r || r.phase !== 'playing') return 640;
    let ring = null;
    let bestY = Infinity;
    for (const rr of r.rings) {
      if (rr.resolved || rr.worldY <= r.depth) continue;
      if (rr.worldY < bestY) { bestY = rr.worldY; ring = rr; }
    }
    if (!ring) return 640;
    let bx = 640;
    let bd = Infinity;
    for (let i = 0; i < ring.cellsCount; i += 1) {
      if (ring.colors[i] !== r.dye) continue;
      const cx = (((ring.xOffset + i * ring.cellW + ring.cellW / 2) % 1280) + 1280) % 1280;
      const d = Math.min(Math.abs(cx - r.ball.x), 1280 - Math.abs(cx - r.ball.x));
      if (d < bd) { bd = d; bx = cx; }
    }
    return bx;
  });
  await page.mouse.move(Math.round(targetX), 600);
  await page.waitForTimeout(90);
}

await ctx.close().catch(() => {});
await browser.close().catch(() => {});
server.closeAllConnections?.();
server.close();

// 读 webm → ffmpeg：裁 1.2s 起、取 4.5s，缩到 480×270，palettegen/paletteuse
const webm = (await readdir(RAW_DIR)).find((f) => f.endsWith('.webm'));
if (!webm) { console.error('no webm found'); process.exit(1); }
const src = join(RAW_DIR, webm);
const palette = join(RAW_DIR, 'palette.png');

execFileSync(FFMPEG, ['-y', '-ss', '1.1', '-t', '4.5', '-i', src,
  '-vf', 'fps=15,scale=480:270:flags=lanczos,palettegen', palette], { stdio: 'pipe' });
execFileSync(FFMPEG, ['-y', '-ss', '1.1', '-t', '4.5', '-i', src, '-i', palette,
  '-lavfi', 'fps=15,scale=480:270:flags=lanczos[x];[x][1:v]paletteuse', '-loop', '0', OUT_GIF], { stdio: 'pipe' });

const size = statSync(OUT_GIF).size;
console.log('saved', OUT_GIF, `${(size / 1024 / 1024).toFixed(2)}MB`);
if (size > 2 * 1024 * 1024) { console.error('game.gif > 2MB'); process.exit(1); }
process.exit(0);
