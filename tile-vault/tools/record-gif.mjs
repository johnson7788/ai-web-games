// 录制真实玩法 → webm（ffmpeg 转 game.gif 用）
// 用法：node tools/record-gif.mjs [out.webm] [levelIndex] [seed]
// 用 ctx.close() 后再读 webm 目录（避免 Playwright saveAs 在并行环境卡死）。
import { createServer } from 'node:http';
import { readFile, readdir } from 'node:fs/promises';
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
await new Promise((r) => server.listen(8157, r));

const out = process.argv[2] || 'tests/artifacts/gameplay.webm';
const levelIdx = Number(process.argv[3] ?? 2);
const seed = Number(process.argv[4] ?? 5);
const outDir = dirname(join(ROOT, out));

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, recordVideo: { dir: outDir, size: { width: 1280, height: 720 } } });
const page = await ctx.newPage();
await page.goto('http://127.0.0.1:8157/');
await page.waitForTimeout(700);
await page.evaluate(([lv, sd]) => {
  window.__ll.debug.setTutorialDone(true);
  window.__ll.debug.startSeeded(lv, sd);
}, [levelIdx, seed]);
await page.waitForTimeout(400);
// 逐块自动拾取（前 3 秒即见核心动作 + 三同金币雨），控制在 ~4.5s 内
for (let i = 0; i < 18; i += 1) {
  const more = await page.evaluate(() => window.__ll.debug.pickNext());
  if (!more) break;
  await page.waitForTimeout(i % 3 === 2 ? 280 : 120);
}
await page.waitForTimeout(500);
await ctx.close().catch(() => {});
await browser.close().catch(() => {});
server.closeAllConnections?.();
server.close();

// 读 webm 目录
const files = await readdir(outDir);
const webm = files.find((f) => f.endsWith('.webm'));
if (!webm) { console.error('no webm produced'); process.exit(1); }
const webmPath = join(outDir, webm);
const gifPath = join(ROOT, 'game.gif');
const palPath = join(outDir, 'palette.png');
// 转 gif：480×270、10fps、循环、限色降体积
execFileSync('ffmpeg', ['-y', '-i', webmPath, '-vf', 'fps=10,scale=480:270:flags=lanczos,palettegen=stats_mode=diff:max_colors=128', palPath], { stdio: 'ignore' });
execFileSync('ffmpeg', ['-y', '-i', webmPath, '-i', palPath, '-lavfi', 'fps=10,scale=480:270:flags=lanczos[x];[x][1:v]paletteuse=dither=sierra2_4a', '-loop', '0', gifPath], { stdio: 'ignore' });
console.log('saved', gifPath);
process.exit(0);
