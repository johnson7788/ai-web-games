// 录制真实玩法 → webm（ffmpeg 转 game.gif 用）
// 用法：node tools/record-gif.mjs [out.webm] [levelIndex] [seed]
// 坑：saveAs 在录制未结束时调用会死锁；正确顺序 = video.path() → ctx.close() → 复制文件。
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { mkdirSync, copyFileSync } from 'node:fs';
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
await new Promise((r) => server.listen(8143, r));

const out = join(ROOT, process.argv[2] || 'tests/artifacts/gameplay.webm');
const levelIdx = Number(process.argv[3] ?? 0);
const seed = Number(process.argv[4] ?? 3);
mkdirSync(dirname(out), { recursive: true });

const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=metal', '--autoplay-policy=no-user-gesture-required'] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, recordVideo: { dir: dirname(out), size: { width: 1280, height: 720 } } });
const page = await ctx.newPage();
await page.goto('http://127.0.0.1:8143/');
await page.waitForTimeout(700);
await page.evaluate(([lv, sd]) => {
  window.__ll.debug.setTutorialDone(true);
  window.__ll.debug.startSeeded(lv, sd);
}, [levelIdx, seed]);
// 前 ~1.2s：潜航器自动下沉、采集开局样本（金色闪光）
await page.waitForTimeout(1200);
// 中段：按住上浮，越过逼近的礁石（核心动词 + 头灯光锥）
await page.keyboard.down('Space');
await page.waitForTimeout(1500);
await page.keyboard.up('Space');
// 尾段：向右微调躲开下一个障碍
await page.keyboard.down('ArrowRight');
await page.waitForTimeout(1100);
await page.keyboard.up('ArrowRight');
await page.waitForTimeout(400);

const video = page.video();
const src = await video.path();
await ctx.close();
await copyFileSync(src, out);
await browser.close().catch(() => {});
server.closeAllConnections?.();
server.close();
console.log('saved', out);
process.exit(0);
