// tools/record-gif.mjs — 录制真实玩法 → ffmpeg 转 game.gif（480×270 / 4.5s / ≤2MB）。
// 用法：node tools/record-gif.mjs
import { createServer } from 'node:http';
import { readdirSync, copyFileSync, mkdirSync, statSync, rmSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import pw from '/opt/homebrew/lib/node_modules/playwright/index.js';
const { chromium } = pw;

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const REC_DIR = join(ROOT, 'tests/artifacts');
const WEBM_OUT = join(REC_DIR, 'gameplay.webm');
const GIF_OUT = join(ROOT, 'game.gif');
mkdirSync(REC_DIR, { recursive: true });
for (const f of readdirSync(REC_DIR)) if (f.endsWith('.webm')) rmSync(join(REC_DIR, f), { force: true });

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
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const port = server.address().port;

const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=metal', '--autoplay-policy=no-user-gesture-required'] });
const ctx = await browser.newContext({
  viewport: { width: 1280, height: 720 },
  recordVideo: { dir: REC_DIR, size: { width: 1280, height: 720 } },
});
const page = await ctx.newPage();
await page.addInitScript(() => { try { localStorage.setItem('sky-drop-dodge:tutorial-done', 'true'); } catch { /* ignore */ } });
await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__ll?.state?.phase === 'title', { timeout: 15000 });
await page.click('#btn-start', { force: true });
await page.waitForTimeout(300);

// 进波 2 密雨（画面更满），并临时无敌，保证录制期存活
await page.evaluate(() => {
  const r = window.__ll.run;
  r.waveIndex = 2;
  r.waveTime = 0;
  r.player.invulnUntil = r.time + 30;
});

// 真实操作：左右走位 + 举伞
await page.keyboard.down('ArrowRight');
await page.waitForTimeout(700);
await page.keyboard.up('ArrowRight');
await page.keyboard.down('ArrowLeft');
await page.waitForTimeout(700);
await page.keyboard.up('ArrowLeft');
await page.keyboard.down('Space');
await page.waitForTimeout(650);
await page.keyboard.up('Space');
await page.keyboard.down('ArrowRight');
await page.waitForTimeout(700);
await page.keyboard.up('ArrowRight');
await page.waitForTimeout(1200);

// 关闭 context 后再读 webm（saveAs 在并行环境会卡死）
await ctx.close().catch(() => {});
await browser.close().catch(() => {});
server.closeAllConnections?.();
server.close();

const webms = readdirSync(REC_DIR)
  .filter((f) => f.endsWith('.webm'))
  .map((f) => join(REC_DIR, f))
  .filter((f) => statSync(f).size > 0)
  .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);
const webm = webms[0];
if (!webm) {
  console.error('未找到录制 webm');
  process.exit(1);
}
copyFileSync(webm, WEBM_OUT);

// ffmpeg：palettegen/paletteuse → 480×270 循环 gif
const FFMPEG = '/opt/homebrew/bin/ffmpeg';
execFileSync(FFMPEG, [
  '-y', '-ss', '0', '-t', '4.5', '-i', WEBM_OUT,
  '-vf', 'fps=15,scale=480:270:flags=lanczos,split[s0][s1];[s0]palettegen=stats_mode=diff[p];[s1][p]paletteuse=dither=bayer:bayer_scale=5',
  '-loop', '0', GIF_OUT,
], { stdio: 'inherit' });

console.log('saved', GIF_OUT);
process.exit(0);
