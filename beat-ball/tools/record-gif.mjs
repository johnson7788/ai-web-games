// 录制真实玩法 → webm（再用 ffmpeg 转 game.gif）。
// 用法：node tools/record-gif.mjs [out.gif]
import { createServer } from 'node:http';
import { readFile, readdir, rm } from 'node:fs/promises';
import { extname, join, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { execFileSync } from 'node:child_process';
const require = createRequire(import.meta.url);
const pw = require('/opt/homebrew/lib/node_modules/playwright/index.js');
const { chromium } = pw;

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = process.argv[2] || join(ROOT, 'game.gif');
const TMP = join(ROOT, 'tests', 'artifacts', 'gifrec');
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
await new Promise((r) => server.listen(8182, r));
await rm(TMP, { recursive: true, force: true });

const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=metal', '--autoplay-policy=no-user-gesture-required'] });
const ctx = await browser.newContext({
  viewport: { width: 1280, height: 720 },
  recordVideo: { dir: TMP, size: { width: 1280, height: 720 } },
});
const page = await ctx.newPage();
await page.goto('http://127.0.0.1:8182/', { waitUntil: 'load' });
await page.waitForFunction(() => typeof window.__ll !== 'undefined', { timeout: 15000 });
await page.waitForTimeout(500);
await page.evaluate(() => {
  window.__ll.debug.setTutorialDone(true);
  window.__ll.debug.startSeeded(2, 5); // 三轨，画面更丰富
  // 自动玩：躲鼓槌 + 抢节拍点（与 selfplay 贪心同策略）
  window.__bb = setInterval(() => {
    const r = window.__ll.run();
    if (!r || r.state.phase !== 'playing') return;
    const s = r.state;
    const upcoming = s.obstacles.filter((o) => !o.resolved && o.t >= s.clock - 1e-6);
    const hz = upcoming.find((o) => o.kind === 'hazard');
    if (s.lanes > 1 && hz && hz.t - s.clock < 0.8 && s.playerLane === hz.lane) {
      const bad = new Set(upcoming.filter((o) => o.kind === 'hazard' && Math.abs(o.t - hz.t) < 1e-6).map((o) => o.lane));
      for (let l = 0; l < s.lanes; l += 1) {
        if (!bad.has(l) && l !== s.playerLane) { r.move(l > s.playerLane ? 1 : -1); break; }
      }
    } else {
      const pad = upcoming.find((o) => o.kind === 'pad');
      if (pad && pad.t - s.clock < 1.5 && pad.lane !== s.playerLane) {
        const safe = !upcoming.some((o) => o.kind === 'hazard' && o.t < pad.t && o.lane === pad.lane);
        if (safe) r.move(pad.lane > s.playerLane ? 1 : -1);
      }
    }
  }, 50);
});
await page.waitForTimeout(4500);
await page.evaluate(() => clearInterval(window.__bb));
await ctx.close().catch(() => {});
await browser.close().catch(() => {});
server.closeAllConnections?.();
server.close();

// 找到录制出的 webm
const files = await readdir(TMP);
const webm = files.find((f) => f.endsWith('.webm'));
if (!webm) { console.error('no webm recorded'); process.exit(1); }
const webmPath = join(TMP, webm);
const palette = join(TMP, 'palette.png');
// palettegen → paletteuse 转 gif（480x270, 15fps, 循环）
execFileSync('/opt/homebrew/bin/ffmpeg', ['-y', '-i', webmPath, '-vf', 'fps=15,scale=480:270:flags=lanczos,palettegen=stats_mode=diff', palette], { stdio: 'inherit' });
execFileSync('/opt/homebrew/bin/ffmpeg', ['-y', '-i', webmPath, '-i', palette, '-lavfi', 'fps=15,scale=480:270:flags=lanczos[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=5', '-loop', '0', OUT], { stdio: 'inherit' });
console.log('saved', OUT);
process.exit(0);
