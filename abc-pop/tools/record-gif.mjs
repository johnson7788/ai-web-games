// 录制真实玩法 → webm → ffmpeg 转 game.gif（480×270，~4.5s）。
// 用法：node tools/record-gif.mjs
// 不用 page.video().saveAs（并行环境会卡死）；用 ctx.close() 后读 webm 目录。
import { createServer } from 'node:http';
import { readFile, readdir } from 'node:fs/promises';
import { mkdirSync, rmSync } from 'node:fs';
import { extname, join, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import pw from '/opt/homebrew/lib/node_modules/playwright/index.js';

const { chromium } = pw;
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const FFMPEG = '/opt/homebrew/bin/ffmpeg';
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.json': 'application/json', '.webm': 'video/webm' };

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
await new Promise((r) => server.listen(8165, r));

const tmpDir = join(ROOT, 'tests/artifacts', 'gif-tmp');
mkdirSync(tmpDir, { recursive: true });

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=metal', '--autoplay-policy=no-user-gesture-required'] });
const ctx = await browser.newContext({
  viewport: { width: 1280, height: 720 },
  recordVideo: { dir: tmpDir, size: { width: 1280, height: 720 } },
});
const page = await ctx.newPage();
page.on('console', (m) => { if (m.type() === 'error') console.error('CONSOLE', m.text()); });
page.on('pageerror', (e) => console.error('PAGEERROR', String(e).slice(0, 300)));
page.on('requestfailed', (r) => console.error('REQFAIL', r.url(), r.failure()?.errorText));
await page.goto('http://127.0.0.1:8165/');
await page.waitForFunction(() => window.__ll && window.__ll.state.phase !== 'boot', null, { timeout: 15000 });
await page.waitForTimeout(400);

// 进入真实玩法并跳过引导
await page.click('#btn-start');
await page.waitForTimeout(600);
try { await page.click('[data-tutorial-skip]', { timeout: 3000 }); } catch { /* 无引导 */ }
await page.waitForTimeout(300);

// 真实点击泡泡：目标字母 → 连击 → 彩虹桥（约 4.5s）
async function clickCorrect() {
  const pos = await page.evaluate(() => {
    const r = window.__ll.run;
    if (!r || r.phase !== 'playing') return null;
    const hud = r.getHud();
    const forms = hud.target.forms;
    let desired = forms[0];
    if (hud.round === 1) {
      for (const f of forms) if (!r.formsDone.has(f)) { desired = f; break; }
    }
    const b = r.bubbles.find((x) => x.letter === desired);
    if (!b) return null;
    const canvas = document.getElementById('canvas');
    const rect = canvas.getBoundingClientRect();
    const scale = Math.min(rect.width / 1280, rect.height / 720);
    const ox = rect.left + (rect.width - 1280 * scale) / 2;
    const oy = rect.top + (rect.height - 720 * scale) / 2;
    return { x: ox + b.x * scale, y: oy + b.y * scale };
  });
  if (pos) await page.mouse.click(pos.x, pos.y);
}

for (let i = 0; i < 10; i += 1) {
  await clickCorrect();
  await page.waitForTimeout(430);
}
await page.waitForTimeout(400);

await ctx.close().catch(() => {});
await browser.close().catch(() => {});
server.closeAllConnections?.();
server.close();

// 读录好的 webm
const files = await readdir(tmpDir);
const webm = files.find((f) => f.endsWith('.webm'));
if (!webm) {
  console.error('没有录到 webm');
  process.exit(1);
}
const webmPath = join(tmpDir, webm);
const palettePath = join(tmpDir, 'palette.png');
const gifPath = join(ROOT, 'game.gif');

try {
  execFileSync(FFMPEG, ['-y', '-i', webmPath, '-vf', 'fps=15,scale=480:270:flags=lanczos,palettegen=stats_mode=diff', palettePath], { stdio: 'pipe' });
  execFileSync(FFMPEG, ['-y', '-i', webmPath, '-i', palettePath, '-t', '4.5', '-lavfi', 'fps=15,scale=480:270:flags=lanczos [x]; [x][1:v] paletteuse=dither=bayer', gifPath], { stdio: 'pipe' });
  console.log('saved', gifPath);
} catch (e) {
  console.error('ffmpeg failed:', e.stderr ? e.stderr.toString() : e.message);
  process.exit(1);
} finally {
  rmSync(tmpDir, { recursive: true, force: true });
}
