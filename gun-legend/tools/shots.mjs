// tools/shots.mjs — 生成 tests/final 的 8 张验收截图（标题/玩法/白鸽/三场景/移动端/结算）
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serve, loadPlaywright, waitForBoot } from '../../../skills/webgame-playbook/scripts/_lib.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const OUT = path.join(ROOT, 'tests', 'final');
fs.mkdirSync(OUT, { recursive: true });

const { server, port } = await serve(ROOT, 8190);
const { chromium } = loadPlaywright();
const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=metal', '--autoplay-policy=no-user-gesture-required'] });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const base = `http://127.0.0.1:${port}/`;

async function shot(page, name) {
  await page.screenshot({ path: path.join(OUT, name), fullPage: false });
  console.log('·', name);
}

async function skipTutorial(page) {
  const skip = page.locator('[data-tutorial-skip]').first();
  if (await skip.count()) await skip.click({ force: true }).catch(() => {});
}

try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage();
  await page.goto(base, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await waitForBoot(page, 10000);
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'domcontentloaded' });
  await waitForBoot(page, 10000);
  await page.waitForTimeout(600);

  await shot(page, '01-title.png');

  await page.click('#btn-start');
  await page.waitForTimeout(700);
  await skipTutorial(page);
  await page.waitForTimeout(1800);
  await shot(page, '02-play.png');

  await page.waitForTimeout(2200);
  await shot(page, '03-combat.png');

  // 白鸽时刻
  await page.evaluate(() => { const r = window.__ll.run; r.guns.left = 1; r.guns.right = 1; r.fireCd = 0; r.step({ aimX: 640, aimY: 100, fire: true }); r.drainEvents(); });
  await page.waitForTimeout(260);
  await shot(page, '04-dove.png');

  // 死亡结算（第 1-2 场）
  await page.evaluate(() => { const r = window.__ll.run; for (let k = 0; k < 60 * 300 && r.phase === 'playing'; k++) { r.step({}); r.drainEvents(); } });
  await page.waitForTimeout(700);
  await shot(page, '05-dead.png');

  // 天台（第 5 场）
  await page.evaluate(() => window.__ll.start());
  await page.waitForTimeout(700);
  await skipTutorial(page);
  await page.evaluate(() => { const r = window.__ll.run; r.round = 5; r.scene = 2; r.enemies = []; r.wave = { timer: 0.3, spawned: 0, waiting: true }; r.roundClearing = false; });
  await page.waitForTimeout(1400);
  await shot(page, '06-rooftop.png');

  // 酒楼（第 9 场）
  await page.evaluate(() => { const r = window.__ll.run; r.round = 9; r.scene = 3; r.enemies = []; r.wave = { timer: 0.3, spawned: 0, waiting: true }; r.roundClearing = false; });
  await page.waitForTimeout(1400);
  await shot(page, '07-restaurant.png');
  await ctx.close();

  // 移动端
  const mctx = await browser.newContext({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true });
  const mpage = await mctx.newPage();
  await mpage.goto(base, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await waitForBoot(mpage, 10000);
  await mpage.evaluate(() => localStorage.clear());
  await mpage.reload({ waitUntil: 'domcontentloaded' });
  await waitForBoot(mpage, 10000);
  await mpage.waitForTimeout(600);
  await mpage.click('#btn-start');
  await mpage.waitForTimeout(700);
  await skipTutorial(mpage);
  await mpage.waitForTimeout(3400);
  await shot(mpage, '08-mobile-play.png');
  await mctx.close();
} finally {
  await browser.close();
  server.close();
}
console.log('done');
