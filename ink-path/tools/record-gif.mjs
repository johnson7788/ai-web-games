// INK PATH · 录制真实玩法 → PNG 帧序列（ffmpeg 合成 game.gif 用）。
// 用法：node tools/record-gif.mjs [levelIndex] [seed]
// 不依赖 recordVideo（避免多机并发时 ffmpeg 录屏卡死），改用逐帧截图：
// 自起 http 服务 → startSeeded → 逐步织丝（核心玩法在前 3 秒）→ 截帧 → 用完即关。
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { mkdirSync } from 'node:fs';
import { extname, join, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import pw from '/opt/homebrew/lib/node_modules/playwright/index.js';
const { chromium } = pw;

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const FRAMES = join(ROOT, 'tests', 'artifacts', 'frames');
mkdirSync(FRAMES, { recursive: true });
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
await new Promise((r) => server.listen(8181, r));

const levelIdx = Number(process.argv[2] ?? 9); // L10 九星大网
const seed = Number(process.argv[3] ?? 5);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto('http://127.0.0.1:8181/');
await page.waitForTimeout(800);
await page.evaluate(([lv, sd]) => {
  window.__ll.debug.setTutorialDone(true);
  window.__ll.debug.startSeeded(lv, sd);
}, [levelIdx, seed]);
await page.waitForTimeout(400);

const sol = await page.evaluate(() => window.__ll.run()._solution || []);
const moves = sol.slice(1, 7); // 织 6 步，不织完（避免结算屏）
const moveAt = new Map([[3, 0], [8, 1], [13, 2], [18, 3], [23, 4], [28, 5]]);

for (let i = 0; i < 36; i += 1) {
  if (moveAt.has(i)) {
    const mi = moveAt.get(i);
    await page.evaluate((id) => window.__ll.run().tryMove(id), moves[mi]);
  }
  await page.screenshot({ path: join(FRAMES, `f_${String(i).padStart(3, '0')}.png`) });
  await page.waitForTimeout(110);
}

await browser.close();
server.closeAllConnections?.();
server.close();
console.log(`captured 36 frames → ${FRAMES}`);
process.exit(0);
