// 上线物料：poster.jpg(1280×720) / poster-1920.jpg / icon.png(256×256) / favicon.png
// 用法：node tools/make-poster.mjs
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
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
await new Promise((r) => server.listen(8148, r));

const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=metal', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', (e) => console.error('pageerror', e.message));
await page.goto('http://127.0.0.1:8148/', { waitUntil: 'load', timeout: 20000 });
await page.waitForTimeout(1100);
await page.screenshot({ path: join(ROOT, 'poster.jpg'), type: 'jpeg', quality: 90 });
await browser.close();
server.closeAllConnections?.();
server.close();

// 1920×1080 海报：lanczos 上采样
execFileSync('ffmpeg', ['-y', '-i', join(ROOT, 'poster.jpg'), '-vf', 'scale=1920:1080:flags=lanczos', join(ROOT, 'poster-1920.jpg')]);
// 图标：从标题沙蟒身体裁一块 512×512 → 256×256
execFileSync('ffmpeg', ['-y', '-i', join(ROOT, 'poster.jpg'), '-vf', 'crop=512:512:384:120,scale=256:256:flags=lanczos', join(ROOT, 'icon.png')]);
execFileSync('ffmpeg', ['-y', '-i', join(ROOT, 'icon.png'), join(ROOT, 'favicon.png')]);

console.log('poster.jpg / poster-1920.jpg / icon.png / favicon.png 已生成');
process.exit(0);
