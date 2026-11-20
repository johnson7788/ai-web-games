// Sprout Hop · 录制真实玩法 → ffmpeg palettegen 转 game.gif（480×270 循环，≤2MB）。
// 用法：node tools/record-gif.mjs [out.gif]
// 采用「逐帧截图 + ffmpeg」而非 recordVideo：更稳、不依赖浏览器视频编码器。
// 前 3 秒即核心玩法：拖拽蓄力（轨迹弧线）→ 松手弹射 → 飞行 → 落台爆裂，两跳循环。
import { mkdirSync, rmSync, existsSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { loadPlaywright, serve } from '../../../skills/webgame-playbook/scripts/_lib.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const out = process.argv[2] || 'game.gif';
const outAbs = join(ROOT, out);
const frameDir = join(ROOT, 'tests', 'artifacts', 'gif-frames');
rmSync(frameDir, { recursive: true, force: true });
mkdirSync(frameDir, { recursive: true });

const { server, port } = await serve(ROOT, 8271);
const { chromium } = loadPlaywright();
const browser = await chromium.launch({
  headless: true,
  args: ['--use-gl=angle', '--use-angle=metal', '--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'load' });
await page.waitForTimeout(700);
await page.evaluate(() => {
  window.__ll.debug.setTutorialDone(true);
  window.__ll.debug.startSeeded(0, 3);
});
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// 时间轴上的动作（ms）→ 瞄准 / 松手
const ACTIONS = [
  [500, 'aimNext'],
  [1300, 'launchAimed'],
  [2250, 'aimNext'],
  [3050, 'launchAimed'],
];
const totalMs = 4300;
const stepMs = 60;
let idx = 0;
let t = 0;
let act = 0;
while (t < totalMs) {
  if (act < ACTIONS.length && t >= ACTIONS[act][0]) {
    await page.evaluate((fn) => window.__ll.debug[fn](), ACTIONS[act][1]);
    act += 1;
  }
  await page.screenshot({ path: join(frameDir, `f${String(idx).padStart(3, '0')}.png`) });
  await sleep(stepMs);
  idx += 1;
  t += stepMs;
}

await browser.close().catch(() => {});
server.close();

// ffmpeg：图像序列 → palette → gif（480×270，24fps 循环，≤2MB）
const pal = join(frameDir, 'pal.png');
const fps = Math.max(12, Math.round(idx / (totalMs / 1000)));
const filters = `fps=${fps},scale=480:270:flags=lanczos`;
try { execFileSync('ffmpeg', ['-y', '-framerate', String(fps), '-i', join(frameDir, 'f%03d.png'), '-vf', `${filters},palettegen=stats_mode=diff`, pal], { stdio: 'ignore' }); } catch (e) { console.error('ffmpeg pal failed:', e.message); }
try { execFileSync('ffmpeg', ['-y', '-framerate', String(fps), '-i', join(frameDir, 'f%03d.png'), '-i', pal, '-lavfi', `${filters}[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=5`, '-loop', '0', outAbs], { stdio: 'ignore' }); } catch (e) { console.error('ffmpeg gif failed:', e.message); }

if (existsSync(outAbs)) {
  console.log(`saved ${outAbs} (${(statSync(outAbs).size / 1024 / 1024).toFixed(2)} MB, ${idx} frames @ ${fps}fps)`);
} else {
  console.error('gif not produced');
}
process.exit(0);
