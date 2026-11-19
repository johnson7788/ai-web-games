// FROG HOP LEAF · 截图脚本：生成 tests/final/*.png（vision-review 用）+ poster.jpg（物料）。
// 自带服务用完即关，端口 8200-8299 自增。运行：node tools/shots.mjs
import { loadPlaywright, serve } from '../../../skills/webgame-playbook/scripts/_lib.mjs';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const FINAL = join(ROOT, 'tests', 'final');
mkdirSync(FINAL, { recursive: true });

const { chromium } = loadPlaywright();
const { server, port } = await serve(ROOT, 8200);
const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=metal', '--autoplay-policy=no-user-gesture-required'] });

async function play(page, level) {
  await page.evaluate((lv) => { window.__ll.debug.setTutorialDone(true); window.__ll.debug.loadLevel(lv); }, level);
  await page.waitForTimeout(260);
}

async function snap(page, level, frac, name, lang) {
  await page.evaluate((lv) => {
    const s = document.getElementById('lang-select');
    if (s) { s.value = lv.lang; s.dispatchEvent(new Event('change', { bubbles: true })); }
    window.__ll.debug.loadLevel(lv.level);
  }, { lang, level });
  await page.waitForTimeout(200);
  await page.evaluate((f) => { window.__ll.debug.shotPose(); window.__ll.debug.freeze(true); }, frac);
  await page.waitForTimeout(80);
  await page.screenshot({ path: join(FINAL, name) });
  await page.evaluate(() => window.__ll.debug.freeze(false));
  console.log('shot', name);
}

try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage();
  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'load', timeout: 20000 });
  await page.waitForFunction(() => typeof window.__ll !== 'undefined', { timeout: 10000 });
  await page.evaluate(() => window.__ll.debug.setTutorialDone(true));
  await page.waitForTimeout(400);

  await snap(page, 0, 0.9, '01-shallows.png', 'en');
  await snap(page, 1, 0.9, '02-reeds.png', 'en');
  await snap(page, 2, 0.9, '03-canopy.png', 'en');
  await snap(page, 1, 0.9, '04-spring-leaf.png', 'en');
  await snap(page, 2, 0.93, '05-golden-close.png', 'en');
  await snap(page, 0, 0.9, '06-zh-shallows.png', 'zh');
  await snap(page, 0, 0.94, '07-near-goal.png', 'en');

  // 海报：中段爬升 + 金色终点门
  await page.evaluate(() => { window.__ll.debug.loadLevel(0); });
  await page.waitForTimeout(200);
  await page.evaluate(() => { window.__ll.debug.shotPose(); window.__ll.debug.freeze(true); });
  await page.waitForTimeout(80);
  await page.screenshot({ path: join(ROOT, 'poster.jpg'), type: 'jpeg', quality: 90 });
  await page.evaluate(() => window.__ll.debug.freeze(false));
  console.log('poster.jpg');

  await ctx.close();

  // 移动端（横屏触屏）
  const mctx = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const mp = await mctx.newPage();
  await mp.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'load', timeout: 20000 });
  await mp.waitForFunction(() => typeof window.__ll !== 'undefined', { timeout: 10000 });
  await mp.evaluate(() => window.__ll.debug.setTutorialDone(true));
  await mp.evaluate(() => window.__ll.debug.loadLevel(0));
  await mp.waitForTimeout(200);
  await mp.evaluate(() => { window.__ll.debug.shotPose(); window.__ll.debug.freeze(true); });
  await mp.waitForTimeout(80);
  await mp.screenshot({ path: join(FINAL, '08-mobile.png') });
  await mp.evaluate(() => window.__ll.debug.freeze(false));
  console.log('shot 08-mobile.png');
  await mctx.close();
} finally {
  await browser.close();
  server.close();
}
console.log('done');
