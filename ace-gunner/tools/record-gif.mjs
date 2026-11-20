// ACE GUNNER · 录制真实玩法 → webm（再交给 ffmpeg 转 game.gif）
// 用法：node tools/record-gif.mjs
// 注意：用 ctx.close() 落盘视频（saveAs 在并行环境会卡死），再从录制目录读 webm。
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { writeFileSync, mkdirSync, readdirSync, copyFileSync, rmSync } from 'node:fs';
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
await new Promise((r) => server.listen(8160, r));

const tmpDir = join(ROOT, 'tests', 'artifacts', 'gif-tmp');
rmSync(tmpDir, { recursive: true, force: true });
mkdirSync(tmpDir, { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 1280, height: 720 },
  recordVideo: { dir: tmpDir, size: { width: 1280, height: 720 } },
});
const page = await ctx.newPage();
await page.goto('http://127.0.0.1:8160/');
await page.waitForFunction(() => typeof window.__ll !== 'undefined', { timeout: 15000 });
await page.waitForTimeout(600);

// 布置一段近距离战斗：敌人贴到射程内，自动瞄准最近敌人连射 → 箭矢命中/击杀/爆炸/鹰眼
await page.evaluate(() => {
  window.__ll.debug.setTutorialDone(true);
  window.__ll.debug.startSeeded(0, 5);
  const run = window.__ll.run();
  run._spawnQueue.length = 0;
  run.state.enemies.length = 0;
  const rows = [
    ['foot', 1, 700], ['rider', 2, 900], ['shield', 0, 620], ['barrel', 3, 780], ['foot', 1, 980],
  ];
  for (const [kind, lane, x] of rows) {
    run._spawnEnemy({ kind, lane });
    const e = run.state.enemies[run.state.enemies.length - 1];
    e.x = x;
  }
  // 每 180ms 瞄准最近敌人放一箭（游戏自己的 rAF 主循环负责推进 sim）
  window.__gifTimer = setInterval(() => {
    const s = run.state;
    if (s.phase !== 'wave') return;
    let best = null; let bx = 1e9;
    for (const e of s.enemies) { if (e.state !== 'dead' && e.x < bx) { bx = e.x; best = e; } }
    if (best) {
      run.aim(best.x, best.kind === 'shield' ? best.y + best.radius : best.y);
      run.fire();
    }
  }, 180);
});
await page.waitForTimeout(4400);
await page.evaluate(() => clearInterval(window.__gifTimer));
await page.waitForTimeout(400);

// 关 ctx 落盘视频（比 saveAs 稳）
await ctx.close().catch(() => {});
await browser.close().catch(() => {});
server.closeAllConnections?.();
server.close();

const webms = readdirSync(tmpDir).filter((n) => n.endsWith('.webm')).sort();
if (!webms.length) { console.error('no webm recorded'); process.exit(1); }
const webm = join(tmpDir, webms[webms.length - 1]);

// ffmpeg：palettegen → paletteuse → 480×270 循环 gif
const palette = join(tmpDir, 'palette.png');
const outGif = join(ROOT, 'game.gif');
// 跳过开头约 1.1s 的页面加载，让前 3 秒直接是核心玩法动作；截 4.5s 循环
execFileSync('/opt/homebrew/bin/ffmpeg', ['-y', '-ss', '1.1', '-t', '4.5', '-i', webm, '-vf', 'fps=14,scale=480:270:flags=lanczos,palettegen=stats_mode=diff', palette], { stdio: 'ignore' });
execFileSync('/opt/homebrew/bin/ffmpeg', ['-y', '-ss', '1.1', '-t', '4.5', '-i', webm, '-i', palette, '-lavfi', 'fps=14,scale=480:270:flags=lanczos[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle', '-loop', '0', outGif], { stdio: 'ignore' });

rmSync(tmpDir, { recursive: true, force: true });
console.log('wrote', outGif);
process.exit(0);
