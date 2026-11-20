// 录制真实玩法 → game.gif（480×270、3–6s 循环、≤2MB）
// 逐帧截图（比 recordVideo 更稳）→ ffmpeg 合成为 gif。
// 用法：node tools/record-gif.mjs
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { mkdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { extname, join, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import pw from '/opt/homebrew/lib/node_modules/playwright/index.js';
const { chromium } = pw;

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const FRAMES = join(ROOT, 'tests', 'artifacts', 'frames');
mkdirSync(FRAMES, { recursive: true });
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
await new Promise((r) => server.listen(8212, r));

const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=metal'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto('http://127.0.0.1:8212/');
await page.waitForTimeout(700);
await page.evaluate(() => {
  window.__ll.debug.setTutorialDone(true);
  window.__ll.debug.startSeeded(0, 3);
});

// 抓 48 帧；每 8 帧投放一枚（约 0.5s/枚），前 3 秒即有下落 + 合并
const N = 48;
for (let i = 0; i < N; i += 1) {
  if (i > 0 && i % 8 === 0) {
    await page.evaluate(() => window.__ll.debug.dropNext());
  }
  await page.screenshot({ path: join(FRAMES, `f_${String(i).padStart(3, '0')}.png`) });
}

await browser.close().catch(() => {});
server.closeAllConnections?.();
server.close();

const gif = join(ROOT, 'game.gif');
execFileSync('/opt/homebrew/bin/ffmpeg', [
  '-y', '-framerate', '12', '-i', join(FRAMES, 'f_%03d.png'),
  '-vf', 'scale=480:270:flags=lanczos', '-loop', '0', gif,
], { stdio: 'ignore' });
console.log('saved', gif);
process.exit(0);
