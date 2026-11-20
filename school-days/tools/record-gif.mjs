// 录制真实玩法 → webm，再用 ffmpeg palettegen 转 game.gif（480×270 循环）。
// 用法：node tools/record-gif.mjs [seed]
// 前 3 秒必须看到核心动作：点科目卡排课 → 点结束本周 → 周结算。
import { createServer } from 'node:http';
import { readFile, readdir } from 'node:fs/promises';
import { mkdirSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
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
await new Promise((r) => server.listen(8147, r));

const seed = Number(process.argv[2] ?? 5);
const TMP = join(ROOT, 'tools', 'gif-tmp');
rmSync(TMP, { recursive: true, force: true });
mkdirSync(TMP, { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, recordVideo: { dir: TMP, size: { width: 1280, height: 720 } } });
const page = await ctx.newPage();
await page.goto('http://127.0.0.1:8147/');
await page.waitForTimeout(400);

await page.evaluate((sd) => {
  window.__ll.debug.setTutorialDone(true);
  window.__ll.debug.startSeeded(0, sd);
}, [seed]);
await page.waitForTimeout(250);

// 真实点击科目卡：算学/习武/游学/休息/休息
async function clickCard(subject) {
  const rect = await page.evaluate((s) => {
    const lay = window.__ll.debug.layout();
    const card = lay.cards.find((c) => c.id === s);
    return { x: card.x + card.w / 2, y: card.y + card.h / 2 };
  }, subject);
  await page.mouse.click(rect.x, rect.y);
  await page.waitForTimeout(180);
}
await clickCard('study');
await clickCard('martial');
await clickCard('trip');
await clickCard('rest');
await clickCard('rest');
await page.waitForTimeout(300);

// 点结束本周 → 周结算动画（5 课时逐个结算）
await page.click('#btn-endweek');
await page.waitForTimeout(2400);

// 快进到学期末放榜（灯笼亮起）
await page.evaluate(() => window.__ll.debug.fastForward());
await page.waitForTimeout(700);

await ctx.close().catch(() => {});
await browser.close().catch(() => {});
server.closeAllConnections?.();
server.close();

// 找到录制的 webm 并转 gif
const webm = (await readdir(TMP)).find((f) => f.endsWith('.webm'));
if (!webm) { console.error('未找到 webm'); process.exit(1); }
const webmPath = join(TMP, webm);
const out = join(ROOT, 'game.gif');
const palette = join(TMP, 'palette.png');
execFileSync('ffmpeg', ['-y', '-i', webmPath, '-vf', 'fps=15,scale=480:270:flags=lanczos,palettegen', palette], { stdio: 'ignore' });
execFileSync('ffmpeg', ['-y', '-t', '6', '-i', webmPath, '-i', palette, '-filter_complex', 'fps=15,scale=480:270:flags=lanczos[x];[x][1:v]paletteuse', '-loop', '0', out], { stdio: 'ignore' });
console.log('saved', out);
rmSync(TMP, { recursive: true, force: true });
process.exit(0);
