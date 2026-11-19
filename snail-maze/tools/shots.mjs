// SNAIL MAZE · 验收截图：真实运行截图 → tests/final/*.png + poster.jpg（1280×720）。
// 用法：node tools/shots.mjs（自带服务，用完即关；端口 8200-8299 自增）。
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { loadPlaywright, serve, waitForBoot } from '../../../skills/webgame-playbook/scripts/_lib.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FINAL = path.join(ROOT, 'tests', 'final');

const { chromium } = loadPlaywright();
const { server, port } = await serve(ROOT, 8210);
const baseUrl = `http://127.0.0.1:${port}/`;

fs.mkdirSync(FINAL, { recursive: true });

const browser = await chromium.launch({
  headless: true,
  args: ['--use-gl=angle', '--use-angle=metal', '--autoplay-policy=no-user-gesture-required'],
});

async function shot(page, name) {
  await page.screenshot({ path: path.join(FINAL, name) });
  console.log('  ·', name);
}

async function startSeeded(page, idx, seed) {
  await page.evaluate(([i, s]) => window.__ll.debug.startSeeded(i, s), [idx, seed]);
}

// 等蜗牛走到当前段中部（远离拐角/障碍，画面干净）
async function waitPct(page, lo = 0.25, hi = 0.7, timeout = 12000) {
  await page.waitForFunction(({ lo, hi }) => {
    const r = window.__ll.run();
    if (!r || r.state.phase !== 'running') return false;
    const s = r.state;
    const v = r.view();
    const len = v.lens[s.seg];
    if (!len) return false;
    const p = s.dist / len;
    return p >= lo && p <= hi;
  }, { lo, hi }, { timeout });
}

try {
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();
  await page.goto(baseUrl, { waitUntil: 'load', timeout: 20000 });
  await waitForBoot(page, 10000);
  await page.evaluate(() => window.__ll.debug.setTutorialDone(true));

  await shot(page, '01-title.png');

  await startSeeded(page, 0, 11);
  await waitPct(page, 0.3, 0.65);
  await shot(page, '02-playing.png');

  await page.evaluate(() => window.__ll.debug.autoWin());
  await page.waitForTimeout(350);
  await shot(page, '03-result.png');

  await startSeeded(page, 2, 21);
  await waitPct(page, 0.3, 0.6);
  await shot(page, '04-rock-level.png');

  await startSeeded(page, 1, 31);
  await waitPct(page, 0.3, 0.6);
  await shot(page, '05-rotate-level.png');

  await startSeeded(page, 3, 41);
  await waitPct(page, 0.3, 0.6);
  await shot(page, '06-random-level.png');

  // L1 中段（尾迹 + 星尘 + 蜗牛）
  await startSeeded(page, 0, 51);
  await waitPct(page, 0.5, 0.7);
  await shot(page, '07-playing-mid.png');

  // 后期关卡（更长赛道 + 更高速度）
  await startSeeded(page, 10, 81);
  await waitPct(page, 0.3, 0.6);
  await shot(page, '08-late-level.png');

  // 中文标题（放 09，不进前 8 张视觉评审）
  await page.evaluate(() => window.__ll.home());
  await page.evaluate(() => { const s = document.getElementById('lang-select'); s.value = 'zh'; s.dispatchEvent(new Event('change', { bubbles: true })); });
  await page.waitForTimeout(250);
  await shot(page, '09-zh-title.png');

  // 海报
  await page.evaluate(() => { const s = document.getElementById('lang-select'); s.value = 'en'; s.dispatchEvent(new Event('change', { bubbles: true })); });
  await page.waitForTimeout(150);
  await startSeeded(page, 0, 71);
  await waitPct(page, 0.45, 0.68);
  await page.screenshot({ path: path.join(ROOT, 'poster.jpg'), quality: 90, type: 'jpeg' });
  console.log('  · poster.jpg (1280×720)');

  await context.close();

  // 移动端横屏
  const mctx = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const mp = await mctx.newPage();
  await mp.goto(baseUrl, { waitUntil: 'load', timeout: 20000 });
  await waitForBoot(mp, 10000);
  await mp.evaluate(() => window.__ll.debug.setTutorialDone(true));
  await startSeeded(mp, 0, 61);
  await waitPct(mp, 0.35, 0.65);
  await shot(mp, '10-mobile.png');
  await mctx.close();

  console.log(`\nshots → ${FINAL}`);
} finally {
  await browser.close();
  server.close();
}
