// 录制真实玩法 → webm（ffmpeg 转 game.gif 用）
// 用法：node tools/record-gif.mjs [out.webm]
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
await new Promise((r) => server.listen(8148, r));

const out = process.argv[2] || 'tests/artifacts/gameplay.webm';
mkdirSync(dirname(join(ROOT, out)), { recursive: true });

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=metal', '--autoplay-policy=no-user-gesture-required'] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, recordVideo: { dir: dirname(join(ROOT, out)), size: { width: 1280, height: 720 } } });
const page = await ctx.newPage();
await page.goto('http://127.0.0.1:8148/');
await page.waitForTimeout(900);

// 开局 + 跳过引导
await page.evaluate(() => { try { window.__ll.start(); } catch (e) { console.warn(e); } });
await page.waitForTimeout(400);
await page.evaluate(() => { try { window.__ll.tutorial.skip(); } catch (e) { console.warn(e); } });
await page.waitForTimeout(400);

// 真实玩法：按住 D 向右移动 + 鼠标瞄准右侧敌人开火（前 3 秒即见核心动词）
await page.keyboard.down('KeyD');
await page.mouse.move(1000, 320);
await page.mouse.down();
await page.waitForTimeout(2400);
await page.mouse.up();
await page.keyboard.up('KeyD');
// 换向，追圈中心 + 继续射击
await page.mouse.move(700, 300);
await page.mouse.down();
await page.keyboard.down('KeyS');
await page.waitForTimeout(2100);
await page.mouse.up();
await page.keyboard.up('KeyS');

// saveAs 在并行/快速关闭时会卡死或报「已关闭」；改为先关 ctx 再读 webm 目录
await ctx.close().catch(() => {});
await browser.close().catch(() => {});
server.closeAllConnections?.();
server.close();

const { readdirSync, renameSync } = await import('node:fs');
const dir = dirname(join(ROOT, out));
const webms = readdirSync(dir).filter((f) => f.endsWith('.webm')).sort();
if (webms.length) {
  const src = join(dir, webms[webms.length - 1]);
  try { renameSync(src, join(ROOT, out)); } catch (e) { console.error('rename failed:', e.message); }
}
console.log('saved', out);
process.exit(0);
