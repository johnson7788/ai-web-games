// tools/shots.mjs — 生成 tests/final/ 验收截图（真实运行，供 vision-review 评审）
// 用法：node tools/shots.mjs [--port 8126]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadPlaywright, serve } from '../../../skills/webgame-playbook/scripts/_lib.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'tests', 'final');
const portArg = process.argv.indexOf('--port');
const startPort = portArg >= 0 ? Number(process.argv[portArg + 1]) : 8126;

fs.mkdirSync(OUT, { recursive: true });
const { server, port } = await serve(ROOT, startPort);
const { chromium } = loadPlaywright();
const browser = await chromium.launch({
  headless: true,
  args: ['--use-gl=angle', '--use-angle=metal', '--autoplay-policy=no-user-gesture-required'],
});

async function shot(page, name) {
  await page.screenshot({ path: path.join(OUT, name), fullPage: false, animations: 'disabled' });
}

async function waitBoot(page) {
  await page.waitForFunction(() => window.__ll && window.__ll.state.phase !== 'boot', { timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(400);
}

const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await ctx.newPage();
await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'load', timeout: 30000 });
await waitBoot(page);

// 01 标题（demo 场景背景）
await shot(page, '01-title.png');

// 02 中文标题
await page.evaluate(() => {
  const s = document.getElementById('lang-select');
  s.value = 'zh';
  s.dispatchEvent(new Event('change', { bubbles: true }));
});
await page.waitForTimeout(250);
await shot(page, '02-title-zh.png');
await page.evaluate(() => {
  const s = document.getElementById('lang-select');
  s.value = 'en';
  s.dispatchEvent(new Event('change', { bubbles: true }));
});

// 开始并跳过引导
await page.click('#btn-start');
await page.waitForTimeout(600);
if (await page.locator('[data-tutorial-skip]').count()) {
  await page.locator('[data-tutorial-skip]').click({ force: true }).catch(() => {});
  await page.waitForTimeout(400);
}
await page.waitForTimeout(1200);
// 03 玩法：波次 1 货箱下坠 + 炮台 + HUD
await shot(page, '03-play.png');

// 04 战斗：朝中央货箱开火，炮弹飞行
await page.evaluate(() => {
  const r = window.__ll.run;
  for (let i = 0; i < 30; i++) { r.step({ aimX: 640, aimY: 120, fire: i % 24 === 0 }); r.drainEvents(); }
});
await page.waitForTimeout(150);
await shot(page, '04-combat.png');

// 05 回声：注入护盾箱 + 已反弹的水平横扫弹
await page.evaluate(() => {
  const r = window.__ll.run;
  r.phase = 'playing';
  r.wave = 3;
  r.scene = 0;
  r.targets = [
    {
      id: 90001, type: 'shielded', x: 520, y: 300, w: 96, h: 84,
      hp: 55, maxHp: 55, vy: 0, score: 260, crash: 22,
      shield: true, armor: false, hitFlash: 0, slowUntil: null, slowMult: 1, dead: false,
    },
    {
      id: 90005, type: 'crate', x: 800, y: 220, w: 96, h: 84,
      hp: 40, maxHp: 40, vy: 0, score: 100, crash: 18,
      shield: false, armor: false, hitFlash: 0, slowUntil: null, slowMult: 1, dead: false,
    },
  ];
  r.bullets = [{
    id: 90002, x: 900, y: 300, vx: -460, vy: 0, damage: 40,
    bounces: 1, pierceLeft: 0, life: 2, targetsHit: [], roared: false,
  }];
});
await page.waitForTimeout(120);
await shot(page, '05-echo.png');

// 06 升级三选一：清空目标触发
await page.evaluate(() => {
  const r = window.__ll.run;
  r.targets = [];
  r.step({ fire: false });
  r.drainEvents();
});
await page.waitForTimeout(350);
await shot(page, '06-upgrade.png');

// 07 Boss：注入第 12 波巨型货箱
await page.evaluate(() => {
  const r = window.__ll.run;
  r.phase = 'playing';
  r.wave = 12;
  r.scene = 2;
  r.hp = 74;
  r.targets = [{
    id: 90003, type: 'boss', x: 640, y: 210, w: 96, h: 84,
    hp: 1800, maxHp: 2600, vy: 12, score: 5000, crash: 60,
    shield: false, armor: true, hitFlash: 0, slowUntil: null, slowMult: 1, dead: false,
  }];
  r.bullets = [{
    id: 90004, x: 520, y: 260, vx: 480, vy: 0, damage: 60,
    bounces: 1, pierceLeft: 0, life: 2, targetsHit: [], roared: false,
  }];
});
await page.waitForTimeout(150);
await shot(page, '07-boss.png');
await ctx.close();

// 移动端
const mctx = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const mpage = await mctx.newPage();
await mpage.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'load', timeout: 30000 });
await waitBoot(mpage);
await mpage.click('#btn-start');
await mpage.waitForTimeout(600);
if (await mpage.locator('[data-tutorial-skip]').count()) {
  await mpage.locator('[data-tutorial-skip]').click({ force: true }).catch(() => {});
  await mpage.waitForTimeout(400);
}
await mpage.evaluate(() => {
  const r = window.__ll.run;
  for (let i = 0; i < 24; i++) { r.step({ aimX: 640, aimY: 140, fire: i % 22 === 0 }); r.drainEvents(); }
});
await mpage.waitForTimeout(300);
await shot(mpage, '08-mobile.png');
await mctx.close();

await browser.close();
server.close();
console.log('shots written to tests/final/');
