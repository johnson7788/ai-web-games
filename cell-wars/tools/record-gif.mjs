// tools/record-gif.mjs — 录真实玩法（点击感染扩散）→ ffmpeg 转 480×270 game.gif。
// Playwright recordVideo 走 ctx.close() 后再读 webm（并行 saveAs 会卡死）。
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { loadPlaywright, serve, waitForBoot } from '../../../skills/webgame-playbook/scripts/_lib.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'game.gif');
const FFMPEG = '/opt/homebrew/bin/ffmpeg';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const FRONTIER_CENTER = `(()=>{const r=window.__ll.run;if(!r||r.turn!=='player')return null;const P=1,V=-1;const L=window.G.renderer.getLayout(r.size);for(let rr=0;rr<r.size;rr++)for(let cc=0;cc<r.size;cc++){const cell=r.board[rr][cc];if(cell.o===P||cell.o===V)continue;const d=[[-1,0],[1,0],[0,-1],[0,1]];for(const[dr,dc]of d){const nr=rr+dr,nc=cc+dc;if(nr>=0&&nr<r.size&&nc>=0&&nc<r.size&&r.board[nr][nc].o===P)return{x:L.originX+cc*L.cellPx+L.cellPx/2,y:L.originY+rr*L.cellPx+L.cellPx/2};}}return null;})()`;

const { chromium } = loadPlaywright();
const videoDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cw-gif-'));
const server = await serve(ROOT, 8210);
const url = `http://127.0.0.1:${server.port}/`;

const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=metal', '--autoplay-policy=no-user-gesture-required'] });
const ctx = await browser.newContext({
  viewport: { width: 1280, height: 720 },
  recordVideo: { dir: videoDir, size: { width: 1280, height: 720 } },
});
const page = await ctx.newPage();
await page.goto(url, { waitUntil: 'load', timeout: 20000 });
await waitForBoot(page, 10000);
await page.waitForFunction(() => window.__ll && window.__ll.state.phase === 'title', { timeout: 10000 }).catch(() => {});
await page.click('#btn-start');
await sleep(600);
const skip = page.locator('[data-tutorial-skip]');
if (await skip.count()) await skip.click({ force: true });
await sleep(300);

// 真实点击感染，录 4.5s
const t0 = Date.now();
while (Date.now() - t0 < 4500) {
  const cell = await page.evaluate(FRONTIER_CENTER);
  if (cell) await page.mouse.click(cell.x, cell.y);
  await sleep(220);
}

await ctx.close(); // 结束录屏，落 webm
await browser.close();
server.server.close();

const webm = fs.readdirSync(videoDir).find((f) => f.endsWith('.webm'));
if (!webm) {
  console.error('未找到录屏 webm');
  process.exit(1);
}
const src = path.join(videoDir, webm);
const pal = path.join(videoDir, 'pal.png');

execFileSync(FFMPEG, ['-y', '-i', src, '-t', '4.5', '-vf', 'fps=15,scale=480:270:flags=lanczos,palettegen=stats_mode=diff', pal], { stdio: 'ignore' });
execFileSync(FFMPEG, ['-y', '-i', src, '-i', pal, '-t', '4.5', '-lavfi', 'fps=15,scale=480:270:flags=lanczos[x];[x][1:v]paletteuse=dither=bayer', '-loop', '0', OUT], { stdio: 'ignore' });

const size = fs.statSync(OUT).size;
console.log(`game.gif written: ${(size / 1024).toFixed(0)} KB`);
if (size > 2 * 1024 * 1024) {
  console.error('game.gif 超过 2MB，需要降帧率/减时长');
  process.exit(1);
}
