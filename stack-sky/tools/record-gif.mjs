// tools/record-gif.mjs — 录制真实玩法 → ffmpeg paletteuse 生成根目录 game.gif（480×270, ~4.5s, ≤2MB）
// 前 3 秒即见核心动词（移动岛左右滑动 + 点击截停叠塔）+ 目标（塔顶落点）。
import { mkdirSync, statSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { loadPlaywright, serve } from '../../../skills/webgame-playbook/scripts/_lib.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const TMP = join(ROOT, 'tests', 'artifacts', 'gif-tmp');
const GIF = join(ROOT, 'game.gif');
mkdirSync(TMP, { recursive: true });

const { chromium } = loadPlaywright();
const { server, port } = await serve(ROOT, 8380);
const url = `http://127.0.0.1:${port}/`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch({
  headless: true,
  args: ['--use-gl=angle', '--use-angle=metal', '--autoplay-policy=no-user-gesture-required'],
});

let videoPath = null;
try {
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    recordVideo: { dir: TMP, size: { width: 1280, height: 720 } },
  });
  const page = await ctx.newPage();
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForFunction(() => window.__ll && window.__ll.state?.phase !== 'boot', { timeout: 10000 });
  await sleep(400);
  await page.click('#btn-start');
  await sleep(600);
  if (await page.locator('[data-tutorial-skip]').isVisible().catch(() => false)) {
    await page.click('[data-tutorial-skip]');
    await sleep(300);
  }

  // 录制约 5s：移动岛持续左右滑动，且每 ~1.1s 触发一次完美截停，让塔可见地长高
  const t0 = Date.now();
  let dropAt = 0.2;
  while (Date.now() - t0 < 5000) {
    const elapsed = (Date.now() - t0) / 1000;
    if (elapsed >= dropAt) {
      await page.evaluate(() => {
        const r = window.__ll.run;
        if (r && r.phase === 'playing') {
          r.moving.x = r.top.x;
          r._prevDrop = false;
          r.step({ drop: true });
          r.drainEvents();
        }
      });
      dropAt += 1.1;
    }
    await sleep(80);
  }

  const video = page.video();
  await ctx.close();
  videoPath = await video.path();
} finally {
  await browser.close();
  server.close();
}

if (!videoPath) {
  console.error('✗ 录制失败：没有视频产物');
  process.exit(1);
}

// ffmpeg：webm → 480×270 循环 gif（palettegen/paletteuse，≤2MB）
try {
  execFileSync('/opt/homebrew/bin/ffmpeg', [
    '-y', '-i', videoPath, '-t', '4.5',
    '-vf', 'fps=15,scale=480:270:flags=lanczos,split[a][b];[a]palettegen=max_colors=128[p];[b][p]paletteuse=dither=bayer:bayer_scale=5',
    '-loop', '0', GIF,
  ], { stdio: 'pipe' });
} catch (e) {
  console.error('✗ ffmpeg 转换失败：', e.stderr ? e.stderr.toString().slice(0, 400) : e.message);
  process.exit(1);
}

const bytes = statSync(GIF).size;
console.log(`✓ 已生成 game.gif（${(bytes / 1024 / 1024).toFixed(2)}MB）`);
if (bytes > 2 * 1024 * 1024) {
  console.warn('⚠ game.gif 超过 2MB，需降低 fps 或缩短时长');
  process.exit(1);
}
