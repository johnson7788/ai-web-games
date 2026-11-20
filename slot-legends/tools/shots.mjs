// tools/shots.mjs — 生成 tests/final/*.png（vision-review 输入，全部真实玩法截图）。
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { serve, loadPlaywright } from '../../../skills/webgame-playbook/scripts/_lib.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const OUT = join(ROOT, 'tests/final');
mkdirSync(OUT, { recursive: true });

const { server, port } = await serve(ROOT, 8160);
const { chromium } = loadPlaywright();
const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=metal'] });
const url = `http://127.0.0.1:${port}/`;

async function shot(page, name) {
  await page.screenshot({ path: join(OUT, name), animations: 'disabled' });
  console.log('shot', name);
}
async function waitIdle(page) {
  await page.waitForFunction("window.__ll.run && window.__ll.run.phase === 'idle'", { timeout: 8000 });
}
async function spinTo(page, phase, settleWait = 0) {
  await page.evaluate(() => window.__ll.spin());
  await page.waitForFunction(`window.__ll.run.phase === '${phase}'`, { timeout: 8000 });
  if (settleWait) await page.waitForTimeout(settleWait);
}

const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await context.newPage();
await page.goto(url, { waitUntil: 'load' });
await page.waitForFunction(() => typeof window.__ll !== 'undefined', { timeout: 15000 });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'load' });
await page.waitForFunction(() => window.__ll.state.phase !== 'boot', { timeout: 15000 });

await page.evaluate(() => window.__ll.start());
await page.waitForFunction(() => window.__ll.state.phase === 'playing', { timeout: 5000 });
await page.waitForTimeout(400);
await page.evaluate(() => window.__ll.tutorial.skip());
await waitIdle(page);

// 01 常规玩法
await page.evaluate(() => window.__ll.debug.setBalance(1000));
await spinTo(page, 'settle');
await page.waitForTimeout(1400);
await waitIdle(page);
await shot(page, '01-play.png');

// 02 中奖
await page.evaluate(() => { window.__ll.run.pendingForce = 'win'; });
await spinTo(page, 'settle', 60);
await shot(page, '02-win.png');
await waitIdle(page);

// 03 滚动中
await page.evaluate(() => window.__ll.spin());
await page.waitForFunction("window.__ll.run.phase === 'spinning'", { timeout: 3000 });
await page.waitForTimeout(300);
await shot(page, '03-spin.png');
await waitIdle(page);

// 04 免费旋转
await page.evaluate(() => { window.__ll.run.pendingForce = 'free'; });
await spinTo(page, 'settle', 120);
await shot(page, '04-freespin.png');
await page.waitForFunction("window.__ll.run.phase === 'idle' || window.__ll.run.phase === 'spinning'", { timeout: 8000 });
await page.waitForTimeout(1500);
await page.evaluate(() => { window.__ll.run.freeSpins = 0; window.__ll.run.phase = 'idle'; window.__ll.run.freeSpin = false; window.__ll.run.reelStopped = [true,true,true,true,true]; });
await waitIdle(page);

// 05 升级
await page.evaluate(() => window.__ll.debug.setSpins(11));
await spinTo(page, 'settle', 60);
await shot(page, '05-levelup.png');
await waitIdle(page);

// 06 jackpot（金雨）
await page.evaluate(() => { window.__ll.debug.setSpins(250); window.__ll.run.pendingForce = 'jackpot'; });
await spinTo(page, 'settle', 150);
await shot(page, '06-jackpot.png');
await waitIdle(page);

// 07 中文玩法
await page.evaluate(() => window.__ll.setLang('zh'));
await page.waitForTimeout(300);
await page.evaluate(() => { window.__ll.run.pendingForce = 'win'; });
await spinTo(page, 'settle', 60);
await shot(page, '07-play-zh.png');

await context.close();

// 08 移动端玩法
const mctx = await browser.newContext({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
const mp = await mctx.newPage();
await mp.goto(url, { waitUntil: 'load' });
await mp.waitForFunction(() => typeof window.__ll !== 'undefined', { timeout: 15000 });
await mp.evaluate(() => window.__ll.start());
await mp.waitForFunction(() => window.__ll.state.phase === 'playing', { timeout: 5000 });
await mp.waitForTimeout(400);
await mp.evaluate(() => window.__ll.tutorial.skip());
await mp.evaluate(() => window.__ll.spin());
await mp.waitForTimeout(900);
await shot(mp, '08-mobile.png');
await mctx.close();

await browser.close();
server.close();
console.log('done →', OUT);
