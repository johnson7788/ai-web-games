// tools/record-gif.mjs — 从真实玩法录制 game.gif（480×270、4.5s、≤2MB）。
// Playwright 录 webm → ctx.close() 后再读 webm 目录 → ffmpeg paletteuse 转 gif。
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { loadPlaywright, serve, waitForBoot } from '../../../skills/webgame-playbook/scripts/_lib.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'game.gif');
const FFMPEG = '/opt/homebrew/bin/ffmpeg';
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'dice-gif-'));

const { server, port } = await serve(ROOT, 8410);
const { chromium } = loadPlaywright();
const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=metal', '--autoplay-policy=no-user-gesture-required'] });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const ctx = await browser.newContext({
  viewport: { width: 1280, height: 720 },
  recordVideo: { dir: TMP, size: { width: 1280, height: 720 } },
});
const p = await ctx.newPage();
await p.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'load', timeout: 30000 });
await waitForBoot(p, 10000);
await p.evaluate(() => localStorage.clear());
await p.reload({ waitUntil: 'domcontentloaded' });
await waitForBoot(p, 10000);
await p.click('#btn-start');
await sleep(600);
await p.click('[data-tutorial-skip]');
await sleep(200);

// 从「已经在玩」的第一秒开始录：第 3 关三骰，连续掷几次形成弹珠循环
await p.evaluate(() => { const r = window.__ll.run; r.jump(3); r.pot = 200; });
for (let i = 0; i < 3; i += 1) {
  await p.click('#btn-roll');
  await sleep(1700);
}

await ctx.close(); // 先关 context 才会落盘 webm（saveAs 并行会卡死）
const webm = fs.readdirSync(TMP).find((f) => f.endsWith('.webm'));
if (!webm) throw new Error('未找到录制的 webm');

const src = path.join(TMP, webm);
const palette = path.join(TMP, 'palette.png');
execFileSync(FFMPEG, ['-y', '-i', src, '-vf', 'fps=14,scale=480:270:flags=lanczos,palettegen=max_colors=128', palette], { stdio: 'ignore' });
execFileSync(FFMPEG, ['-y', '-i', src, '-i', palette, '-lavfi', 'fps=14,scale=480:270:flags=lanczos[x];[x][1:v]paletteuse=dither=bayer', '-loop', '0', '-t', '4.5', '-r', '14', OUT], { stdio: 'ignore' });

await browser.close();
server.close();
fs.rmSync(TMP, { recursive: true, force: true });
console.log('game.gif written:', OUT, fs.statSync(OUT).size, 'bytes');
