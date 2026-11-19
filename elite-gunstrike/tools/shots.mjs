// tools/shots.mjs — 生成 tests/final 的 8 张验收截图（标题/玩法/战斗/爆炸/多场景/俘虏/移动端）
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serve, loadPlaywright, waitForBoot } from '../../../skills/webgame-playbook/scripts/_lib.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const OUT = path.join(ROOT, 'tests', 'final');
fs.mkdirSync(OUT, { recursive: true });

const { server, port } = await serve(ROOT, 8200);
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

// 在浏览器里发射一发到指定点
async function launchAt(page, ax, ay) {
  await page.evaluate(([x, y]) => {
    const r = window.__ll.run;
    r.step({ aimX: x, aimY: y, fire: true });
    r.step({ aimX: x, aimY: y, fire: false });
  }, [ax, ay]);
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
  await page.waitForTimeout(700);
  // 第 1 关：拖拽瞄准 + 发射一枚弹
  await launchAt(page, 640, 180);
  await page.waitForTimeout(500);
  await shot(page, '02-play.png');

  // 第 3 关：炮塔机 + 火力
  await page.evaluate(() => window.__ll.run.loadLevel(3));
  await page.waitForTimeout(400);
  await launchAt(page, 420, 200);
  await page.waitForTimeout(600);
  await shot(page, '03-combat.png');

  // 第 5 关：能量核心爆炸（直接命中核心）
  await page.evaluate(() => window.__ll.run.loadLevel(5));
  await page.waitForTimeout(400);
  await page.evaluate(() => {
    const r = window.__ll.run;
    r.bolts.push({ id: 900000, x: 640, y: 110, vx: 400, vy: 0, life: 1 });
  });
  await page.waitForTimeout(400);
  await shot(page, '04-explosion.png');

  // 第 8 关：深红反应堆 + 重装机甲 + 俘虏
  await page.evaluate(() => window.__ll.run.loadLevel(8));
  await page.waitForTimeout(500);
  await launchAt(page, 420, 180);
  await page.waitForTimeout(600);
  await shot(page, '05-reactor.png');

  // 第 4 关：俘虏保护
  await page.evaluate(() => window.__ll.run.loadLevel(4));
  await page.waitForTimeout(500);
  await shot(page, '06-captive.png');

  // 第 11 关：紫罗兰堡垒 + 三重重甲
  await page.evaluate(() => window.__ll.run.loadLevel(11));
  await page.waitForTimeout(500);
  await launchAt(page, 360, 180);
  await page.waitForTimeout(500);
  await shot(page, '07-citadel.png');
  await ctx.close();

  // 移动端
  const mctx = await browser.newContext({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
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
  await mpage.waitForTimeout(600);
  await launchAt(mpage, 420, 180);
  await mpage.waitForTimeout(900);
  await shot(mpage, '08-mobile-play.png');
  await mctx.close();
} finally {
  await browser.close();
  server.close();
}
console.log('done');
