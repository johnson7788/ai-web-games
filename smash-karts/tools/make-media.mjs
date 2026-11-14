#!/usr/bin/env node
// G6 物料：从真实运行画面/真实素材生成 poster.jpg / poster-1920.jpg / icon.png / favicon.png / game.gif
// 不 P 图、不用外部素材：海报=keyart + HTML 叠字，GIF=真实玩法录帧（截帧→ffmpeg 调色板）。
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { loadPlaywright, serve } from '../../../skills/webgame-playbook/scripts/_lib.mjs';

const root = process.cwd();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const keyart = ['assets/keyart/keyart-keyart-smash.webp', 'assets/keyart/keyart-smash.webp']
  .map((p) => path.join(root, p)).find((p) => fs.existsSync(p));
const arena = path.join(root, 'assets/bg/arena-meadow.webp');
const kart = path.join(root, 'assets/karts/mint.webp');
const bgSrc = keyart || arena;
if (!bgSrc) { console.error('缺少 keyart / arena 背景'); process.exit(1); }

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'smash-media-'));
const fileUrl = (p) => `file://${p}`;

const { chromium } = loadPlaywright();
const browser = await chromium.launch({ headless: true, args: ['--mute-audio', '--autoplay-policy=no-user-gesture-required'] });

// ---- 1. 海报（1280×720 / 1920×1080） --------------------------------------
const posterHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
  *{margin:0;padding:0;box-sizing:border-box}
  body{width:100vw;height:100vh;overflow:hidden;font-family:-apple-system,"Segoe UI",system-ui,sans-serif}
  .wrap{position:relative;width:100%;height:100%;background:#3b2a4a;overflow:hidden}
  .art{position:absolute;inset:0;background:url("${fileUrl(bgSrc)}") center/cover no-repeat}
  .scrim{position:absolute;inset:0;background:
    linear-gradient(180deg, rgba(59,42,74,.78) 0%, rgba(59,42,74,.28) 34%, rgba(59,42,74,0) 58%),
    radial-gradient(120% 80% at 80% 100%, rgba(255,210,63,.18), transparent 55%)}
  .copy{position:absolute;left:5.5vw;top:5.5vh;right:5.5vw;color:#fff6e5}
  h1{font-size:7.4vw;line-height:.94;letter-spacing:-.18vw;font-weight:900;color:#fff6e5;
     text-shadow:0 .55vw 0 #3b2a4a, 0 0 3vw rgba(255,210,63,.35);-webkit-text-stroke:.32vw #3b2a4a}
  h1 em{color:#ffd23f;font-style:normal}
  p.sub{margin-top:1.6vh;font-size:2.1vw;font-weight:800;color:#fff6e5;text-shadow:0 .3vw 0 rgba(59,42,74,.7)}
  .pills{margin-top:2.4vh;display:flex;gap:1vw;flex-wrap:wrap}
  .pill{background:#3ddc97;color:#123d2a;font-weight:900;font-size:1.5vw;padding:.9vh 1.7vw;border-radius:999px;
        box-shadow:0 .55vh 0 #12855c;border:.32vw solid #3b2a4a}
  .pill.alt{background:#ffd23f;color:#4a3608;box-shadow:0 .55vh 0 #b98a06}
</style></head><body><div class="wrap">
  <div class="art"></div><div class="scrim"></div>
  <div class="copy">
    <h1>SMASH <em>KARTS</em></h1>
    <p class="sub">Cute karts. Loud guns. One winner.</p>
    <div class="pills"><div class="pill">Drift to boost</div><div class="pill alt">First to 10 smashes</div></div>
  </div>
</div></body></html>`;

async function renderHtml(html, file, w, h, type = 'jpeg', quality = 90, extraCss = '') {
  const page = await browser.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
  const tmpHtml = path.join(tmp, `${path.basename(file)}.html`);
  fs.writeFileSync(tmpHtml, html.replace('</style>', `${extraCss}</style>`));
  await page.goto(fileUrl(tmpHtml), { waitUntil: 'load' });
  await page.waitForTimeout(250);
  await page.screenshot({ path: file, type, quality: type === 'jpeg' ? quality : undefined });
  await page.close();
}

await renderHtml(posterHtml, path.join(root, 'poster-1920.jpg'), 1920, 1080, 'jpeg', 88);
await renderHtml(posterHtml, path.join(root, 'poster.jpg'), 1280, 720, 'jpeg', 90);
console.log('✓ poster.jpg / poster-1920.jpg');

// ---- 2. 图标 256 / favicon 64 --------------------------------------------
const iconArt = ['assets/keyart/icon-art.webp']
  .map((p) => path.join(root, p)).find((p) => fs.existsSync(p));
const iconSrc = iconArt || kart;
const iconHtml = (size) => `<!DOCTYPE html><html><head><style>
  *{margin:0;padding:0}
  body{width:${size}px;height:${size}px;overflow:hidden;background:transparent}
  .wrap{width:100%;height:100%;border-radius:${Math.round(size * 0.22)}px;overflow:hidden;position:relative;
    background:radial-gradient(circle at 32% 26%, #fff6e5 0%, #ffd23f 42%, #ff9f1c 100%)}
  .wrap:after{content:"";position:absolute;inset:0;border-radius:inherit;box-shadow:inset 0 0 0 ${Math.max(3, size * 0.025)}px #3b2a4a}
  img{position:absolute;left:50%;top:50%;width:${Math.round(size * 1.02)}px;transform:translate(-50%,-50%)}
</style></head><body><div class="wrap"><img src="${fileUrl(iconSrc)}"></div></body></html>`;

await renderHtml(iconHtml(256), path.join(root, 'icon.png'), 256, 256, 'png');
await renderHtml(iconHtml(64), path.join(root, 'favicon.png'), 64, 64, 'png');
console.log('✓ icon.png / favicon.png');

// ---- 3. game.gif：真实玩法录帧 -------------------------------------------
const { server, port } = await serve(root, 8203);
const gameDir = path.join(tmp, 'frames');
fs.mkdirSync(gameDir, { recursive: true });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !!window.__ll, null, { timeout: 15000 });
  await page.evaluate(() => { window.__ll.save('tutorialDone', true); window.__ll.start(); });
  await page.waitForFunction(() => window.__ll.state.phase === 'playing', null, { timeout: 10000 });
  // 真开车 + 打枪 + 漂移（和玩家操作同一条链路）
  await page.keyboard.down('KeyW');
  await page.keyboard.down('Space');
  const frames = 40;
  for (let i = 0; i < frames; i += 1) {
    if (i === 10) await page.keyboard.down('KeyD');
    if (i === 18) await page.keyboard.up('KeyD');
    if (i === 22) await page.keyboard.down('ShiftLeft');
    if (i === 30) await page.keyboard.up('ShiftLeft');
    if (i === 32) await page.keyboard.down('KeyA');
    await page.screenshot({ path: path.join(gameDir, `f${String(i).padStart(3, '0')}.png`) });
    await sleep(95);
  }
  await page.keyboard.up('Space');
  await page.keyboard.up('KeyW');
  await page.close();
} finally {
  server.close();
}

const gifPath = path.join(root, 'game.gif');
const ff = spawnSync('ffmpeg', [
  '-y', '-framerate', '10', '-i', path.join(gameDir, 'f%03d.png'),
  '-vf', 'scale=640:360:flags=lanczos,split[a][b];[a]palettegen=max_colors=160[p];[b][p]paletteuse=dither=bayer:bayer_scale=3',
  '-loop', '0', gifPath,
], { encoding: 'utf8' });
if (ff.status !== 0) {
  console.error(ff.stderr?.slice(-1200));
  process.exitCode = 1;
} else {
  const kb = (fs.statSync(gifPath).size / 1024).toFixed(0);
  console.log(`✓ game.gif (${kb} KB)`);
}

await browser.close();
fs.rmSync(tmp, { recursive: true, force: true });
