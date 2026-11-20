// 上线物料：poster.jpg（1280×720）/ poster-1920.jpg（1920×1080）/ icon.png（256×256）/ favicon.png（64×64）
// 用法：node tools/make-assets.mjs
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { writeFileSync } from 'node:fs';
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
await new Promise((r) => server.listen(8150, r));

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto('http://127.0.0.1:8150/');
await page.waitForFunction(() => typeof window.__ll !== 'undefined', { timeout: 15000 }).catch(() => {});
await page.waitForTimeout(900);

// 标题屏即海报（真实标题屏 + 大标题贴纸字 + 玩法场景）
await page.screenshot({ path: join(ROOT, 'poster.jpg'), type: 'jpeg', quality: 90 });
// 1920×1080：sips 放大
execFileSync('/usr/bin/sips', ['-s', 'format', 'jpeg', '-s', 'formatOptions', '90', '-z', '1080', '1920', join(ROOT, 'poster.jpg'), '--out', join(ROOT, 'poster-1920.jpg')], { stdio: 'ignore' });

// icon / favicon：离屏绘制「墨雀 + 朱砂印」
const iconData = await page.evaluate(() => {
  function draw(size) {
    const c = document.createElement('canvas');
    c.width = size; c.height = size;
    const g = c.getContext('2d');
    const s = size / 256;
    // 宣纸底
    g.fillStyle = '#F5F1E8';
    g.fillRect(0, 0, size, size);
    // 墨圈（印章外环）
    g.strokeStyle = '#23232b';
    g.lineWidth = 10 * s;
    g.beginPath(); g.arc(128 * s, 128 * s, 108 * s, 0, Math.PI * 2); g.stroke();
    // 墨雀（简笔）
    g.translate(128 * s, 122 * s);
    g.fillStyle = '#23232b';
    g.beginPath(); g.ellipse(0, 0, 52 * s, 40 * s, -0.2, 0, Math.PI * 2); g.fill(); // 身体
    g.beginPath(); g.arc(40 * s, -14 * s, 26 * s, 0, Math.PI * 2); g.fill(); // 头
    g.beginPath(); g.moveTo(60 * s, -20 * s); g.lineTo(88 * s, -10 * s); g.lineTo(60 * s, -4 * s); g.closePath(); g.fill(); // 喙
    g.fillStyle = '#3a3a44';
    g.beginPath(); g.ellipse(-8 * s, -6 * s, 30 * s, 16 * s, -0.6, 0, Math.PI * 2); g.fill(); // 翅
    // 朱砂眼
    g.fillStyle = '#C8402A';
    g.beginPath(); g.arc(42 * s, -20 * s, 7 * s, 0, Math.PI * 2); g.fill();
    // 朱砂印（右下角）
    g.fillStyle = '#C8402A';
    g.fillRect(0, 0, 0, 0);
    g.translate(0, 0);
    g.beginPath();
    g.fillStyle = '#C8402A';
    const rx = 96 * s, ry = 96 * s, rw = 76 * s;
    g.fillRect(rx, ry, rw, rw);
    g.fillStyle = '#fff6ec';
    g.font = `900 ${52 * s}px serif`;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('印', rx + rw / 2, ry + rw / 2 + 2 * s);
    return c.toDataURL('image/png');
  }
  return { icon: draw(256), fav: draw(64) };
});

const b64toBuf = (b64) => Buffer.from(b64.split(',')[1], 'base64');
writeFileSync(join(ROOT, 'icon.png'), b64toBuf(iconData.icon));
writeFileSync(join(ROOT, 'favicon.png'), b64toBuf(iconData.fav));

await browser.close();
server.closeAllConnections?.();
server.close();
console.log('saved poster.jpg / poster-1920.jpg / icon.png / favicon.png');
