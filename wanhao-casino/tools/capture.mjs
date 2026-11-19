// WANHAO CASINO · 截图采集：生成 tests/final 的 8 张评审截图 + poster.jpg（1280×720）。
// 用 __ll 调试口驱动到确定性状态。服务用完即关。
// 运行：node tools/capture.mjs

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadPlaywright, serve, createErrorCollector, waitForBoot } from '../../../skills/webgame-playbook/scripts/_lib.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'tests', 'final');
mkdirSync(OUT, { recursive: true });

const { server, port } = await serve(ROOT, 8250);
const { chromium } = loadPlaywright();
const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=metal', '--autoplay-policy=no-user-gesture-required'] });
const base = `http://127.0.0.1:${port}/`;

async function openPage(viewport, mobile = false) {
  const context = await browser.newContext({
    viewport,
    deviceScaleFactor: mobile ? 2 : 1,
    isMobile: mobile,
    hasTouch: mobile,
  });
  const page = await context.newPage();
  const collector = createErrorCollector();
  collector.attach(page, port);
  await page.goto(base, { waitUntil: 'load', timeout: 20000 });
  await waitForBoot(page, 10000);
  return { context, page, collector };
}

function shot(page, name, fullPage = false) {
  return page.screenshot({ path: join(OUT, name), fullPage, animations: 'disabled', timeout: 15000 });
}

const errors = [];

try {
  // 1) 标题屏（canvas 背后是吸引态牌桌）
  {
    const { context, page } = await openPage({ width: 1280, height: 720 });
    await page.waitForTimeout(800);
    await shot(page, '01-title.png');
    await context.close();
  }

  // 2) 游戏中：三门已下注
  {
    const { context, page } = await openPage({ width: 1280, height: 720 });
    await page.evaluate(() => { window.__ll.start(); });
    await page.waitForTimeout(400);
    await page.evaluate(() => { window.__ll.tutorial.skip(); window.__ll.debug.betAll(); });
    await page.waitForTimeout(250);
    await shot(page, '02-playing.png');
    await context.close();
  }

  // 3) 开牌：四手全亮（玩家三门全赢的漂亮局面）
  {
    const { context, page } = await openPage({ width: 1280, height: 720 });
    await page.evaluate(() => { window.__ll.start(); });
    await page.waitForTimeout(300);
    await page.evaluate(() => {
      window.__ll.tutorial.skip();
      window.__ll.debug.betAll();
      window.__ll.debug.forceHands({ house: [1, 2], sun: [9, 9], moon: [8, 8], star: [7, 7] });
    });
    await page.waitForTimeout(250);
    await shot(page, '03-reveal.png');
    // poster：同款战斗画面存 jpeg
    await page.screenshot({ path: join(ROOT, 'poster.jpg'), type: 'jpeg', quality: 88, animations: 'disabled' });
    await context.close();
  }

  // 4) 结算屏（赢 + 星级）
  {
    const { context, page } = await openPage({ width: 1280, height: 720 });
    await page.evaluate(() => { window.__ll.start(); });
    await page.waitForTimeout(300);
    await page.evaluate(() => {
      window.__ll.tutorial.skip();
      window.__ll.debug.skipToRound(8);
      window.__ll.debug.betAll();
      window.__ll.debug.roll();
      window.__ll.debug.fastForward();
    });
    await page.waitForTimeout(400);
    await shot(page, '04-result.png');
    await context.close();
  }

  // 5) 中文界面（游戏中已下注）
  {
    const { context, page } = await openPage({ width: 1280, height: 720 });
    await page.evaluate(() => { window.__ll.start(); });
    await page.waitForTimeout(300);
    await page.evaluate(() => {
      window.__ll.tutorial.skip();
      const s = document.getElementById('lang-select');
      s.value = 'zh';
      s.dispatchEvent(new Event('change', { bubbles: true }));
      window.__ll.debug.betAll();
    });
    await page.waitForTimeout(300);
    await shot(page, '05-zh.png');
    await context.close();
  }

  // 6) 移动端横屏（触屏）
  {
    const { context, page } = await openPage({ width: 844, height: 390 }, true);
    await page.evaluate(() => { window.__ll.start(); });
    await page.waitForTimeout(400);
    await page.evaluate(() => { window.__ll.tutorial.skip(); window.__ll.debug.betAll(); });
    await page.waitForTimeout(250);
    await shot(page, '06-mobile.png');
    await context.close();
  }

  // 7) 连胜横幅（streak=2，开牌全赢）
  {
    const { context, page } = await openPage({ width: 1280, height: 720 });
    await page.evaluate(() => { window.__ll.start(); });
    await page.waitForTimeout(300);
    await page.evaluate(() => {
      window.__ll.tutorial.skip();
      window.__ll.debug.setStreak(2);
      window.__ll.debug.betAll();
      window.__ll.debug.forceHands({ house: [1, 2], sun: [9, 9], moon: [8, 8], star: [7, 7] });
    });
    await page.waitForTimeout(250);
    await shot(page, '07-streak.png');
    await context.close();
  }

  // 8) 万能牌（Joker）开牌
  {
    const { context, page } = await openPage({ width: 1280, height: 720 });
    await page.evaluate(() => { window.__ll.start(); });
    await page.waitForTimeout(300);
    await page.evaluate(() => {
      window.__ll.tutorial.skip();
      window.__ll.debug.betAll();
      window.__ll.debug.forceHands({ house: [1, 2], sun: [0, 5], moon: [9, 9], star: [3, 3] });
    });
    await page.waitForTimeout(250);
    await shot(page, '08-joker.png');
    await context.close();
  }
} catch (e) {
  errors.push(String(e && e.message || e));
  console.error('capture error:', e);
} finally {
  await browser.close();
  server.close();
}

console.log('wrote tests/final/*.png + poster.jpg');
if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
