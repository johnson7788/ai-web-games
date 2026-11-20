// 生成上线物料：poster.jpg (1280×720) + poster-1920.jpg (1920×1080)。
// 真实玩法画面（磷光夜海 + 幽灵灯笼鱼）上叠大标题贴纸字 → Playwright 截图。
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
await new Promise((r) => server.listen(8162, r));

const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=metal'] });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
await page.goto('http://127.0.0.1:8162/');
await page.waitForTimeout(800);

// 磷光夜海 + 幽灵灯笼鱼 + 海龟（真实玩法画面）
await page.evaluate(() => {
  window.__ll.debug.setTutorialDone(true);
  window.__ll.debug.startSeeded(8, 5);
  window.__ll.debug.spawnFish('ghost', 620, 260, -1);
  window.__ll.debug.spawnFish('turtle', 900, 420, 1);
  window.__ll.debug.spawnFish('manta', 420, 430, 1);
});

// 隐藏 HUD 与教程，露出干净玩法画面
await page.addStyleTag({ content: '#hud { display:none !important; } #tutorial { display:none !important; } #rotate-screen { display:none !important; }' });

// 大标题贴纸字
await page.evaluate(() => {
  const style = document.createElement('style');
  style.textContent = `
    #poster-overlay { position: absolute; inset: 0; z-index: 40; pointer-events: none; display: flex; flex-direction: column; align-items: center; justify-content: flex-start; padding-top: 52px; }
    #poster-title { font-size: 96px; font-weight: 900; letter-spacing: 0.05em; line-height: 1.02;
      background: linear-gradient(180deg,#C8FFF0 0%,#5FE0C8 42%,#2FA8B8 100%);
      -webkit-background-clip: text; background-clip: text; color: transparent;
      -webkit-text-stroke: 3px #0E3B5A; paint-order: stroke fill;
      filter: drop-shadow(0 6px 0 rgba(0,0,0,0.4)); }
    #poster-sub { margin-top: 14px; font-size: 26px; font-weight: 800; color: #EAFDFF; text-shadow: 0 3px 6px rgba(0,0,0,0.6); letter-spacing: 0.03em; }
    #poster-badge { margin-top: 18px; padding: 8px 22px; border-radius: 999px; background: #0E3B5A; color: #FFD84E; font-weight: 900; font-size: 20px; border: 2px solid #5FE0C8; }
  `;
  document.head.appendChild(style);
  const div = document.createElement('div');
  div.id = 'poster-overlay';
  div.innerHTML = `<div id="poster-title">REEF RAIDER</div><div id="poster-sub">Fire light-bulbs · net the fish · light up the deep</div><div id="poster-badge">DEEP-SEA FIREWORKS</div>`;
  document.getElementById('game-container').appendChild(div);
});
await page.waitForTimeout(600);
await page.screenshot({ path: join(ROOT, 'poster.jpg'), type: 'jpeg', quality: 90 });

await browser.close();
server.closeAllConnections?.();
server.close();

// 1920×1080：ffmpeg 上采样
try {
  execFileSync('ffmpeg', ['-y', '-i', join(ROOT, 'poster.jpg'), '-vf', 'scale=1920:1080:flags=lanczos', '-q:v', '2', join(ROOT, 'poster-1920.jpg')], { stdio: 'pipe' });
} catch (e) { console.error('ffmpeg poster upscale failed:', e.message); }
console.log('poster done');
process.exit(0);
