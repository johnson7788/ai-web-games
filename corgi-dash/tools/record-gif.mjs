// tools/record-gif.mjs — 录制真实玩法 webm → ffmpeg 转 game.gif（480×270，≤2MB）
// 用法：node tools/record-gif.mjs [out.gif]
// 依赖：playwright + /opt/homebrew/bin/ffmpeg
import { createServer } from 'node:http';
import { readFile, mkdir, rm } from 'node:fs/promises';
import { extname, join, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import pw from '/opt/homebrew/lib/node_modules/playwright/index.js';

const { chromium } = pw;
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.json': 'application/json' };

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
await new Promise((r) => server.listen(8148, r));

const out = process.argv[2] || 'game.gif';
const tmpDir = join(ROOT, 'tests/artifacts/gif-tmp');
await rm(tmpDir, { recursive: true, force: true });
await mkdir(tmpDir, { recursive: true });

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=metal'] });
const ctx = await browser.newContext({
  viewport: { width: 1280, height: 720 },
  recordVideo: { dir: tmpDir, size: { width: 1280, height: 720 } },
});
const page = await ctx.newPage();
await page.goto('http://127.0.0.1:8148/');
await page.waitForTimeout(900);
await page.click('#btn-start');
await page.waitForTimeout(500);
await page.click('[data-tutorial-skip]');
await page.waitForTimeout(200);
// 给足羊群缓冲，保证 4.5s 内不因失误死亡，画面持续在玩法里
await page.evaluate(() => { window.__ll.run.flock = 30; });

// 真实键盘输入：每 0.6s 一跳，覆盖核心动词（跳）+ 目标（赶羊/前进）
for (let i = 0; i < 8; i += 1) {
  await page.keyboard.press('Space');
  await page.waitForTimeout(560);
}

await page.waitForTimeout(300);
await ctx.close().catch(() => {});   // 先关 ctx 落盘 webm（saveAs 并行环境会卡死）
await browser.close().catch(() => {});

// 读 webm（ctx.close 后只有一份）
const { readdir } = await import('node:fs/promises');
const files = await readdir(tmpDir);
const webm = files.find((f) => f.endsWith('.webm'));
if (!webm) {
  console.error('未找到 webm 录像');
  server.close();
  process.exit(1);
}
const webmPath = join(tmpDir, webm);

// ffmpeg：480×270，12fps，palettegen/paletteuse，循环
execFileSync('/opt/homebrew/bin/ffmpeg', [
  '-y', '-ss', '1.5', '-i', webmPath, '-t', '4.5',
  '-vf', "fps=12,scale=480:270:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse",
  '-loop', '0',
  join(ROOT, out),
], { stdio: 'inherit' });

await rm(tmpDir, { recursive: true, force: true });
server.close();
console.log('saved', out);
process.exit(0);
