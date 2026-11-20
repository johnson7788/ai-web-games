// 录制真实玩法 → webm → ffmpeg 转 game.gif（480×270、≤2MB、前 3 秒见核心动词+目标）。
// 用法：node tools/record-gif.mjs
import { createServer } from 'node:http';
import { readdirSync, unlinkSync, mkdirSync } from 'node:fs';
import { readFile as readFileP } from 'node:fs/promises';
import { extname, join, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import pw from '/opt/homebrew/lib/node_modules/playwright/index.js';

const { chromium } = pw;
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.json': 'application/json', '.mp3': 'audio/mpeg' };
const server = createServer(async (req, res) => {
  try {
    const url = decodeURIComponent((req.url || '/').split('?')[0]);
    const file = join(ROOT, normalize(url === '/' ? 'index.html' : url));
    if (!file.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
    const data = await readFileP(file);
    res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream' });
    res.end(data);
  } catch { res.writeHead(404); res.end(); }
});
await new Promise((r) => server.listen(8151, r));

const WEBM_DIR = join(ROOT, 'tests/artifacts');
mkdirSync(WEBM_DIR, { recursive: true });
for (const f of readdirSync(WEBM_DIR).filter((x) => x.endsWith('.webm'))) {
  try { unlinkSync(join(WEBM_DIR, f)); } catch { /* noop */ }
}
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, recordVideo: { dir: WEBM_DIR, size: { width: 1280, height: 720 } } });
const page = await ctx.newPage();
await page.goto('http://127.0.0.1:8151/');
await page.waitForTimeout(800);
await page.evaluate(() => window.__ll.start());
await page.waitForTimeout(400);
await page.evaluate(() => { try { window.__ll.tutorial.skip(); } catch { /* noop */ } });
await page.waitForTimeout(1200);

// 真实玩法：循环点击屏幕上的目标 + 打空后换弹，持续约 4.5s
const t0 = Date.now();
while (Date.now() - t0 < 4600) {
  const target = await page.evaluate(() => {
    const r = window.__ll.run;
    if (!r) return null;
    const t = r.targets.find((x) => !x.dead && x.kind !== 'ghost');
    return t ? { x: t.x, y: t.y } : null;
  }).catch(() => null);
  if (target) {
    await page.mouse.click(target.x, target.y).catch(() => {});
    await page.waitForTimeout(120);
  } else {
    await page.waitForTimeout(140);
  }
  const ammo = await page.evaluate(() => window.__ll.run?.ammo ?? 6).catch(() => 6);
  if (ammo <= 1) {
    await page.evaluate(() => { try { window.__ll.run.step({ reload: true }); } catch { /* noop */ } }).catch(() => {});
    await page.waitForTimeout(200);
  }
}

// 用 ctx.close() 再读 webm 目录，避免 saveAs 在并行环境卡死
await ctx.close().catch(() => {});
await browser.close().catch(() => {});
server.closeAllConnections?.();
server.close();

const files = readdirSync(WEBM_DIR).filter((f) => f.endsWith('.webm'));
if (!files.length) { console.error('no webm recorded'); process.exit(1); }
const webm = join(WEBM_DIR, files[files.length - 1]);
const palette = join(WEBM_DIR, 'gif-palette.png');
const outGif = join(ROOT, 'game.gif');

const FF = '/opt/homebrew/bin/ffmpeg';
execFileSync(FF, ['-y', '-ss', '2.4', '-t', '4.5', '-i', webm, '-vf', 'fps=15,scale=480:270:flags=lanczos,palettegen=max_colors=128', palette], { stdio: 'ignore' });
execFileSync(FF, ['-y', '-ss', '2.4', '-t', '4.5', '-i', webm, '-i', palette, '-filter_complex', 'fps=15,scale=480:270:flags=lanczos[x];[x][1:v]paletteuse', '-loop', '0', outGif], { stdio: 'ignore' });

// 清理临时文件
for (const f of readdirSync(WEBM_DIR).filter((x) => x.endsWith('.webm'))) {
  try { unlinkSync(join(WEBM_DIR, f)); } catch { /* noop */ }
}
try { unlinkSync(palette); } catch { /* noop */ }
console.log('saved game.gif from', files[files.length - 1]);
process.exit(0);
