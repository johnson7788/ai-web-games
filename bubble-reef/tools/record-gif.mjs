// tools/record-gif.mjs — 从真实玩法录制 game.gif（480×270 · 4.5s · ≤2MB）
// playwright 截帧（驱动真实游戏循环 + 贪心瞄准）→ ffmpeg palettegen/paletteuse
import { mkdirSync, rmSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { bestAim } from '../src/game/ai.js';

const require = createRequire('/opt/homebrew/lib/node_modules/');
const { chromium } = require('playwright');

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const OUT = join(ROOT, 'game.gif');
const FRAMES = join(__dirname, 'gif-frames');
const FPS = 15;
const DUR = 4.5;
const TOTAL = Math.round(FPS * DUR); // 68

async function main() {
  const { serve } = await import('/Users/admin/git/webgames/skills/webgame-playbook/scripts/_lib.mjs');
  const { server, port } = await serve(ROOT, 8500);
  const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=metal', '--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'load', timeout: 20000 });
  await page.waitForFunction(() => window.__ll && window.__ll.state.phase !== 'boot', null, { timeout: 10000 });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => window.__ll && window.__ll.state.phase !== 'boot', null, { timeout: 10000 });
  await page.click('#btn-start');
  await page.waitForTimeout(500);
  const skip = page.locator('[data-tutorial-skip]').first();
  if (await skip.count()) { await skip.click({ force: true }).catch(() => {}); }
  await page.waitForTimeout(400);

  rmSync(FRAMES, { recursive: true, force: true });
  mkdirSync(FRAMES, { recursive: true });

  const readState = () => page.evaluate(() => {
    const r = window.__ll.run;
    if (!r) return null;
    return {
      grid: r.grid.map((row) => (row ? row.map((c) => (c ? { c: c.c, gold: c.gold, wildcard: c.wildcard } : null)) : null)),
      parities: r.parities.slice(),
      current: r.current ? { c: r.current.c, wildcard: r.current.wildcard } : null,
      drift: r.level.drift,
      flying: !!r.flying,
      combo: r.combo,
    };
  });

  for (let i = 0; i < TOTAL; i += 1) {
    const st = await readState();
    if (st && !st.flying && st.current) {
      const color = st.current.wildcard ? 0 : st.current.c;
      const aim = bestAim(st.grid, st.parities, color, st.drift);
      const angle = aim ? aim.angle : 0;
      await page.evaluate((a) => window.__ll.debug.fire(a), angle);
    }
    await page.screenshot({ path: join(FRAMES, `f${String(i).padStart(3, '0')}.png`) });
    await page.waitForTimeout(1000 / FPS);
  }

  await browser.close();
  server.close();

  const palette = join(FRAMES, 'palette.png');
  const ff = '/opt/homebrew/bin/ffmpeg';
  execFileSync(ff, ['-y', '-framerate', String(FPS), '-i', join(FRAMES, 'f%03d.png'), '-vf', 'scale=480:270:flags=lanczos,palettegen=stats_mode=diff', palette], { stdio: 'inherit' });
  execFileSync(ff, ['-y', '-framerate', String(FPS), '-i', join(FRAMES, 'f%03d.png'), '-i', palette, '-lavfi', 'scale=480:270:flags=lanczos [x]; [x][1:v] paletteuse=dither=bayer', '-loop', '0', OUT], { stdio: 'inherit' });
  rmSync(FRAMES, { recursive: true, force: true });

  const size = require('node:fs').statSync(OUT).size;
  console.log(`game.gif written: ${OUT} (${(size / 1024 / 1024).toFixed(2)}MB)`);
}

main().catch((e) => { console.error(e); process.exit(1); });
