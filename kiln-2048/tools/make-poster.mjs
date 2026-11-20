// 生成上线物料：poster.jpg(1280×720)、poster-1920.jpg、icon.png(256)、favicon.png。
// 用法：node tools/make-poster.mjs
import { createServer } from 'node:http';
import { readFile, writeFile, copyFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { extname, join, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
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
await new Promise((r) => server.listen(8201, r));

const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=metal'] });

// ---- poster.jpg（标题屏 1280×720） ----
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage();
  await page.goto('http://127.0.0.1:8201/');
  await page.waitForTimeout(800);
  await page.screenshot({ path: join(ROOT, 'poster.jpg'), type: 'jpeg', quality: 90 });
  await ctx.close();
}

// ---- icon.png（256×256：天青出窑 signature 球） ----
{
  const ctx = await browser.newContext({ viewport: { width: 256, height: 256 } });
  const page = await ctx.newPage();
  await page.setContent('<canvas id="c" width="256" height="256"></canvas>');
  const dataUrl = await page.evaluate(() => {
    const c = document.getElementById('c');
    const g = c.getContext('2d');
    const x = 128, y = 128, r = 92;
    const bg = g.createRadialGradient(128, 128, 10, 128, 128, 170);
    bg.addColorStop(0, '#FFE9A0');
    bg.addColorStop(0.5, '#F0A94A');
    bg.addColorStop(1, '#8A3A16');
    g.fillStyle = bg;
    g.fillRect(0, 0, 256, 256);
    const ball = g.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.12, x, y, r);
    ball.addColorStop(0, '#CFF6FD');
    ball.addColorStop(0.55, '#6FD8E8');
    ball.addColorStop(1, '#2E8FA8');
    g.fillStyle = ball;
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = '#1E6E82';
    g.lineWidth = 5;
    g.stroke();
    g.fillStyle = 'rgba(255,255,255,0.4)';
    g.beginPath();
    g.ellipse(x - r * 0.32, y - r * 0.42, r * 0.3, r * 0.18, -0.6, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#083038';
    g.font = '900 54px "PingFang SC", sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.lineWidth = 6;
    g.strokeStyle = 'rgba(255,255,255,0.5)';
    g.strokeText('2048', x, y + 2);
    g.fillText('2048', x, y + 2);
    return c.toDataURL('image/png');
  });
  const b64 = dataUrl.split(',')[1];
  await writeFile(join(ROOT, 'icon.png'), Buffer.from(b64, 'base64'));
  await ctx.close();
}

await browser.close();
server.closeAllConnections?.();
server.close();

// ---- favicon.png = icon.png 拷贝 ----
await copyFile(join(ROOT, 'icon.png'), join(ROOT, 'favicon.png'));

// ---- poster-1920.jpg（ffmpeg 放大到 1920×1080） ----
execFileSync('/opt/homebrew/bin/ffmpeg', [
  '-y', '-i', join(ROOT, 'poster.jpg'), '-vf', 'scale=1920:1080', '-q:v', '3',
  join(ROOT, 'poster-1920.jpg'),
], { stdio: 'ignore' });

console.log('poster.jpg / poster-1920.jpg / icon.png / favicon.png 完成');
process.exit(0);
