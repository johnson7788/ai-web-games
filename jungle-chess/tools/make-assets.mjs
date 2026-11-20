// 生成上线物料：poster.jpg(1280×720) / poster-1920.jpg(1920×1080) / icon.png(256) / favicon.png。
// 自起 http 服务 → 真实运行 → 截图 → 用完即关。poster 用真实标题屏（棋盘 + 贴纸标题）。
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
await new Promise((r) => server.listen(8169, r));

const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=metal', '--autoplay-policy=no-user-gesture-required'] });

// poster.jpg：标题屏（隐藏关卡格/开始按钮，突出棋盘 + 贴纸标题）
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto('http://127.0.0.1:8169/');
await page.waitForTimeout(900);
await page.evaluate(() => {
  for (const id of ['level-grid', 'btn-start', 'lang-select', 'stars-total']) {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  }
  const sub = document.getElementById('subtitle-text');
  if (sub) sub.textContent = 'CROSS THE EMERALD RIVER · CLAIM THE DEN';
});
await page.waitForTimeout(200);
await page.screenshot({ path: join(ROOT, 'poster.jpg'), type: 'jpeg', quality: 90 });
// 同法放大到 1920×1080
execFileSync('/usr/bin/sips', ['-s', 'format', 'jpeg', '-Z', '1920', join(ROOT, 'poster.jpg'), '--out', join(ROOT, 'poster-1920.jpg')], { stdio: 'ignore' });

// icon.png：大号兽首徽章
await page.evaluate(() => window.__drawIcon('lion', 0));
await page.waitForTimeout(200);
await page.screenshot({ path: join(ROOT, 'icon-raw.png'), clip: { x: 640 - 140, y: 360 - 140, width: 280, height: 280 } });
execFileSync('/usr/bin/sips', ['-s', 'format', 'png', '-Z', '256', join(ROOT, 'icon-raw.png'), '--out', join(ROOT, 'icon.png')], { stdio: 'ignore' });
execFileSync('/usr/bin/sips', ['-s', 'format', 'png', '-Z', '32', join(ROOT, 'icon.png'), '--out', join(ROOT, 'favicon.png')], { stdio: 'ignore' });

await browser.close();
server.closeAllConnections?.();
server.close();
console.log('assets done');
