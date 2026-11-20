// 录制真实玩法 → webm → ffmpeg 转 game.gif（480×270，前 3 秒见核心动词+目标）
// 用法：node tools/record-gif.mjs
// 注意：Playwright saveAs 在并行/后台环境会卡死，这里用 ctx.close() 后再从录屏目录读 webm。
import { createServer } from 'node:http';
import { readFile, readdir, rm } from 'node:fs/promises';
import { existsSync, mkdirSync } from 'node:fs';
import { extname, join, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
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
await new Promise((r) => server.listen(8147, r));

const outDir = join(ROOT, 'tests', 'artifacts');
mkdirSync(outDir, { recursive: true });
const gif = join(ROOT, 'game.gif');
// 录屏子目录（Playwright 会把 webm 写进这里）
const videoDir = join(outDir, 'videos');
try { await rm(videoDir, { recursive: true, force: true }); } catch {}
mkdirSync(videoDir, { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 1280, height: 720 },
  recordVideo: { dir: videoDir, size: { width: 1280, height: 720 } },
});
const page = await ctx.newPage();
await page.goto('http://127.0.0.1:8147/');
await page.waitForTimeout(700);

await page.evaluate(() => {
  window.__ll.debug.setTutorialDone();
  window.__ll.debug.startLevel(1);
  const TILE = 45;
  const bot = {};
  window.__ll.debug.setBot((run) => {
    const p = run.player;
    const lookPx = 9 * TILE;
    const pc = Math.floor(p.x / TILE);
    let pitDist = Infinity;
    for (let c = pc; c <= pc + Math.ceil(lookPx / TILE) && c < run.width; c += 1) {
      if (run.grid[14][c] === '.' && c * TILE - p.x > -10) { pitDist = c * TILE - p.x; break; }
    }
    let enemyDist = Infinity;
    for (const e of run.enemies) {
      if (!e.alive) continue;
      const dx = e.x - p.x;
      if (dx > -10 && dx < lookPx && Math.abs(e.y - p.y) < 60) enemyDist = Math.min(enemyDist, dx);
    }
    let spikeDist = Infinity;
    for (const s of run.spikes) {
      const dx = s.x - p.x;
      if (dx > -10 && dx < lookPx) spikeDist = Math.min(spikeDist, dx);
    }
    const wantJump = pitDist < 1.5 * TILE || spikeDist < 1.6 * TILE;
    const wantWrench = enemyDist < 5 * TILE;
    const emergencyJump = enemyDist < 1.2 * TILE;
    if ((wantJump || emergencyJump) && !bot.jumping) { bot.jumping = true; bot.jumpFrames = 0; }
    if (bot.jumping) { bot.jumpFrames += 1; if (bot.jumpFrames > 40) bot.jumping = false; }
    if (wantWrench && !bot.wrenching) { bot.wrenching = true; bot.wrenchFrames = 0; }
    if (bot.wrenching) { bot.wrenchFrames += 1; if (bot.wrenchFrames > 4) bot.wrenching = false; }
    return { right: true, jumpHeld: !!bot.jumping, wrenchHeld: !!bot.wrenching, steamHeld: false };
  });
});

await page.waitForTimeout(4600);
await ctx.close().catch(() => {});
await browser.close().catch(() => {});
server.closeAllConnections?.();
server.close();

// ctx.close() 后 webm 已落盘到 videoDir
const files = await readdir(videoDir);
const webm = files.find((f) => f.endsWith('.webm'));
if (!webm) {
  console.error('webm 未生成:', files);
  process.exit(1);
}
const webmPath = join(videoDir, webm);

const palette = join(outDir, 'palette.png');
const ffmpeg = '/opt/homebrew/bin/ffmpeg';
const filter = 'fps=12,scale=480:270:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse=dither=bayer';
execFileSync(ffmpeg, ['-y', '-i', webmPath, '-vf', filter, gif], { stdio: 'ignore' });
console.log('saved', gif);
process.exit(0);
