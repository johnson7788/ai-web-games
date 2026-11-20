// 生成 icon.png (256×256) + favicon.png (32×32)：从真实游戏画面裁切一只灯笼鱼王。
// 用法：node tools/make-icon.mjs
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import pw from '/opt/homebrew/lib/node_modules/playwright/index.js';
const { chromium } = pw;

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
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
await new Promise((r) => server.listen(8164, r));

const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=metal'] });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
await page.goto('http://127.0.0.1:8164/');
await page.waitForFunction(() => typeof window.__ll !== 'undefined', { timeout: 10000 }).catch(() => {});
await page.evaluate(() => {
  window.__ll.debug.setTutorialDone(true);
  window.__ll.debug.startSeeded(8, 5); // 磷光夜海
  window.__ll.debug.spawnFish('king', 640, 330, 1);
});
await page.addStyleTag({ content: '#hud { display:none !important; } #tutorial { display:none !important; }' });
await page.waitForTimeout(500);
await page.screenshot({ path: join(ROOT, 'tests', 'artifacts', 'icon-src.png') });
await browser.close();
server.closeAllConnections?.();
server.close();

try {
  execFileSync('ffmpeg', ['-y', '-i', join(ROOT, 'tests', 'artifacts', 'icon-src.png'), '-vf', 'crop=360:360:460:150,scale=256:256:flags=lanczos', join(ROOT, 'icon.png')], { stdio: 'pipe' });
  execFileSync('ffmpeg', ['-y', '-i', join(ROOT, 'icon.png'), '-vf', 'scale=32:32:flags=lanczos', join(ROOT, 'favicon.png')], { stdio: 'pipe' });
} catch (e) { console.error('ffmpeg icon failed:', e.message); process.exit(1); }
console.log('icon + favicon done');
process.exit(0);
