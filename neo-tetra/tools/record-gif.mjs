// tools/record-gif.mjs — 录制真实玩法 GIF（480×270 / 4.5s / ≤2MB）。
// Playwright 截图帧 + ffmpeg paletteuse。核心动词（落块/消行）在前 3 秒可见。
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { serve, loadPlaywright } from '../../../skills/webgame-playbook/scripts/_lib.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const OUT = join(ROOT, 'game.gif');
const FRAMES = join(HERE, '.gif-frames');
const FFMPEG = '/opt/homebrew/bin/ffmpeg';
const FPS = 10;
const DURATION_SEC = 4.5;
const W = 480;
const H = 270;

const { server, port } = await serve(ROOT, 8410);
const { chromium } = loadPlaywright();
const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=metal', '--autoplay-policy=no-user-gesture-required'] });
const context = await browser.newContext({ viewport: { width: W, height: H } });
const page = await context.newPage();
await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForFunction(() => window.__ll && window.__ll.state.phase !== 'boot', { timeout: 15000 });
await page.evaluate(() => localStorage.setItem('neo-tetra:tutorial-done', 'true'));
await page.evaluate(() => window.__ll.start());
await page.waitForTimeout(300);

// 注入 greedy 自动玩家（直接驱动 sim，落块/旋转/硬降/消行）。不 drain 事件，让主循环触发粒子/音效。
await page.evaluate(() => {
  const g = window.G;
  const CELL = { EMPTY: 0, STONE: 8, WALL: 9 };
  function heights(b) {
    const h = new Array(10).fill(0);
    for (let x = 0; x < 10; x += 1) {
      for (let y = 0; y < 20; y += 1) if (b[y][x] !== CELL.EMPTY) { h[x] = 20 - y; break; }
    }
    return h;
  }
  function holes(b) {
    let n = 0;
    for (let x = 0; x < 10; x += 1) {
      let seen = false;
      for (let y = 0; y < 20; y += 1) {
        if (b[y][x] !== CELL.EMPTY) seen = true; else if (seen) n += 1;
      }
    }
    return n;
  }
  function bump(b) {
    const h = heights(b); let s = 0;
    for (let x = 1; x < 10; x += 1) s += Math.abs(h[x] - h[x - 1]);
    return s;
  }
  function best(run, type) {
    let best = null;
    for (let rot = 0; rot < 4; rot += 1) {
      for (let x = 0; x < 10; x += 1) {
        const d = g.sim.dropResult(run.board, type, rot, x);
        if (!d.ok) continue;
        const after = g.sim.placeCells(run.board, d.cells, 1);
        const cleared = g.sim.clearableRows(after, { narrow: run.narrow });
        const final = g.sim.clearRows(after, cleared);
        const agg = heights(final).reduce((a, v) => a + v, 0);
        const c = agg * 0.51 + holes(final) * 0.76 + bump(final) * 0.18 - cleared.length * 10 - (cleared.length >= 4 ? 15 : 0);
        if (!best || c < best.c) best = { rot, x, c };
      }
    }
    return best;
  }
  window.__gif = setInterval(() => {
    const run = g.run;
    if (!run || run.phase !== 'playing' || !run.active) return;
    const p = best(run, run.active.type);
    if (!p) { run.step({ hardDrop: true }); return; }
    const a = run.active;
    const input = {};
    if (a.rot !== p.rot) {
      const cw = (p.rot - a.rot + 4) % 4;
      input[cw <= 2 ? 'rotateCW' : 'rotateCCW'] = true;
    } else if (a.x < p.x) input.moveRight = true;
    else if (a.x > p.x) input.moveLeft = true;
    else input.hardDrop = true;
    run.step(input);
  }, 24);
});

rmSync(FRAMES, { recursive: true, force: true });
mkdirSync(FRAMES, { recursive: true });
const total = Math.round(FPS * DURATION_SEC);
for (let i = 0; i < total; i += 1) {
  await page.screenshot({ path: join(FRAMES, `f${String(i).padStart(3, '0')}.png`) });
  await page.waitForTimeout(1000 / FPS);
}
await page.evaluate(() => clearInterval(window.__gif));

// ffmpeg palettegen + paletteuse
const palette = join(FRAMES, 'palette.png');
execFileSync(FFMPEG, ['-y', '-framerate', String(FPS), '-i', join(FRAMES, 'f%03d.png'), '-vf', `palettegen=stats_mode=diff`, palette], { stdio: 'ignore' });
execFileSync(FFMPEG, ['-y', '-framerate', String(FPS), '-i', join(FRAMES, 'f%03d.png'), '-i', palette, '-lavfi', `paletteuse=dither=none`, '-loop', '0', '-pix_fmt', 'rgb8', OUT], { stdio: 'ignore' });

const size = (await import('node:fs')).statSync(OUT).size;
console.log(`game.gif written: ${OUT} (${(size / 1048576).toFixed(2)} MB)`);

await browser.close();
server.close();
rmSync(FRAMES, { recursive: true, force: true });
