// tools/make-shots.mjs — 生成 tests/final 验收截图（真实运行，供 vision-review 评审）。
// 复用 shared _lib 的 serve/playwright；驱动 sim 到指定状态后截图。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadPlaywright, serve, waitForBoot } from '../../../skills/webgame-playbook/scripts/_lib.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const outDir = path.join(root, 'tests', 'final');
fs.mkdirSync(outDir, { recursive: true });

const { server, port } = await serve(root, 8190);
const { chromium } = loadPlaywright();
const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=metal', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
page.on('pageerror', (e) => console.error('pageerror', e.message));

const sleep = (ms) => page.waitForTimeout(ms);
const shot = (name) => page.screenshot({ path: path.join(outDir, name) });
const evalJs = (fn, arg) => page.evaluate(fn, arg);

// 驱动 sim：挖到目标矿道（可选：在中途停下留岩石）
async function drive(shaftTarget, opts = {}) {
  const hire = !!opts.hire;
  return evalJs(({ shaftTarget, hire }) => {
    const r = window.__ll.run;
    let guard = 0;
    while (guard < 3000 && r.phase === 'playing' && r.shaft < shaftTarget) {
      guard += 1;
      if (r.canDig()) r.step({ dig: true });
      else { const s = r.findSwap(true) || r.findSwap(false); if (s) r.step({ swap: s }); else r.step({}); }
      r.drainEvents();
    }
    if (hire && r.goblins.length < 1 && r.coins >= 20) r.step({ hire: 4 });
    return { shaft: r.shaft, coins: r.coins, depth: r.depth, goblins: r.goblins.length, boss: !!r.boss };
  }, { shaftTarget, hire });
}

try {
  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'load', timeout: 20000 });
  await waitForBoot(page, 10000);
  await page.waitForFunction(() => window.__ll?.state?.phase === 'title', { timeout: 8000 });
  await sleep(300);

  // 01 标题屏
  await shot('01-title.png');

  // 开始并跳过引导
  await page.click('#btn-start');
  await sleep(600);
  await page.click('[data-tutorial-skip]');
  await sleep(300);

  // 02 主要玩法（shaft 1 初盘：矿石 + 岩壁 + HUD）
  await shot('02-play.png');

  // 03 点亮列 + 矿工（推进到 shaft 2，雇一个地精照亮中间列）
  await drive(2, { hire: true });
  await sleep(200);
  await shot('03-lit.png');

  // 04 头目矿兽（shaft 2 末层）
  await evalJs(() => {
    const r = window.__ll.run;
    for (let c = 0; c < 9; c += 1) for (let rr = 0; rr < 9; rr += 1) if (r.board[c][rr].t === 100 || r.board[c][rr].t === 101) r.board[c][rr].t = 0;
    r.resources.fuel = 20;
    r.step({ dig: true });
    r.drainEvents();
    return !!r.boss;
  });
  await sleep(200);
  await shot('04-boss.png');

  // 05 塌方预警 + 加固（把塌方时间拨近）
  await evalJs(() => { const r = window.__ll.run; r.nextCollapseAt = r.time + 3; return true; });
  await sleep(200);
  await shot('05-collapse.png');

  // 06 结算卡（强制失败）
  await evalJs(() => { const r = window.__ll.run; r.moves = 0; r.step({}); return r.phase; });
  await sleep(400);
  await shot('06-dead.png');

  // 07 中文玩法
  await evalJs(() => { window.__ll.setLang('zh'); window.__ll.start(); return true; });
  await sleep(400);
  await page.click('[data-tutorial-skip]').catch(() => {});
  await drive(2, {});
  await sleep(200);
  await shot('07-zh-play.png');

  // 08 移动端
  const mctx = await browser.newContext({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const mp = await mctx.newPage();
  await mp.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'load', timeout: 20000 });
  await waitForBoot(mp, 10000);
  await mp.waitForFunction(() => window.__ll?.state?.phase === 'title', { timeout: 8000 });
  await mp.click('#btn-start');
  await sleep(500);
  await mp.click('[data-tutorial-skip]').catch(() => {});
  await mp.screenshot({ path: path.join(outDir, '08-mobile.png') });
  await mctx.close();

  console.log('shots written to tests/final/');
} finally {
  await browser.close();
  server.close();
}
