// tools/record-gif.mjs — 录制真实玩法 → webm → ffmpeg paletteuse → game.gif（480×270, ≤2MB）。
// 前 3 秒必见核心动词（手电扫动 + 点击找货）+ 目标（清单 HUD）。
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { readdirSync, rmSync, statSync } from 'node:fs';
import { extname, join, normalize, dirname, resolve } from 'node:path';
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
await new Promise((r) => server.listen(8151, r));

const videoDir = join(ROOT, 'tests/artifacts/gif');
rmSync(videoDir, { recursive: true, force: true });
const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=metal', '--autoplay-policy=no-user-gesture-required'] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, recordVideo: { dir: videoDir, size: { width: 1280, height: 720 } } });
const page = await ctx.newPage();
page.on('console', (m) => { if (m.type() === 'error') console.error('PAGE-CONSOLE', m.text()); });
page.on('pageerror', (e) => console.error('PAGE-ERROR', e.message));
page.on('response', (r) => { if (r.status() >= 400) console.error('HTTP', r.status(), r.url()); });
page.on('requestfailed', (r) => console.error('REQFAIL', r.url(), r.failure()?.errorText));

await page.goto('http://127.0.0.1:8151/', { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__ll && window.__ll.state.phase !== 'boot', { timeout: 10000 });
await page.evaluate(() => localStorage.setItem('spot-it:tutorial-done', 'true'));
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__ll && window.__ll.state.phase !== 'boot', { timeout: 10000 });
await page.click('#btn-start');
await page.waitForTimeout(400);

async function targetXY() {
  return page.evaluate(() => {
    const r = window.__ll.run;
    const t = r && r.items.find((i) => i.isTarget && !i.found);
    return t ? { x: t.x, y: t.y } : null;
  });
}
async function moveToTarget() {
  const c = await page.evaluate(() => {
    const r = window.__ll.run;
    const t = r && r.items.find((i) => i.isTarget && !i.found);
    if (!t) return null;
    const cv = document.getElementById('canvas');
    const rect = cv.getBoundingClientRect();
    const scale = Math.min(rect.width / 1280, rect.height / 720);
    const ox = (rect.width - 1280 * scale) / 2;
    const oy = (rect.height - 720 * scale) / 2;
    return { cx: rect.left + ox + t.x * scale, cy: rect.top + oy + t.y * scale };
  });
  if (c) await page.mouse.move(c.cx, c.cy);
}

// 约 4.5 秒真实玩法：手电扫动 + 连续点击目标（含过关时市场点亮）
const deadline = Date.now() + 4600;
while (Date.now() < deadline) {
  await moveToTarget();
  await page.waitForTimeout(220);
  const t = await targetXY();
  if (t) await page.mouse.click(t.x, t.y);
  await page.waitForTimeout(120);
}

await ctx.close().catch(() => {});   // 先 close 再读 webm（saveAs 在并行环境会卡死）
await browser.close().catch(() => {});
server.closeAllConnections?.();
server.close();

const webms = readdirSync(videoDir).filter((f) => f.endsWith('.webm')).map((f) => join(videoDir, f));
const webm = webms.sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs)[0];
if (!webm) { console.error('no webm recorded'); process.exit(1); }

const pal = join(videoDir, 'pal.png');
const out = resolve(ROOT, 'game.gif');
execFileSync('/opt/homebrew/bin/ffmpeg', ['-y', '-i', webm, '-t', '4.5', '-vf', 'fps=14,scale=480:270:flags=lanczos,palettegen=stats_mode=diff:max_colors=96', pal], { stdio: 'ignore' });
execFileSync('/opt/homebrew/bin/ffmpeg', ['-y', '-i', webm, '-t', '4.5', '-i', pal, '-lavfi', 'fps=14,scale=480:270:flags=lanczos[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=5', out], { stdio: 'ignore' });
console.log('game.gif bytes:', statSync(out).size, '->', out);
