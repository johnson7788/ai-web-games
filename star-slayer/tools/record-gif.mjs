// tools/record-gif.mjs — 录制真实玩法 → ffmpeg 转 game.gif（480×270）
// 用法：node tools/record-gif.mjs
// 关键：先 ctx.close() 让 Playwright 落盘 webm，再读目录转码（saveAs 在并行环境会卡死）。
import { createServer } from 'node:http';
import { readFileSync, readdirSync, mkdirSync, existsSync, rmSync } from 'node:fs';
import { extname, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import pw from '/opt/homebrew/lib/node_modules/playwright/index.js';
const { chromium } = pw;

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.json': 'application/json', '.webm': 'video/webm' };
const GIF_DIR = join(ROOT, 'tools', 'artifacts', 'gif-src');
mkdirSync(GIF_DIR, { recursive: true });

const server = createServer((req, res) => {
  try {
    const url = decodeURIComponent((req.url || '/').split('?')[0]);
    const file = join(ROOT, url === '/' ? 'index.html' : url);
    if (!file.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
    const data = readFileSync(file);
    res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream' });
    res.end(data);
  } catch { res.writeHead(404); res.end(); }
});
await new Promise((r) => server.listen(8153, r));

const browser = await chromium.launch({
  headless: true,
  args: ['--use-gl=angle', '--use-angle=metal', '--autoplay-policy=no-user-gesture-required'],
});
const ctx = await browser.newContext({
  viewport: { width: 1280, height: 720 },
  recordVideo: { dir: GIF_DIR, size: { width: 1280, height: 720 } },
});
const page = await ctx.newPage();
await page.goto('http://127.0.0.1:8153/', { waitUntil: 'load', timeout: 20000 });
await page.waitForFunction(() => window.__ll?.state?.phase !== 'boot', { timeout: 10000 });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'load' });
await page.waitForFunction(() => window.__ll?.state?.phase !== 'boot', { timeout: 10000 });
await page.click('#btn-start');
await page.waitForTimeout(500);
await page.click('[data-tutorial-skip]');
await page.waitForTimeout(300);

// 摆一个干净战斗构图，然后真实按住开火 + 左右拉扯，录下核心动词（射击）+ 目标（敌机）
await page.evaluate(() => {
  const r = window.__ll.run;
  const raider = (id, x, y, hp, maxHp) => ({
    id, type: 'raider', x, y, r: 14, hp, maxHp, speed: 60, touchDmg: 15,
    color: '#ff5d73', score: 10, dashCd: 99, dashT: 0, dashDirx: 0, dashDiry: 0, fireCd: 99, spawnT: 0,
  });
  r.spawnQueue = [];
  r.enemies = [];
  r.player.x = 640; r.player.y = 430; r.player.aim = -Math.PI / 2;
  r.core.x = 640; r.core.y = 500; r.core.online = true;
  r.enemies.push(raider(1, 500, 320, 30, 30));
  r.enemies.push(raider(2, 800, 340, 30, 30));
  r.enemies.push(raider(3, 520, 560, 30, 30));
  r.enemies.push(raider(4, 820, 570, 30, 30));
});

await page.keyboard.down('KeyJ');
await page.keyboard.down('KeyD');
await page.waitForTimeout(1500);
await page.keyboard.up('KeyD');
await page.keyboard.down('KeyA');
await page.waitForTimeout(1500);
await page.keyboard.up('KeyA');
await page.keyboard.down('KeyD');
await page.waitForTimeout(1200);
await page.keyboard.up('KeyD');
await page.keyboard.up('KeyJ');

await ctx.close().catch(() => {});
await browser.close().catch(() => {});
server.closeAllConnections?.();
server.close();

// 读目录里的 webm，转 gif
const webm = readdirSync(GIF_DIR).find((f) => f.endsWith('.webm'));
if (!webm) {
  console.error('未找到录制产物 webm');
  process.exit(1);
}
const src = join(GIF_DIR, webm);
const palette = join(GIF_DIR, 'palette.png');
const out = join(ROOT, 'game.gif');
const FF = '/opt/homebrew/bin/ffmpeg';
execFileSync(FF, ['-y', '-i', src, '-vf', 'fps=12,scale=480:270:flags=lanczos,palettegen', palette], { stdio: 'ignore' });
execFileSync(FF, ['-y', '-i', src, '-i', palette, '-filter_complex', 'fps=12,scale=480:270:flags=lanczos[x];[x][1:v]paletteuse', '-loop', '0', out], { stdio: 'ignore' });
console.log('saved', out, '(', readFileSync(out).length, 'bytes )');
