// tools/record-gif.mjs — 录制真实玩法 → game.gif（480×270、~4.5s、≤2MB）
// 用 playwright 逐帧截图（可靠，避免 recordVideo 在此环境的 saveAs 卡死）→ ffmpeg paletteuse。
// 前 3 秒见核心动词（霰弹枪射击 + 近距紫浆）+ 目标（扑出的外星生物）。
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { extname, join, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import pw from '/opt/homebrew/lib/node_modules/playwright/index.js';

const { chromium } = pw;
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const FFMPEG = '/opt/homebrew/bin/ffmpeg';
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.json': 'application/json' };
const FRAME_DIR = join(ROOT, 'tests', 'artifacts', 'gif-frames');

setTimeout(() => { console.error('record-gif timeout'); process.exit(1); }, 120000).unref?.();

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
await mkdir(FRAME_DIR, { recursive: true });

const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=metal', '--autoplay-policy=no-user-gesture-required'] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await ctx.newPage();
await page.goto('http://127.0.0.1:8147/', { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForFunction(() => window.__ll && window.__ll.state.phase !== 'boot', { timeout: 15000 });
await page.evaluate(() => localStorage.setItem('alien-siege:tutorial-done', 'true'));
await page.reload({ waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__ll && window.__ll.state.phase === 'title', { timeout: 15000 });
await page.evaluate(() => window.__ll.start());
await page.waitForTimeout(300);

// 摆一个「核心动词 + 目标」的画面：霰弹枪 + 三只扑面异形（其中巨兽在近距触发紫浆）
await page.evaluate(() => {
  const r = window.__ll.run;
  const p = r.player;
  r.enemies = [];
  r.wave = 1;
  r.waveState = 'active';
  p.x = 12.5; p.y = 12.5; p.angle = 0;
  p.weapon = 'shotgun';
  p.ammo = 6;
  p.reloading = false;
  p.fireCooldown = 0;
  const mk = (id, type, x, y, hp, radius) => ({ id, type, x, y, hp, maxHp: hp, speed: 1.0, radius, damage: 8, attackRange: 0.9, attackCooldown: 1, drift: type === 'floater' ? 1.7 : 0, score: 100, attackCd: 0, driftPhase: 0, spawnCd: 0, marked: false, markedUntil: 0 });
  r.enemies.push(mk(7001, 'crawler', p.x + 3.2, p.y - 0.8, 18, 0.26));
  r.enemies.push(mk(7002, 'behemoth', p.x + 4.0, p.y + 0.2, 95, 0.52));
  r.enemies.push(mk(7003, 'floater', p.x + 5.4, p.y + 1.2, 30, 0.34));
});

// 按住 Space 持续射击（input.shoot = keys.space）
await page.keyboard.down('Space');

const FPS = 15;
const DUR = 4.5;
const FRAMES = Math.round(FPS * DUR);
for (let i = 0; i < FRAMES; i += 1) {
  await page.screenshot({ path: join(FRAME_DIR, `frame-${String(i).padStart(3, '0')}.png`) });
  await page.waitForTimeout(1000 / FPS);
}
await page.keyboard.up('Space');

await ctx.close();
await browser.close();
try { server.closeAllConnections?.(); server.close(); } catch { /* ignore */ }

try {
  execFileSync(FFMPEG, ['-y', '-framerate', String(FPS), '-i', join(FRAME_DIR, 'frame-%03d.png'), '-vf', 'scale=480:270:flags=lanczos,palettegen=stats_mode=diff', join(ROOT, 'tests', 'artifacts', 'palette.png')], { stdio: 'pipe', timeout: 30000 });
  execFileSync(FFMPEG, ['-y', '-framerate', String(FPS), '-i', join(FRAME_DIR, 'frame-%03d.png'), '-i', join(ROOT, 'tests', 'artifacts', 'palette.png'), '-filter_complex', 'scale=480:270:flags=lanczos[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=5', '-loop', '0', join(ROOT, 'game.gif')], { stdio: 'pipe', timeout: 30000 });
  console.log('saved', join(ROOT, 'game.gif'));
} catch (e) {
  console.error('ffmpeg failed:', e.message);
  process.exit(1);
}
process.exit(0);
