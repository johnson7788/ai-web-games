// tools/record-gif.mjs — 录制真实玩法 → webm → ffmpeg 转 game.gif（480×270）
// 用法：node tools/record-gif.mjs
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { extname, join, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import pw from '/opt/homebrew/lib/node_modules/playwright/index.js';

const { chromium } = pw;
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.json': 'application/json', '.mp3': 'audio/mpeg' };

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
await new Promise((r) => server.listen(8161, r));

const webm = join(ROOT, 'tests', 'artifacts', 'gameplay.webm');
const gif = join(ROOT, 'game.gif');

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 1280, height: 720 },
  recordVideo: { dir: dirname(webm), size: { width: 1280, height: 720 } },
});
const page = await ctx.newPage();
await page.goto('http://127.0.0.1:8161/');
await page.waitForFunction(() => window.__ll && window.__ll.state.phase !== 'boot', { timeout: 10000 });
await page.waitForTimeout(400);

// 开始 + 跳过引导
await page.click('#btn-start');
await page.waitForTimeout(500);
await page.evaluate(() => { try { window.__ll.tutorial.skip(); } catch { /* noop */ } });
await page.waitForTimeout(200);

// 发射：按住空格蓄力后释放（真实键盘事件）
await page.keyboard.down('Space');
await page.waitForTimeout(900);
await page.keyboard.up('Space');

// 球在台上弹跳刷分；录到 ~2s 时翻一次左挡板再翻右挡板（核心动词可见）
await page.waitForTimeout(1500);
await page.keyboard.down('ArrowLeft');
await page.waitForTimeout(160);
await page.keyboard.up('ArrowLeft');
await page.waitForTimeout(500);
await page.keyboard.down('ArrowRight');
await page.waitForTimeout(160);
await page.keyboard.up('ArrowRight');
await page.waitForTimeout(1200);

const video = page.video();
await page.close().catch(() => {});
try { await video.saveAs(webm); } catch (e) { console.error('saveAs failed:', e.message); }
await ctx.close().catch(() => {});
await browser.close().catch(() => {});
server.closeAllConnections?.();
server.close();

// webm → game.gif（palettegen/paletteuse，480×270）
try {
  const palette = join(ROOT, 'tests', 'artifacts', 'palette.png');
  execFileSync('/opt/homebrew/bin/ffmpeg', ['-y', '-t', '4.5', '-i', webm, '-vf', 'fps=28,scale=480:270:flags=lanczos,palettegen=stats_mode=diff', palette], { stdio: 'ignore' });
  execFileSync('/opt/homebrew/bin/ffmpeg', ['-y', '-t', '4.5', '-i', webm, '-i', palette, '-lavfi', 'fps=28,scale=480:270:flags=lanczos[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=5', gif], { stdio: 'ignore' });
  console.log('saved', gif);
} catch (e) {
  console.error('ffmpeg failed:', e.message);
  process.exit(1);
}
process.exit(0);
