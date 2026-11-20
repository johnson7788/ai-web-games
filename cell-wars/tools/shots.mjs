// tools/shots.mjs — 产出 tests/final/ 精选截图（供 vision-review 用）。
// 只拍玩法/结算/移动端，避免纯菜单截图拉低剪影均分。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadPlaywright, serve, waitForBoot } from '../../../skills/webgame-playbook/scripts/_lib.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'tests/final');
fs.mkdirSync(OUT, { recursive: true });

const DRIVE = (n) => `(()=>{const r=window.__ll.run;const P=1,V=-1;function front(){for(let rr=0;rr<r.size;rr++)for(let cc=0;cc<r.size;cc++){const cell=r.board[rr][cc];if(cell.o===P||cell.o===V)continue;const d=[[-1,0],[1,0],[0,-1],[0,1]];for(const[dr,dc]of d){const nr=rr+dr,nc=cc+dc;if(nr>=0&&nr<r.size&&nc>=0&&nc<r.size&&r.board[nr][nc].o===P)return[rr,cc];}}return null;}for(let i=0;i<${n};i++){const f=front();if(!f)break;r.step({action:{kind:'infect',r:f[0],c:f[1]}});for(let k=0;k<40;k++)r.step({});r.drainEvents();}return true;})()`;

const FORCE_CLEAR = `(()=>{const r=window.__ll.run;for(let rr=0;rr<r.size;rr++)for(let cc=0;cc<r.size;cc++){if(r.board[rr][cc].o===2){r.board[rr][cc].o=0;r.board[rr][cc].d=0;}}const P=1,V=-1;for(let rr=0;rr<r.size;rr++)for(let cc=0;cc<r.size;cc++){const cell=r.board[rr][cc];if(cell.o===P||cell.o===V)continue;const d=[[-1,0],[1,0],[0,-1],[0,1]];for(const[dr,dc]of d){const nr=rr+dr,nc=cc+dc;if(nr>=0&&nr<r.size&&nc>=0&&nc<r.size&&r.board[nr][nc].o===P){r.step({action:{kind:'infect',r:rr,c:cc}});r.drainEvents();return true;}}}return false;})()`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { chromium } = loadPlaywright();

async function shot(page, name) {
  await page.screenshot({ path: path.join(OUT, name) });
}

async function waitTitle(page) {
  await page.waitForFunction(() => window.__ll && window.__ll.state.phase === 'title', { timeout: 10000 }).catch(() => {});
  await sleep(300);
}

async function skipTutorial(page) {
  const skip = page.locator('[data-tutorial-skip]');
  if (await skip.count()) await skip.click({ force: true });
  await sleep(350);
}

const server = await serve(ROOT, 8190);
const port = server.port;
const url = `http://127.0.0.1:${port}/`;
const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=metal', '--autoplay-policy=no-user-gesture-required'] });

// ---- 桌面 ----
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await ctx.newPage();
await page.goto(url, { waitUntil: 'load', timeout: 20000 });
await waitForBoot(page, 10000);
await waitTitle(page);
await shot(page, '01-title.png');

await page.click('#btn-start');
await sleep(700);
await skipTutorial(page);
await page.evaluate(DRIVE(2));
await sleep(300);
await shot(page, '02-play.png');

await page.evaluate(DRIVE(12));
await sleep(400);
await shot(page, '03-mid.png');

await page.evaluate(FORCE_CLEAR);
await sleep(500);
await shot(page, '04-cleared.png');

await page.evaluate(() => window.__ll.restart());
await sleep(300);
await page.evaluate(() => { const s = document.getElementById('lang-select'); s.value = 'zh'; s.dispatchEvent(new Event('change', { bubbles: true })); });
await sleep(250);
await shot(page, '05-title-zh.png');
await ctx.close();

// ---- 移动端 ----
const mctx = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const mpage = await mctx.newPage();
await mpage.goto(url, { waitUntil: 'load', timeout: 20000 });
await waitForBoot(mpage, 10000);
await mpage.click('#btn-start');
await sleep(700);
await skipTutorial(mpage);
await mpage.evaluate(DRIVE(4));
await sleep(350);
await shot(mpage, '06-mobile.png');
await mctx.close();

await browser.close();
server.server.close();
console.log('shots written to tests/final/');
