// PHANTOM RUN · 录制真实玩法 → webm → ffmpeg 转 game.gif（480×270 循环，≤2MB）。
// 用法：node tools/record-gif.mjs
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { mkdirSync, readdirSync, rmSync, existsSync } from 'node:fs';
import { extname, join, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import pw from '/opt/homebrew/lib/node_modules/playwright/index.js';
const { chromium } = pw;

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
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
await new Promise((r) => server.listen(8177, r));

const recDir = join(ROOT, 'tests', 'artifacts', 'gifrec');
rmSync(recDir, { recursive: true, force: true });
mkdirSync(recDir, { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 1280, height: 720 },
  recordVideo: { dir: recDir, size: { width: 1280, height: 720 } },
});
const page = await ctx.newPage();
await page.goto('http://127.0.0.1:8177/');
await page.waitForTimeout(800);
await page.evaluate(() => {
  window.__ll.debug.setTutorialDone(true);
  window.__ll.debug.startSeeded(3, 5);   // L4：月光斑 + 符文墙 + 尖刺 + 间隙
  window.__ll.debug.hold(true);
  const r = window.__ll.run();
  r.state.player.x = 1120;
  r.state.player.y = 554;
  r.state.player.vy = 0;
  r.state.player.onGround = true;
});
await page.waitForTimeout(200);
await page.evaluate(() => { window.__ll.debug.hold(false); window.__ll.debug.setAutoPlay(true); });
await page.waitForTimeout(4400);
await page.evaluate(() => window.__ll.debug.setAutoPlay(false));

// 关闭 context 让 Playwright 落盘 webm（避免 saveAs 卡住）
await ctx.close().catch(() => {});
await browser.close().catch(() => {});
server.closeAllConnections?.();
server.close();

const webms = readdirSync(recDir).filter((f) => f.endsWith('.webm'));
if (!webms.length) { console.error('no webm recorded'); process.exit(1); }
const webm = join(recDir, webms[0]);
console.log('webm:', webm, existsSync(webm));

const gif = join(ROOT, 'game.gif');
const palette = join(recDir, 'palette.png');
execFileSync('/opt/homebrew/bin/ffmpeg', ['-y', '-ss', '1.1', '-t', '4.4', '-i', webm, '-vf', 'fps=20,scale=480:270:flags=lanczos,palettegen', palette], { stdio: 'inherit' });
execFileSync('/opt/homebrew/bin/ffmpeg', ['-y', '-ss', '1.1', '-t', '4.4', '-i', webm, '-i', palette, '-lavfi', 'fps=20,scale=480:270:flags=lanczos[x];[x][1:v]paletteuse', gif], { stdio: 'inherit' });
console.log('saved', gif);
process.exit(0);
