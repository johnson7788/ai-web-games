// tools/record-gif.mjs — 录制真实玩法 → game.gif（480×270、~4.5s、≤2MB）
// 流程：Playwright recordVideo 录 webm → ctx.close() 定稿 → ffmpeg palettegen/paletteuse。
import { createServer } from 'node:http';
import { readFileSync, existsSync, readdirSync, mkdirSync, rmSync } from 'node:fs';
import { extname, join, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import pw from '/opt/homebrew/lib/node_modules/playwright/index.js';
const { chromium } = pw;

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const FFMPEG = '/opt/homebrew/bin/ffmpeg';
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.json': 'application/json' };

const server = createServer((req, res) => {
  try {
    const url = decodeURIComponent((req.url || '/').split('?')[0]);
    const file = join(ROOT, normalize(url === '/' ? 'index.html' : url));
    if (!file.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
    const data = readFileSync(file);
    res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream' });
    res.end(data);
  } catch { res.writeHead(404); res.end(); }
});
await new Promise((r) => server.listen(8151, r));

const vidDir = join(ROOT, 'tests', 'artifacts', 'gif-tmp');
rmSync(vidDir, { recursive: true, force: true });
mkdirSync(vidDir, { recursive: true });

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=metal'] });
const ctx = await browser.newContext({
  viewport: { width: 1280, height: 720 },
  recordVideo: { dir: vidDir, size: { width: 1280, height: 720 } },
});
const page = await ctx.newPage();
await page.goto('http://127.0.0.1:8151/', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(800);

// 跳过引导，直接开局
await page.evaluate(() => {
  try { window.__ll.tutorial.skip(); } catch {}
  window.__ll.start();
});
await page.waitForTimeout(400);

// 真实操作：鼠标上下摆动转向 + 偶尔收拢，覆盖「前进 + 躲避 + 吃泡 + 收拢」核心动词
await page.mouse.move(640, 400);
for (let i = 0; i < 15; i += 1) {
  const y = 240 + (i % 2) * 280;
  await page.mouse.move(640, y);
  if (i === 5 || i === 11) {
    await page.keyboard.down('Space');
    await page.waitForTimeout(240);
    await page.keyboard.up('Space');
  }
  await page.waitForTimeout(260);
}

// 定稿视频：先关 context，再读 webm（避免 saveAs 并行卡死）
await ctx.close().catch(() => {});
await browser.close().catch(() => {});
server.closeAllConnections?.();
server.close();

const webm = readdirSync(vidDir).find((f) => f.endsWith('.webm'));
if (!webm) {
  console.error('no webm found in', vidDir);
  process.exit(1);
}
const webmPath = join(vidDir, webm);
const palettePath = join(vidDir, 'palette.png');
const outPath = join(ROOT, 'game.gif');

// 480×270、4.5s、fps 12（循环节奏清晰），paletteuse 保真
execFileSync(FFMPEG, [
  '-y', '-i', webmPath, '-t', '4.5',
  '-vf', 'fps=12,scale=480:270:flags=lanczos,palettegen=stats_mode=diff',
  palettePath,
], { stdio: 'pipe' });
execFileSync(FFMPEG, [
  '-y', '-i', webmPath, '-i', palettePath,
  '-t', '4.5', '-lavfi', 'fps=12,scale=480:270:flags=lanczos[x];[x][1:v]paletteuse=dither=bayer',
  '-loop', '0', outPath,
], { stdio: 'pipe' });

rmSync(vidDir, { recursive: true, force: true });
const kb = (existsSync(outPath) ? readFileSync(outPath).length : 0) / 1024;
console.log(`saved ${outPath} (${kb.toFixed(0)} KB)`);
process.exit(0);
