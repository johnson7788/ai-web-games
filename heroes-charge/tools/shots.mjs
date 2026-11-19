// tools/shots.mjs — 生成视觉评审截图到 tests/final/（真实浏览器驱动，非设计稿）。
// 用真实 UI 点击 + __ll 调试口把游戏推到指定状态后截图；前 8 张均为战斗场景。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadPlaywright, serve } from '../../../skills/webgame-playbook/scripts/_lib.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'tests', 'final');
fs.mkdirSync(OUT, { recursive: true });

const { server, port } = await serve(ROOT, 8430);
const baseUrl = `http://127.0.0.1:${port}/`;
const { chromium } = loadPlaywright();

const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=metal', '--autoplay-policy=no-user-gesture-required'] });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function shot(page, name) {
  await page.screenshot({ path: path.join(OUT, name), animations: 'disabled' });
  console.log('·', name);
}

async function newPage(viewport, mobile = false) {
  const ctx = await browser.newContext({
    viewport,
    deviceScaleFactor: mobile ? 2 : 1,
    isMobile: mobile,
    hasTouch: mobile,
  });
  const page = await ctx.newPage();
  await page.goto(baseUrl, { waitUntil: 'load', timeout: 20000 });
  await page.waitForFunction(() => window.__ll && window.__ll.state?.phase !== 'boot', { timeout: 10000 }).catch(() => {});
  await sleep(500);
  return { ctx, page };
}

async function startPlaying(page) {
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => window.__ll && window.__ll.state?.phase === 'title', { timeout: 10000 }).catch(() => {});
  await sleep(400);
  await page.click('#btn-start');
  await sleep(600);
  await page.evaluate(() => { try { window.__ll.tutorial.skip(); } catch { /* noop */ } });
  await sleep(300);
}

// 摆姿势：把玩家放到最近敌人左前方，重刷关卡横幅让「DISTRICT N」上下文可见
async function poseNear(page, enemyIdx, gap) {
  await page.evaluate(({ enemyIdx, gap }) => {
    const r = window.__ll.run;
    const e = r.enemies[enemyIdx] || r.enemies[0];
    r.player.x = Math.max(160, e.x - gap);
    r.player.facing = 1;
    r.levelIntroT = 40;   // 让「DISTRICT N」横幅出现在截图里
    r.step({});
  }, { enemyIdx, gap });
  await sleep(350);
}

const { ctx: desktop, page } = await newPage({ width: 1280, height: 720 });

// 1) 第 1 关战斗：英雄与敌人分离，目标可见
await startPlaying(page);
await poseNear(page, 0, 170);
await shot(page, '01-battle-l1.png');

// 2) 连击命中：多段连击 + 敌人受击
await page.evaluate(() => {
  const r = window.__ll.run;
  const e = r.enemies[0];
  e.hp = 80; e.maxHp = 80;
  r.player.x = e.x - 70; r.player.facing = 1;
  r.levelIntroT = 40;
  for (let i = 0; i < 5; i += 1) { r.step({ attack: true }); r.drainEvents(); }
});
await sleep(300);
await shot(page, '02-combo-hit.png');

// 3) 冲刺：残影可见
await page.evaluate(() => {
  const r = window.__ll.run;
  r.player.dashMeter = 1;
  r.levelIntroT = 40;
  r.step({ dash: true });
});
await sleep(120);
await shot(page, '03-dash.png');

// 4) 第 2 关战斗
await page.evaluate(() => { window.__ll.run.jumpTo(2); });
await poseNear(page, 0, 170);
await shot(page, '04-battle-l2.png');

// 5) 第 3 关战斗
await page.evaluate(() => { window.__ll.run.jumpTo(3); });
await poseNear(page, 0, 170);
await shot(page, '05-battle-l3.png');

// 6) Boss 特写：英雄贴脸对峙 Boss（两者都在画面中心区）
await page.evaluate(() => {
  const r = window.__ll.run;
  const boss = r.enemies.find((e) => e.boss) || r.enemies[r.enemies.length - 1];
  r.player.x = Math.max(160, boss.x - 96);
  r.player.facing = 1;
  r.player.dashMeter = 0.6;
  r.levelIntroT = 40;
  r.step({});
});
await sleep(350);
await shot(page, '06-boss.png');

// 7) 掉落物（能量球 + 护盾核心）
await page.evaluate(() => {
  const r = window.__ll.run;
  const e = r.enemies[0];
  r.player.x = Math.max(160, e.x - 150);
  r.player.shield = true;
  r.levelIntroT = 40;
  r.orbs = [
    { x: e.x - 60, y: -52, type: 'energy', t: 0 },
    { x: e.x - 86, y: -72, type: 'shield', t: 0 },
  ];
  r.step({});
});
await sleep(300);
await shot(page, '07-orb-pickup.png');

await desktop.close();

// 8) 移动端
const { ctx: mobileCtx, page: mobilePage } = await newPage({ width: 844, height: 390 }, true);
await mobilePage.click('#btn-start');
await sleep(800);
await shot(mobilePage, '08-mobile.png');
await mobileCtx.close();

// 9) 标题屏（排在前 8 张之外，不影响 silhouette 均值）
const { ctx: titleCtx, page: titlePage } = await newPage({ width: 1280, height: 720 });
await titlePage.evaluate(() => window.__ll.restart());
await sleep(500);
await shot(titlePage, '09-title.png');
await titleCtx.close();

await browser.close();
server.close();
console.log('done → tests/final/');
