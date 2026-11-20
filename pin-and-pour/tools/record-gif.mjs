// 录制真实玩法 → webm（ffmpeg 转 game.gif 用）
// 用法：node tools/record-gif.mjs [out.webm] [levelIndex] [seed]
import { createServer } from 'node:http';
import { readFile, rename } from 'node:fs/promises';
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
await new Promise((r) => server.listen(8153, r));

const out = join(ROOT, process.argv[2] || 'tests/artifacts/gameplay.webm');
const levelIdx = Number(process.argv[3] ?? 1);
const seed = Number(process.argv[4] ?? 5);

const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=metal', '--autoplay-policy=no-user-gesture-required'] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, recordVideo: { dir: dirname(out), size: { width: 1280, height: 720 } } });
const page = await ctx.newPage();
await page.goto('http://127.0.0.1:8153/');
await page.waitForTimeout(700);
await page.evaluate(([lv, sd]) => {
  window.__ll.debug.setTutorialDone(true);
  window.__ll.debug.startSeeded(lv, sd);
}, [levelIdx, seed]);
await page.waitForTimeout(600);

// 手动按获胜顺序抽闸（带停顿，录出「拉闸→流动→装瓶」的核心动作）
const sequences = {
  0: ['g1'],
  1: ['g2', 'g1'],
  2: ['g3', 'g1'],
  3: ['g2', 'g1'],
};
const seq = sequences[levelIdx] || sequences[1];
for (const id of seq) {
  await page.evaluate((gid) => { window.__ll.run().pullGate(gid); }, id);
  await page.waitForTimeout(900);
}
await page.waitForTimeout(2400);

const vpath = await page.video().path();
await ctx.close();
await rename(vpath, out).catch(async () => {});
await browser.close().catch(() => {});
server.closeAllConnections?.();
server.close();
console.log('saved', out);
process.exit(0);
