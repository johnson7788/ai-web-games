// tools/record-gif.mjs — 录制真实玩法（战斗 + 五行克制墨晕）→ webm → ffmpeg 转 game.gif
// 用法：node tools/record-gif.mjs
import { createServer } from 'node:http';
import { readFile, readdir } from 'node:fs/promises';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { extname, join, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import pw from '/opt/homebrew/lib/node_modules/playwright/index.js';

const { chromium } = pw;
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = join(ROOT, 'tests', 'artifacts');
const WEBM = join(OUT_DIR, 'gameplay.webm');
const GIF = join(ROOT, 'game.gif');
mkdirSync(OUT_DIR, { recursive: true });

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

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 1280, height: 720 },
  recordVideo: { dir: OUT_DIR, size: { width: 1280, height: 720 } },
});
const page = await ctx.newPage();
await page.goto('http://127.0.0.1:8147/');
await page.waitForFunction(() => window.__ll && window.__ll.state?.phase !== 'boot', { timeout: 10000 }).catch(() => {});
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'load' });
await page.waitForFunction(() => window.__ll && window.__ll.state?.phase === 'title', { timeout: 10000 }).catch(() => {});
await page.waitForTimeout(400);
await page.click('#btn-start');
await page.waitForTimeout(500);
await page.evaluate(() => { try { window.__ll.tutorial.skip(); } catch { /* noop */ } });
// 直接推进到第 1 章战斗（开门 → 战斗）
await page.evaluate(() => {
  const r = window.__ll.run;
  r.map.openingDone = true;
  r.map.px = 20; r.map.py = 7;
  r.step({});
});
await page.waitForTimeout(500);              // 敌人亮相（目标可见）
// 五行克制：金属剑客打木属竹妖 → 墨晕（核心动词 + signature）
await page.evaluate(() => {
  const r = window.__ll.run;
  if (r.mode === 'battle') { r.battle.pending = 'hero'; r.step({ menu: { type: 'attack', target: 'enemy0' } }); r.drainEvents(); }
});
await page.waitForTimeout(900);              // 墨晕展开
// 继续普攻直到胜利
await page.evaluate(() => {
  const r = window.__ll.run;
  let g = 0;
  while (r.mode === 'battle' && r.phase === 'playing' && g < 3000) {
    r.step({ menu: r.battle && r.battle.pending ? { type: 'attack', target: (r.battle.units.find((u) => u.side === 'enemy' && u.alive) || {}).id } : null });
    r.drainEvents();
    g += 1;
  }
});
await page.waitForTimeout(800);

// 关闭上下文以 flush 视频（saveAs 在并行环境会卡死；直接读 webm 目录）
await ctx.close().catch(() => {});
await browser.close().catch(() => {});
server.closeAllConnections?.();
server.close();

// 找到录制出的 webm 并重命名
const files = await readdir(OUT_DIR);
const webm = files.find((f) => f.endsWith('.webm'));
if (!webm) { console.error('未找到 webm 录制文件'); process.exit(1); }
writeFileSync(WEBM, await readFile(join(OUT_DIR, webm)));

// ffmpeg 转 gif（480×270、4.5s、两遍 palette）
const ff = '/opt/homebrew/bin/ffmpeg';
const PAL = join(OUT_DIR, 'palette.png');
execFileSync(ff, ['-y', '-i', WEBM, '-t', '4.5', '-vf', 'fps=15,scale=480:270:flags=lanczos,palettegen', PAL], { stdio: 'inherit' });
execFileSync(ff, ['-y', '-i', WEBM, '-t', '4.5', '-i', PAL, '-lavfi', 'fps=15,scale=480:270:flags=lanczos[x];[x][1:v]paletteuse', '-loop', '0', GIF], { stdio: 'inherit' });
console.log('saved', GIF);
