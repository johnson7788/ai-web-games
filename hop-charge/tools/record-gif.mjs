// 录制真实玩法 → webm（ffmpeg 转 game.gif 用）
// 用法：node tools/record-gif.mjs [out.webm] [levelIndex] [seed]
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { readdirSync, renameSync } from 'node:fs';
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
await new Promise((r) => server.listen(8151, r));

const out = process.argv[2] || 'tests/artifacts/gameplay.webm';
const levelIdx = Number(process.argv[3] ?? 0);
const seed = Number(process.argv[4] ?? 3);

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=metal'] });
const ctx = await browser.newContext({
  viewport: { width: 1280, height: 720 },
  recordVideo: { dir: dirname(join(ROOT, out)), size: { width: 1280, height: 720 } },
});
const page = await ctx.newPage();
await page.goto('http://127.0.0.1:8151/');
await page.waitForFunction(() => !!window.__ll, { timeout: 15000 }).catch(() => {});
await page.waitForTimeout(500);
await page.evaluate(([lv, sd]) => {
  window.__ll.debug.setTutorialDone(true);
  window.__ll.debug.startSeeded(lv, sd);
  window.__ll.debug.bot(true);
}, [levelIdx, seed]);
// 让 bot 实时玩约 5s：蓄力→起跳→落地清晰可见
await page.waitForTimeout(5000);
await ctx.close().catch(() => {}); // 关闭 context 会自动把录像写进 dir
await browser.close().catch(() => {});
server.closeAllConnections?.();
server.close();
// Playwright 自动命名 page@<hash>.webm；取最新一个改名为 out
const dir = dirname(join(ROOT, out));
const latest = readdirSync(dir).filter((f) => f.endsWith('.webm')).sort().pop();
if (latest) {
  renameSync(join(dir, latest), join(ROOT, out));
  console.log('saved', out);
} else {
  console.error('no webm found');
}
process.exit(0);
