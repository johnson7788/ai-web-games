// 上线物料：poster.jpg(1280x720) / poster-1920.jpg(1920x1080) / icon-src.png。
// HTML 叠字 + Playwright 截图；icon 由 icon-src 再 ffmpeg 裁切缩放。
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { mkdirSync } from 'node:fs';
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
await new Promise((r) => server.listen(8145, r));

const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=metal', '--autoplay-policy=no-user-gesture-required'] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
await page.goto('http://127.0.0.1:8145/', { waitUntil: 'load' });
await page.waitForTimeout(600);
await page.evaluate(() => window.__ll.debug.setTutorialDone(true));
mkdirSync(ROOT, { recursive: true });

function addTitleOverlay() {
  return page.evaluate(() => {
    document.querySelector('#poster-overlay')?.remove();
    const ov = document.createElement('div');
    ov.id = 'poster-overlay';
    ov.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:50;display:flex;flex-direction:column;justify-content:center;align-items:center;';
    ov.innerHTML =
      `<div style="font:900 128px/1 'Segoe UI',sans-serif;color:#fff;letter-spacing:0.04em;text-shadow:0 6px 0 #0a3a55,0 0 34px rgba(127,208,232,0.9);">DEPTH DIVER</div>` +
      `<div style="font:700 30px/1.4 'Segoe UI',sans-serif;color:#dff6ff;text-shadow:0 2px 6px #02131f;margin-top:12px;">Dive the trench · Collect the glow · Beat the dark</div>`;
    document.getElementById('game-container').appendChild(ov);
  });
}

// 海报场景：阳光浅海 + 样本 + 礁石 + 潜航器
async function stagePoster() {
  await page.evaluate(() => {
    window.__ll.debug.startSeeded(0, 5);
    const st = window.__ll.run().state;
    st.player.x = 560; st.player.y = 320;
    st.pickups = [
      { kind: 'sample', x: 420, y: 460, r: 22, taken: false },
      { kind: 'sample', x: 960, y: 540, r: 22, taken: false },
      { kind: 'sample', x: 760, y: 470, r: 22, taken: false },
    ];
    st.obstacles = [
      { kind: 'rock', x: 640, y: 560, r: 60, passed: false },
      { kind: 'rock', x: 880, y: 640, r: 66, passed: false },
      { kind: 'rock', x: 340, y: 600, r: 54, passed: false },
    ];
  });
}

await stagePoster();
await page.waitForTimeout(400);
addTitleOverlay();
await page.waitForTimeout(250);
await page.screenshot({ path: join(ROOT, 'poster.jpg'), type: 'jpeg', quality: 92 });

// 1920×1080 版
const ctx2 = await browser.newContext({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
const page2 = await ctx2.newPage();
await page2.goto('http://127.0.0.1:8145/', { waitUntil: 'load' });
await page2.waitForTimeout(600);
await page2.evaluate(() => window.__ll.debug.setTutorialDone(true));
await page2.evaluate(() => {
  window.__ll.debug.startSeeded(0, 5);
  const st = window.__ll.run().state;
  st.player.x = 560; st.player.y = 320;
  st.pickups = [
    { kind: 'sample', x: 420, y: 460, r: 22, taken: false },
    { kind: 'sample', x: 960, y: 540, r: 22, taken: false },
    { kind: 'sample', x: 760, y: 470, r: 22, taken: false },
  ];
  st.obstacles = [
    { kind: 'rock', x: 640, y: 560, r: 60, passed: false },
    { kind: 'rock', x: 880, y: 640, r: 66, passed: false },
    { kind: 'rock', x: 340, y: 600, r: 54, passed: false },
  ];
});
await page2.waitForTimeout(400);
await page2.evaluate(() => {
  const ov = document.createElement('div');
  ov.id = 'poster-overlay';
  ov.style.cssText = 'position:absolute;inset:0;pointer-events:none;z-index:50;display:flex;flex-direction:column;justify-content:center;align-items:center;';
  ov.innerHTML =
    `<div style="font:900 176px/1 'Segoe UI',sans-serif;color:#fff;letter-spacing:0.04em;text-shadow:0 8px 0 #0a3a55,0 0 44px rgba(127,208,232,0.9);">DEPTH DIVER</div>` +
    `<div style="font:700 42px/1.4 'Segoe UI',sans-serif;color:#dff6ff;text-shadow:0 3px 8px #02131f;margin-top:16px;">Dive the trench · Collect the glow · Beat the dark</div>`;
  document.getElementById('game-container').appendChild(ov);
});
await page2.waitForTimeout(250);
await page2.screenshot({ path: join(ROOT, 'poster-1920.jpg'), type: 'jpeg', quality: 92 });

// icon 源：潜航器居中 + 一个样本
await page.evaluate(() => {
  window.__ll.debug.startSeeded(0, 1);
  const st = window.__ll.run().state;
  st.player.x = 560; st.player.y = 330;
  st.pickups = [{ kind: 'sample', x: 660, y: 400, r: 22, taken: false }];
  st.obstacles = [];
});
await page.waitForTimeout(350);
await page.screenshot({ path: join(ROOT, 'tests', 'artifacts', 'icon-src.png') });

await ctx2.close();
await browser.close();
server.closeAllConnections?.();
server.close();
console.log('materials done');
