// 录制真实玩法 → webm → ffmpeg 转 game.gif（480×270 循环）。
// 用法：node tools/record-gif.mjs [seed]
// 注意：不用 page.video().saveAs()（并行环境会卡死）；用 ctx.close() 先落盘，再读 webm 目录。
import { createServer } from 'node:http';
import { readdirSync, mkdirSync, rmSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import pw from '/opt/homebrew/lib/node_modules/playwright/index.js';
const { chromium } = pw;

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TMP = join(ROOT, 'tests', 'artifacts', 'giftmp');
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
await new Promise((r) => server.listen(8160, r));

const seed = Number(process.argv[2] ?? 5);
rmSync(TMP, { recursive: true, force: true });
mkdirSync(TMP, { recursive: true });

const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=metal', '--autoplay-policy=no-user-gesture-required'] });
const ctx = await browser.newContext({
  viewport: { width: 1280, height: 720 },
  recordVideo: { dir: TMP, size: { width: 1280, height: 720 } },
});
const page = await ctx.newPage();
await page.goto('http://127.0.0.1:8160/', { waitUntil: 'domcontentloaded', timeout: 20000 });
await page.waitForFunction(() => window.__ll, { timeout: 15000 });
await page.waitForTimeout(600);

// 进入种子对局，拼词 → 施法 → 词云爆炸，循环出核心玩法动作
await page.evaluate((sd) => {
  window.__ll.debug.setTutorialDone(true);
  window.__ll.debug.startSeeded(0, sd);
}, seed);
await page.waitForTimeout(400);

for (let i = 0; i < 5; i += 1) {
  await page.evaluate(() => {
    const w = window.__ll.debug.spellBest();   // 选中最长词字母（拼字画面）
    if (w) window.__ll.debug.submit();          // 施法 → 命中 + 词云
  });
  await page.waitForTimeout(950);
}

// 先关 context 让录像强制落盘，再读 webm
await ctx.close().catch(() => {});
await browser.close().catch(() => {});

const webm = readdirSync(TMP).find((f) => f.endsWith('.webm'));
if (!webm) {
  console.error('未找到 webm 录像');
  server.close();
  process.exit(1);
}
const webmPath = join(TMP, webm);
const gifPath = join(ROOT, 'game.gif');
// palettegen/paletteuse 转 gif（480×270，≤2MB）
execFileSync('ffmpeg', [
  '-y', '-i', webmPath,
  '-vf', 'fps=12,scale=480:270:flags=lanczos,split[s0][s1];[s0]palettegen=max_colors=128[p];[s1][p]paletteuse=dither=bayer',
  '-loop', '0', gifPath,
], { stdio: 'inherit' });

server.closeAllConnections?.();
server.close();
rmSync(TMP, { recursive: true, force: true });
console.log('saved', gifPath);
process.exit(0);
