// tools/record-gif.mjs — 录制真实玩法 → webm → ffmpeg 转 game.gif（480×270 循环）
// 用浏览器内迷你贪心 bot（读 run 障碍，派发 Space 起跳）驱动真实跳跃，录核心动词+目标。
import { createServer } from 'node:http';
import { readFile, readdir } from 'node:fs/promises';
import { mkdirSync, rmSync } from 'node:fs';
import { extname, join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const TMP = join(ROOT, 'tests', 'artifacts', 'gifvideo');
const OUT = join(ROOT, 'game.gif');
const FFMPEG = '/opt/homebrew/bin/ffmpeg';

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.json': 'application/json' };
const server = createServer(async (req, res) => {
  try {
    const url = decodeURIComponent((req.url || '/').split('?')[0]);
    const file = join(ROOT, url === '/' ? 'index.html' : url);
    if (!file.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
    const data = await readFile(file);
    res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream' });
    res.end(data);
  } catch { res.writeHead(404); res.end(); }
});
await new Promise((r) => server.listen(8151, r));

rmSync(TMP, { recursive: true, force: true });
mkdirSync(TMP, { recursive: true });

const pw = require('/opt/homebrew/lib/node_modules/playwright/index.js');
const browser = await pw.chromium.launch({ args: ['--use-gl=angle', '--use-angle=metal'] });
const ctx = await browser.newContext({
  viewport: { width: 1280, height: 720 },
  recordVideo: { dir: TMP, size: { width: 1280, height: 720 } },
});
const page = await ctx.newPage();
page.on('console', (m) => { if (m.type() === 'error') console.log('CONSOLE ERR', m.text()); });
page.on('pageerror', (e) => console.log('PAGE ERR', e.message));
page.on('requestfailed', (r) => console.log('REQFAIL', r.url(), r.failure()?.errorText));
await page.goto('http://127.0.0.1:8151/', { waitUntil: 'load' });
await page.waitForTimeout(3500); // 等 boot（Sdk.ready ≤3s）+ title
await page.waitForTimeout(400);
console.log('state before click:', await page.evaluate(() => (window.__ll ? JSON.stringify(window.__ll.state) : 'NO __ll')), 'btnStart:', await page.locator('#btn-start').count());
await page.click('#btn-start');
await page.waitForTimeout(400);
await page.evaluate(() => { if (window.__ll.tutorial.active) window.__ll.tutorial.skip(); });
await page.waitForTimeout(150);

// 浏览器内迷你贪心 bot：读最近前方障碍，按类型派发 Space 起跳（真实键事件驱动）
await page.evaluate(() => {
  window.__gifBot = setInterval(() => {
    const r = window.__ll.run;
    if (!r || r.phase !== 'playing') return;
    let best = null;
    for (const o of r.obstacles) {
      if (o.cleared || o.hit) continue;
      const x = o.worldX - r.distPx;
      if (x > 220 && (best == null || x < best.x)) best = { o, x };
    }
    if (best) {
      const trig = best.o.type === 'pit' ? 90 : (best.o.type === 'high' || best.o.type === 'rock') ? 130 : 100;
      const near = best.x - best.o.w / 2;
      if (near < 240 + trig && near > 200) {
        window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space' }));
        return;
      }
    }
    window.dispatchEvent(new KeyboardEvent('keyup', { code: 'Space' }));
  }, 50);
});

await page.waitForTimeout(4500); // 录 ~4.5s 核心玩法
await page.evaluate(() => clearInterval(window.__gifBot));
await ctx.close();               // 关闭以落盘 webm（saveAs 在并行环境会卡死，改读目录）
await browser.close();
server.close();

const webm = (await readdir(TMP)).find((f) => f.endsWith('.webm'));
if (!webm) { console.error('no webm recorded'); process.exit(1); }
const webmPath = join(TMP, webm);

// ffmpeg：4.5s、480×270、palettegen/paletteuse
const pal = join(TMP, 'palette.png');
execFileSync(FFMPEG, ['-y', '-i', webmPath, '-t', '4.5', '-vf', 'fps=15,scale=480:270:flags=lanczos,palettegen', pal], { stdio: 'inherit' });
execFileSync(FFMPEG, ['-y', '-i', webmPath, '-i', pal, '-t', '4.5', '-lavfi', 'fps=15,scale=480:270:flags=lanczos[x];[x][1:v]paletteuse', '-loop', '0', OUT], { stdio: 'inherit' });
console.log('saved', OUT);
process.exit(0);
