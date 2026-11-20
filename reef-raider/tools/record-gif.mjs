// 录制真实玩法 → webm → ffmpeg palettegen/paletteuse 转 game.gif (480×270)。
// 坑：并行环境下 page.video().saveAs() 会卡死 → 用 ctx.close() 让录像落盘，再 readdir 取 webm。
// 用法：node tools/record-gif.mjs
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { readdirSync, rmSync, mkdirSync, existsSync } from 'node:fs';
import { extname, join, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import pw from '/opt/homebrew/lib/node_modules/playwright/index.js';
const { chromium } = pw;

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TMP = join(ROOT, 'tests', 'artifacts', 'giftmp');
if (existsSync(TMP)) rmSync(TMP, { recursive: true, force: true });
mkdirSync(TMP, { recursive: true });
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
await new Promise((r) => server.listen(8163, r));

const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=metal'] });
const ctx = await browser.newContext({
  viewport: { width: 1280, height: 720 },
  recordVideo: { dir: TMP, size: { width: 1280, height: 720 } },
});
const page = await ctx.newPage();
await page.goto('http://127.0.0.1:8163/');
await page.waitForFunction(() => typeof window.__ll !== 'undefined', { timeout: 10000 }).catch(() => {});
await page.waitForTimeout(700);

// 进入磷光夜海 + 幽灵鱼，实时自动开火（rAF 驱动画面，核心玩法动作前 3 秒即出现）
await page.evaluate(() => {
  window.__ll.debug.setTutorialDone(true);
  window.__ll.debug.startSeeded(8, 5);
  window.__ll.debug.spawnFish('ghost', 620, 260, -1);
  window.__ll.debug.spawnFish('turtle', 900, 430, 1);
  window.__rec = setInterval(() => {
    const r = window.__ll.run();
    if (!r || r.state.phase !== 'playing') return;
    let best = null; let bv = -1;
    for (const f of r.state.fish) if (f.alive) { const v = f.gold / Math.max(1, f.hp / 2); if (v > bv) { bv = v; best = f; } }
    if (best) {
      const p = Math.max(1, Math.min(5, Math.ceil(best.hp / 8)));
      r.setPower(p);
      const t = Math.hypot(best.x - 640, best.y - 668) / 760;
      window.__ll.debug.fireAt(best.x + (best.vx || 0) * t, best.y + (best.vy || 0) * t);
    }
  }, 130);
});
await page.waitForTimeout(4800);
await page.evaluate(() => { if (window.__rec) clearInterval(window.__rec); });

// 先关 context 让录像落盘，再取 webm（不用 page.video().saveAs()）
await ctx.close();
await browser.close();
server.closeAllConnections?.();
server.close();

const webm = readdirSync(TMP).find((n) => n.endsWith('.webm'));
if (!webm) { console.error('no webm recorded'); process.exit(1); }
const src = join(TMP, webm);

// palettegen → paletteuse → 480×270 gif
try {
  execFileSync('ffmpeg', ['-y', '-i', src, '-vf', 'fps=14,scale=480:270:flags=lanczos,palettegen=stats_mode=diff', join(TMP, 'palette.png')], { stdio: 'pipe' });
  execFileSync('ffmpeg', ['-y', '-i', src, '-i', join(TMP, 'palette.png'), '-filter_complex', 'fps=14,scale=480:270:flags=lanczos[x];[x][1:v]paletteuse=dither=bayer', '-loop', '0', join(ROOT, 'game.gif')], { stdio: 'pipe' });
} catch (e) {
  console.error('ffmpeg failed:', e.message);
  process.exit(1);
}
console.log('gif done:', join(ROOT, 'game.gif'));
process.exit(0);
