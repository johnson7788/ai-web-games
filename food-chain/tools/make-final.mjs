// tools/make-final.mjs — 生成 tests/final/*.png 干净玩法截图（供 vision-review 评审）
// 原则（见 memory）：tests/final 只放「含玩法剪影」的图——标题/教程/玩法/换章/特殊状态/移动端；
// 纯菜单（暂停/结算）留在 tests/artifacts，避免 silhouette 被拖低。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import { loadPlaywright, serve } from '../../../skills/webgame-playbook/scripts/_lib.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const OUT = path.join(ROOT, 'tests', 'final');
fs.mkdirSync(OUT, { recursive: true });

const { chromium } = loadPlaywright();
const { server, port } = await serve(ROOT, 8180);
const url = `http://127.0.0.1:${port}/`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch({
  headless: true,
  args: ['--use-gl=angle', '--use-angle=metal', '--autoplay-policy=no-user-gesture-required'],
});

async function shot(page, name) {
  await page.screenshot({ path: path.join(OUT, name), animations: 'disabled' });
  console.log('shot', name);
}

// ---------- 桌面 ----------
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await ctx.newPage();
await page.goto(url, { waitUntil: 'load', timeout: 20000 });
await page.waitForFunction(() => window.__ll && window.__ll.state.phase !== 'boot', { timeout: 10000 });
await sleep(500);
await shot(page, '01-title.png');

await page.click('#btn-start');
await sleep(700);
const skip = page.locator('[data-tutorial-skip]');
if (await skip.count()) await skip.click({ force: true }).catch(() => {});
// 截图专用：保证主角不会被随机掠食者秒杀，并处于可辨识的体型
await page.evaluate(() => {
  const r = window.__ll.run;
  r.player.mass = 105;
  r.player.invulnUntil = Infinity;
  r.step({ steerX: null, steerY: null });
});
await sleep(1200);
await shot(page, '02-play.png');

// 换章：中层带（阶段 4）
await page.evaluate(() => {
  const r = window.__ll.run;
  r.player.mass = 200;
  r.step({ steerX: null, steerY: null });
});
await sleep(300);
await shot(page, '03-twilight.png');

// 换章：热泉带（阶段 8）
await page.evaluate(() => {
  const r = window.__ll.run;
  r.player.mass = 640;
  r.step({ steerX: null, steerY: null });
});
await sleep(300);
await shot(page, '04-vent.png');

// 护体毒刺
await page.evaluate(() => {
  const r = window.__ll.run;
  r.player.stingUntil = r.time + 6;
});
await sleep(250);
await shot(page, '05-sting.png');

// 光链进化（signature）
await page.evaluate(() => { window.G.renderer.burst(640, 360, 'lightChain'); });
await sleep(120);
await shot(page, '06-chain.png');

// 教程重看（覆盖在玩法上）
await page.evaluate(() => { window.__ll.restart(); });
await sleep(400);
await page.evaluate(() => {
  const b = document.querySelector('[data-tutorial-replay]');
  if (b) b.click();
});
await sleep(500);
await shot(page, '07-tutorial.png');
await ctx.close();

// ---------- 移动端 ----------
const mctx = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const mpage = await mctx.newPage();
await mpage.goto(url, { waitUntil: 'load', timeout: 20000 });
await mpage.waitForFunction(() => window.__ll && window.__ll.state.phase !== 'boot', { timeout: 10000 });
await mpage.click('#btn-start');
await sleep(900);
const mskip = mpage.locator('[data-tutorial-skip]');
if (await mskip.count()) await mskip.click({ force: true }).catch(() => {});
await sleep(1200);
await shot(mpage, '08-mobile.png');
await mctx.close();

await browser.close();
server.close();
console.log('done →', OUT);
