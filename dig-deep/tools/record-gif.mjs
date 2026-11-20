// tools/record-gif.mjs — 录制真实玩法（逐帧截图）→ ffmpeg 转 game.gif（480×270，4.5s）
// 用法：node tools/record-gif.mjs
import { mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { loadPlaywright, serve } from '../../../skills/webgame-playbook/scripts/_lib.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'game.gif');
const FFMPEG = '/opt/homebrew/bin/ffmpeg';

const FPS = 20;
const DUR = 4.5;
const N = Math.round(FPS * DUR);

const DIG_TO = `(()=>{const r=window.__ll.run; let n=0; while(n<2000 && r.phase==='playing' && r.depth<8){const f=r.peek(r.depth); let c=r.col,b=-1e9; for(let i=0;i<5;i++){const e=f[i]; if(!e.alive)continue; let s= e.type==='lava'?-1e9: e.type==='rock'?(r.laserCharges>0?-8:-200): e.type==='diamond'?120: e.type==='fossil'?110: e.type==='fault'?45:25-e.hard*8; if(s>b){b=s;c=i;}} r.step({move:Math.sign(c-r.col),dig:r.col===c,tool:r.maxTool>=1?1:0}); r.drainEvents(); n++;} return r.depth;})()`;

const { chromium } = loadPlaywright();
const server = await serve(ROOT, 8200);
const base = `http://127.0.0.1:${server.port}/`;

const tmpDir = await mkdtemp(join(tmpdir(), 'dig-deep-gif-'));
const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=metal', '--autoplay-policy=no-user-gesture-required'] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await ctx.newPage();
await page.goto(base, { waitUntil: 'load', timeout: 20000 });
await page.waitForFunction(() => window.__ll && window.__ll.state.phase !== 'boot', { timeout: 10000 });
await page.waitForTimeout(400);
await page.click('#btn-start');
await page.waitForTimeout(250);
await page.click('[data-tutorial-skip]').catch(() => {});
await page.waitForTimeout(250);
await page.evaluate(DIG_TO);
await page.waitForTimeout(150);

// 真实操作模型：按住 Space 持续挖掘 + 有节奏左右换列，逐帧截图
await page.keyboard.down('Space');
const moves = ['ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight'];
let mi = 0;
const mover = setInterval(() => {
  const k = moves[mi++ % moves.length];
  page.keyboard.down(k).catch(() => {});
  setTimeout(() => page.keyboard.up(k).catch(() => {}), 200);
}, 450);

for (let i = 0; i < N; i += 1) {
  const buf = await page.screenshot({ type: 'png' });
  await writeFile(join(tmpDir, `f${String(i).padStart(3, '0')}.png`), buf);
  await page.waitForTimeout(1000 / FPS);
}
clearInterval(mover);
await page.keyboard.up('Space');

await ctx.close().catch(() => {});
await browser.close().catch(() => {});
server.server.close();

const frames = (await readdir(tmpDir)).filter((f) => /^f\d+\.png$/.test(f)).sort();
if (!frames.length) { console.error('no frames'); await rm(tmpDir, { recursive: true, force: true }); process.exit(1); }
if (frames.length !== N) console.warn(`captured ${frames.length}/${N} frames`);

execFileSync(FFMPEG, ['-y', '-framerate', String(FPS), '-i', join(tmpDir, 'f%03d.png'), '-vf', 'scale=480:270:flags=lanczos,palettegen=stats_mode=diff', join(tmpDir, 'palette.png')]);
execFileSync(FFMPEG, ['-y', '-framerate', String(FPS), '-i', join(tmpDir, 'f%03d.png'), '-i', join(tmpDir, 'palette.png'), '-lavfi', 'scale=480:270:flags=lanczos [x]; [x][1:v] paletteuse=dither=bayer:bayer_scale=5:diff_mode=rectangle', OUT]);
await rm(tmpDir, { recursive: true, force: true });
console.log('saved', OUT, `${frames.length} frames`);
