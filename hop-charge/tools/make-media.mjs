// 生成上线物料：poster.jpg（1280×720，标题叠字）+ icon.png（256×256 提灯小狸猫）。
// poster-1920.jpg 与 favicon.png 由 ffmpeg 从 poster/icon 缩放得到。
// 用法：node tools/make-media.mjs
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
await new Promise((r) => server.listen(8188, r));

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=metal'] });

// ---- poster.jpg（1280×720，标题叠字）----
{
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
  await page.goto('http://127.0.0.1:8188/');
  await page.waitForFunction(() => !!window.__ll, { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(600);
  // 隐藏游戏自带标题 DOM，只留 canvas 玩法画面 + 自定义标题叠字
  await page.evaluate(() => {
    const t = document.getElementById('screen-title');
    if (t) t.style.display = 'none';
    const hud = document.getElementById('hud');
    if (hud) hud.style.display = 'none';
    // 让角色带上灯笼火光（标题场景）
    if (window.__drawTitle) window.__drawTitle();
  });
  await page.evaluate(() => {
    const el = document.createElement('div');
    el.id = 'poster-overlay';
    el.innerHTML = `
      <div style="position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:flex-start;padding-top:72px;pointer-events:none;">
        <div style="font:900 96px/1 'Segoe UI','PingFang SC',system-ui,sans-serif;color:#FFC24E;letter-spacing:4px;text-shadow:0 4px 30px rgba(255,140,50,0.85),0 2px 6px rgba(0,0,0,0.5);">HOP CHARGE</div>
        <div style="margin-top:14px;font:600 26px/1.2 'Segoe UI','PingFang SC',system-ui,sans-serif;color:#FFE4A0;letter-spacing:2px;text-shadow:0 2px 10px rgba(0,0,0,0.6);">Charge · Leap · Light the Night</div>
      </div>`;
    document.body.appendChild(el);
  });
  await page.waitForTimeout(250);
  await page.screenshot({ path: join(ROOT, 'poster.jpg'), type: 'jpeg', quality: 88 });
  await page.close();
}

// ---- icon.png（256×256）----
{
  const page = await (await browser.newContext({ viewport: { width: 256, height: 256 } })).newPage();
  await page.goto('http://127.0.0.1:8188/');
  await page.waitForFunction(() => !!window.__ll, { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(400);
  await page.evaluate(() => {
    window.__ll.debug.freezeRender(true); // 冻结主循环，防止标题场景覆盖图标画布
    window.__renderIcon(256);
    const c = document.getElementById('canvas');
    c.style.width = '256px';
    c.style.height = '256px';
    const g = document.getElementById('game-container');
    g.style.width = '256px';
    g.style.height = '256px';
    g.style.maxWidth = 'none';
    g.style.maxHeight = 'none';
    document.querySelectorAll('.screen,#hud,#tutorial,#rotate-screen,#poster-overlay').forEach((n) => { n.style.display = 'none'; });
  });
  await page.waitForTimeout(80);
  await page.locator('#canvas').screenshot({ path: join(ROOT, 'icon.png') });
  await page.close();
}

await browser.close().catch(() => {});
server.closeAllConnections?.();
server.close();

// ---- 缩放得到 poster-1920.jpg 与 favicon.png ----
try {
  execFileSync('ffmpeg', ['-y', '-i', join(ROOT, 'poster.jpg'), '-vf', 'scale=1920:1080', '-q:v', '2', join(ROOT, 'poster-1920.jpg')], { stdio: 'ignore' });
  console.log('poster-1920.jpg ok');
} catch (e) { console.warn('poster-1920 scale failed', e.message); }
try {
  execFileSync('ffmpeg', ['-y', '-i', join(ROOT, 'icon.png'), '-vf', 'scale=32:32', join(ROOT, 'favicon.png')], { stdio: 'ignore' });
  console.log('favicon.png ok');
} catch (e) { console.warn('favicon scale failed', e.message); }

console.log('done: poster.jpg, poster-1920.jpg, icon.png, favicon.png');
process.exit(0);
