// Sprout Hop · 生成 tests/final 验收截图（视觉评审用）。
// 数字前缀命名，保证排序在 tutorial-*.png 之前；全是真实玩法画面（含目标标记/轨迹弧线/三场景）。
// 运行：node tools/shots.mjs
import { mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadPlaywright, serve } from '../../../skills/webgame-playbook/scripts/_lib.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'tests', 'final');
mkdirSync(OUT, { recursive: true });

const { server, port } = await serve(ROOT, 8260);
const { chromium } = loadPlaywright();
const browser = await chromium.launch({
  headless: true,
  args: ['--use-gl=angle', '--use-angle=metal', '--autoplay-policy=no-user-gesture-required'],
});

async function shot(page, name) {
  await page.screenshot({ path: join(OUT, name), fullPage: false, animations: 'disabled' });
  console.log('✓', name);
}

async function playingAim(page) {
  await page.evaluate(() => {
    window.__ll.debug.setTutorialDone(true);
    window.__ll.start(0);
    const r = window.__ll.run();
    r.aimStart();
    r.aimSet({ x: 95, y: -55 }); // 向后拖 = 向前弹的蓄力（拖拽向量 = 弹射方向）
  });
  await page.waitForTimeout(350);
}

try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage();
  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'load' });
  await page.waitForTimeout(800);

  // 01 蓄力 + 轨迹弧线（签名瞬间）
  await playingAim(page);
  await shot(page, '01-aim.png');

  // 02 飞行中
  await page.evaluate(() => {
    window.__ll.start(0);
    const r = window.__ll.run();
    r.launch({ x: 330, y: -200 });
  });
  await page.waitForTimeout(260);
  await shot(page, '02-flight.png');

  // 03 完美落点（弹射到下一平台中心）
  await page.evaluate(() => {
    window.__ll.debug.setTutorialDone(true);
    window.__ll.debug.startSeeded(0, 3);
  });
  await page.waitForTimeout(200);
  await page.evaluate(() => window.__ll.debug.autoPlaceSolution());
  await page.waitForTimeout(300);
  await shot(page, '03-result.png');

  // 04 南瓜平台（L3）
  await page.evaluate(() => window.__ll.debug.loadLevel(2));
  await page.waitForTimeout(350);
  await shot(page, '04-pumpkin.png');

  // 05 午后藤棚（L5 顺风）
  await page.evaluate(() => window.__ll.debug.loadLevel(4));
  await page.waitForTimeout(350);
  await shot(page, '05-noon.png');

  // 06 月下豆田（L9 夜景）
  await page.evaluate(() => window.__ll.debug.loadLevel(8));
  await page.waitForTimeout(350);
  await shot(page, '06-night.png');

  // 07 中文 HUD（玩第 1 关）
  await page.evaluate(() => {
    const s = document.getElementById('lang-select');
    s.value = 'zh';
    s.dispatchEvent(new Event('change', { bubbles: true }));
    window.__ll.start(0);
  });
  await page.waitForTimeout(350);
  await shot(page, '07-zh.png');

  await ctx.close();

  // 08 移动端（844×390 触屏）
  const mctx = await browser.newContext({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const mp = await mctx.newPage();
  await mp.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'load' });
  await mp.waitForTimeout(800);
  await mp.evaluate(() => {
    window.__ll.debug.setTutorialDone(true);
    window.__ll.start(0);
  });
  await mp.waitForTimeout(350);
  await shot(mp, '08-mobile.png');
  await mctx.close();
} finally {
  await browser.close();
  server.close();
}
console.log('done →', OUT);
