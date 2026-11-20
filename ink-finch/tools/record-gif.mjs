// 录制真实玩法 → webm → ffmpeg 转 game.gif（列表页动画）
// 用法：node tools/record-gif.mjs [levelIndex] [seed]
// 前 3 秒必须看到核心玩法：上扑 + 穿缝记分（自动飞控实时驱动）。
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { rmSync } from 'node:fs';
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
await new Promise((r) => server.listen(8149, r));

const levelIdx = Number(process.argv[2] ?? 1); // 1 基
const seed = Number(process.argv[3] ?? 5);
const webm = join(ROOT, 'tests', 'artifacts', 'gameplay.webm');
const gif = join(ROOT, 'game.gif');
const pal = join(ROOT, 'tests', 'artifacts', 'palette.png');

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 1280, height: 720 },
  recordVideo: { dir: dirname(webm), size: { width: 1280, height: 720 } },
});
const page = await ctx.newPage();
await page.goto('http://127.0.0.1:8149/');
await page.waitForFunction(() => typeof window.__ll !== 'undefined', { timeout: 15000 }).catch(() => {});
await page.waitForTimeout(700);
await page.evaluate(([lv, sd]) => {
  window.__ll.debug.setTutorialDone(true);
  window.__ll.debug.startSeeded(lv, sd);
  window.__ll.debug.autoPilotStart();
}, [levelIdx, seed]);
await page.waitForTimeout(300);
// 实时自动飞控（约 4.5s：上扑 + 穿缝 + 记分 + 墨点）
await page.evaluate(() => {
  window.__gifTimer = setInterval(() => window.__ll.debug.autoPilotTick(), 16);
});
await page.waitForTimeout(3000);
await page.evaluate(() => clearInterval(window.__gifTimer));

await ctx.close().catch(() => {});
try { await page.video().saveAs(webm); } catch (e) { console.error('saveAs failed:', e.message); }
await browser.close().catch(() => {});
server.closeAllConnections?.();
server.close();

// ffmpeg：palettegen → paletteuse → 480×270 gif
try {
  rmSync(pal, { force: true });
  execFileSync('/opt/homebrew/bin/ffmpeg', ['-y', '-i', webm, '-vf', 'fps=10,scale=480:270:flags=lanczos,palettegen=max_colors=64', pal], { stdio: 'ignore' });
  execFileSync('/opt/homebrew/bin/ffmpeg', ['-y', '-i', webm, '-i', pal, '-filter_complex', 'fps=10,scale=480:270:flags=lanczos[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=4', '-loop', '0', gif], { stdio: 'ignore' });
  console.log('saved', gif);
} catch (e) {
  console.error('ffmpeg failed:', e.message);
  process.exitCode = 1;
}
