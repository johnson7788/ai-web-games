// 录制真实玩法 → PNG 帧序列（ffmpeg paletteuse 转 game.gif 用）
// 用法：node tools/record-gif.mjs [framesDir] [levelIndex]
// 之后：ffmpeg -framerate 4 -i frames/f%03d.png ... → game.gif
import { createServer } from 'node:http';
import { readFile, mkdir, rm } from 'node:fs/promises';
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
await new Promise((r) => server.listen(8152, r));

const framesDir = process.argv[2] || 'tests/artifacts/gif-frames';
const levelIdx = Number(process.argv[3] ?? 1);
await rm(join(ROOT, framesDir), { recursive: true, force: true });
await mkdir(join(ROOT, framesDir), { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto('http://127.0.0.1:8152/');
await page.waitForTimeout(700);
await page.evaluate(() => window.__ll.debug.setTutorialDone(true));
await page.evaluate((lv) => window.__ll.debug.startLevel(lv), levelIdx);
await page.waitForTimeout(400);

// 约 4.5s：前 3 秒必须出现核心动词（掷刀）+ 目标（桩）。每 250ms 一张帧。
const FRAMES = 18;
for (let i = 0; i < FRAMES; i += 1) {
  if (i === 1 || i === 4 || i === 7 || i === 10 || i === 13) {
    await page.mouse.click(640, 400); // 真实点击掷刀
  }
  await page.screenshot({ path: join(ROOT, framesDir, `f${String(i).padStart(3, '0')}.png`) });
  await page.waitForTimeout(250);
}

await browser.close();
server.closeAllConnections?.();
server.close();
console.log('frames saved to', framesDir);
process.exit(0);
