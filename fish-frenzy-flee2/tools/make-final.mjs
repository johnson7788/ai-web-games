// 生成 tests/final/ 的 8 张「含玩法剪影」截图，供 vision-review.mjs 评审。
// 原则：每张都有最亮的可交互物（霓虹鱼群）+ 目标（发光小鱼「+」/金币/星）+ 威胁（红鲨/暗礁），
// 且实体摆在画面中带，避开顶部 HUD 与右上角按钮区。
// 运行：node tools/make-final.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadPlaywright, serve, waitForBoot } from '../../../skills/webgame-playbook/scripts/_lib.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'tests', 'final');
fs.mkdirSync(OUT, { recursive: true });

const { server, port } = await serve(ROOT, 8200);
const { chromium } = loadPlaywright();
const browser = await chromium.launch({
  headless: true,
  args: ['--use-gl=angle', '--use-angle=metal', '--autoplay-policy=no-user-gesture-required'],
});

async function shot(page, name) {
  await page.screenshot({ path: path.join(OUT, name), fullPage: false, animations: 'disabled', timeout: 15000 });
  console.log('·', name);
}

async function boot() {
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();
  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await waitForBoot(page, 10000);
  await page.evaluate(() => window.__ll.debug.setTutorialDone(true));
  return { context, page };
}

const TAU = Math.PI * 2;

// 1) 标题（演示鱼群在背后游）
{
  const { page } = await boot();
  await page.waitForTimeout(1000);
  await shot(page, '01-title.png');
  await page.context().close();
}

// 2) 早期玩法：领队 + 两只发光小鱼 + 红鲨 + 暗礁（居中构图）
{
  const { page } = await boot();
  await page.evaluate(() => {
    window.__ll.debug.startSeeded(3);
    window.__ll.debug.spawnPreyAt(-140, -90);
    window.__ll.debug.spawnPreyAt(130, -60);
    window.__ll.debug.spawnPredatorAt(260, 130, 28);
    window.__ll.debug.spawnRockAt(-280, 150, 32);
    window.__ll.debug.grow(2);
  });
  await page.waitForTimeout(120);
  await shot(page, '02-play.png');
  await page.context().close();
}

// 3) 成长后的鱼群
{
  const { page } = await boot();
  await page.evaluate(() => {
    window.__ll.debug.startSeeded(7);
    window.__ll.debug.grow(10);
    for (let i = 0; i < 4; i += 1) {
      const a = (i / 4) * Math.PI * 2;
      window.__ll.debug.spawnPreyAt(Math.cos(a) * 150, Math.sin(a) * 130);
    }
    window.__ll.debug.spawnPredatorAt(-300, 180, 30);
  });
  await page.waitForTimeout(120);
  await shot(page, '03-play-grow.png');
  await page.context().close();
}

// 4) 狂暴：金色光环 + 反吃红鲨
{
  const { page } = await boot();
  await page.evaluate(() => {
    window.__ll.debug.startSeeded(11);
    window.__ll.debug.triggerFrenzy();
    window.__ll.debug.grow(3);
    window.__ll.debug.spawnPredatorAt(150, -60, 26);
    window.__ll.debug.spawnPredatorAt(-180, 120, 30);
    window.__ll.debug.spawnPreyAt(80, 60);
  });
  await page.waitForTimeout(120);
  await shot(page, '04-play-frenzy.png');
  await page.context().close();
}

// 5) 威胁逼近：三只红鲨包围
{
  const { page } = await boot();
  await page.evaluate(() => {
    window.__ll.debug.startSeeded(13);
    window.__ll.debug.grow(2);
    window.__ll.debug.spawnPredatorAt(120, -50, 28);
    window.__ll.debug.spawnPredatorAt(-140, 100, 24);
    window.__ll.debug.spawnPredatorAt(60, 160, 32);
  });
  await page.waitForTimeout(120);
  await shot(page, '05-play-threat.png');
  await page.context().close();
}

// 6) 移动端玩法
{
  const context = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await waitForBoot(page, 10000);
  await page.evaluate(() => {
    window.__ll.debug.setTutorialDone(true);
    window.__ll.debug.startSeeded(5);
    window.__ll.debug.grow(1);
    window.__ll.debug.spawnPreyAt(-110, -70);
    window.__ll.debug.spawnPredatorAt(200, 110, 26);
    window.__ll.debug.spawnRockAt(-230, 140, 30);
  });
  await page.waitForTimeout(120);
  await shot(page, '06-play-mobile.png');
  await context.close();
}

// 7) 中文标题
{
  const { page } = await boot();
  await page.evaluate(() => {
    const s = document.getElementById('lang-select');
    s.value = 'zh'; s.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await page.waitForTimeout(800);
  await shot(page, '07-title-zh.png');
  await page.context().close();
}

// 8) 中文玩法（金币 + 暗礁 + 星 + 发光小鱼）
{
  const { page } = await boot();
  await page.evaluate(() => {
    const s = document.getElementById('lang-select');
    s.value = 'zh'; s.dispatchEvent(new Event('change', { bubbles: true }));
    window.__ll.debug.startSeeded(17);
    window.__ll.debug.grow(2);
    window.__ll.debug.spawnPreyAt(140, -80);
    window.__ll.debug.spawnRockAt(-260, -150, 30);
    window.__ll.debug.spawnRockAt(240, 170, 34);
    window.__ll.debug.spawnStarAt(-190, 90);
  });
  await page.waitForTimeout(120);
  await shot(page, '08-play-zh.png');
  await page.context().close();
}

await browser.close();
server.close();
console.log('done →', OUT);
