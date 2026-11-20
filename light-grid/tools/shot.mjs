// tools/shot.mjs — 生成 tests/final 的验收截图（标题/玩法/特殊格型/过载/结算/移动端）。
// 前 8 张（01–08 字母序）即 vision-review 的评审对象；这里全部产自真实运行。
import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { loadPlaywright, serve } from '../../../skills/webgame-playbook/scripts/_lib.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const OUT = join(ROOT, 'tests/final');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitBoot(page) {
  await page.waitForFunction(() => window.__ll && window.__ll.state.phase !== 'boot', { timeout: 12000 }).catch(() => {});
  await sleep(400);
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const { server, port } = await serve(ROOT, 8410);
  const { chromium } = loadPlaywright();
  const browser = await chromium.launch({
    headless: true,
    args: ['--use-gl=angle', '--use-angle=metal', '--autoplay-policy=no-user-gesture-required'],
  });
  const url = `http://127.0.0.1:${port}/`;

  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage();
  await page.goto(url, { waitUntil: 'load', timeout: 20000 });
  await waitBoot(page);

  // 01 标题（背后演示棋盘）
  await page.screenshot({ path: join(OUT, '01-title.png') });

  // 08 中文标题
  await page.evaluate(() => { const s = document.getElementById('lang-select'); s.value = 'zh'; s.dispatchEvent(new Event('change', { bubbles: true })); });
  await sleep(200);
  await page.screenshot({ path: join(OUT, '08-title-zh.png') });
  await page.evaluate(() => { const s = document.getElementById('lang-select'); s.value = 'en'; s.dispatchEvent(new Event('change', { bubbles: true })); });
  await sleep(150);

  // 02 玩法（5×5，点几步后）
  await page.click('#btn-start');
  await sleep(400);
  await page.click('[data-tutorial-skip]');
  await sleep(200);
  await page.evaluate(() => { const r = window.__ll.run; for (let i = 0; i < 3 && i < r.solution.length; i += 1) r.press(r.solution[i][0], r.solution[i][1]); });
  await sleep(250);
  await page.screenshot({ path: join(OUT, '02-play.png') });

  // 03 二极管格（第 4 关，点一个二极管）
  await page.evaluate(() => window.__ll.startLevel(3));
  await sleep(300);
  await page.evaluate(() => { const r = window.__ll.run; for (let rr = 0; rr < r.N; rr += 1) for (let c = 0; c < r.N; c += 1) if (r.types[rr][c] === 'diode') { r.press(rr, c); return; } });
  await sleep(250);
  await page.screenshot({ path: join(OUT, '03-diode.png') });

  // 04 霓虹管场景（7×7 第 25 关）
  await page.evaluate(() => window.__ll.startLevel(24));
  await sleep(350);
  await page.screenshot({ path: join(OUT, '04-neon.png') });

  // 05 过载熔断
  await page.evaluate(() => window.__ll.startLevel(0));
  await sleep(200);
  await page.evaluate(() => { const r = window.__ll.run; for (let i = 0; i < 200 && r.phase === 'playing'; i += 1) r.press(0, 0); });
  await sleep(600);
  await page.screenshot({ path: join(OUT, '05-overload.png') });

  // 06 过关结算（签名走线动画中）
  await page.evaluate(() => window.__ll.startLevel(0));
  await sleep(200);
  await page.evaluate(() => { const r = window.__ll.run; for (const [rr, cc] of r.solution) { if (r.phase !== 'playing') break; r.press(rr, cc); } });
  await sleep(650);
  await page.screenshot({ path: join(OUT, '06-clear.png') });

  await ctx.close();

  // 07 移动端（844×390）
  const mctx = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const mp = await mctx.newPage();
  await mp.goto(url, { waitUntil: 'load', timeout: 20000 });
  await waitBoot(mp);
  await mp.click('#btn-start');
  await sleep(500);
  await mp.click('[data-tutorial-skip]');
  await sleep(300);
  await mp.evaluate(() => { const r = window.__ll.run; for (let i = 0; i < 2 && i < r.solution.length; i += 1) r.press(r.solution[i][0], r.solution[i][1]); });
  await sleep(250);
  await mp.screenshot({ path: join(OUT, '07-mobile.png') });
  await mctx.close();

  await browser.close();
  server.close();

  const files = ['01-title.png', '02-play.png', '03-diode.png', '04-neon.png', '05-overload.png', '06-clear.png', '07-mobile.png', '08-title-zh.png'];
  for (const f of files) console.log('✓', join('tests/final', f));
  writeFileSync(join(OUT, 'shots.json'), `${JSON.stringify({ generatedAt: new Date().toISOString(), files }, null, 2)}\n`);
}

main().catch((e) => { console.error(e); process.exit(1); });
