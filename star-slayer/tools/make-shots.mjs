// tools/make-shots.mjs — 生成 tests/final 验收截图（战斗/Boss/超载决策/移动端）
// 用真实浏览器驱动 __ll 调试口，手动摆出干净、居中、不压 HUD 的战斗构图，
// 供 vision-review 评审（截图必须是真实渲染，不是设计稿）。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadPlaywright, serve, waitForBoot } from '../../../skills/webgame-playbook/scripts/_lib.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const outDir = path.join(root, 'tests', 'final');
fs.mkdirSync(outDir, { recursive: true });

const { server, port } = await serve(root, 8410);
const { chromium } = loadPlaywright();
const browser = await chromium.launch({
  headless: true,
  args: ['--use-gl=angle', '--use-angle=metal', '--autoplay-policy=no-user-gesture-required'],
});
const baseUrl = `http://127.0.0.1:${port}/`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function shot(page, name) {
  await page.screenshot({ path: path.join(outDir, name), timeout: 15000 });
  console.log('shot:', name);
}

// 在页面里摆一个干净战斗构图：玩家居中，敌人在四周，避开顶部 HUD 与角落
const PLACE_BATTLE = `
(() => {
  const r = window.__ll.run;
  const raider = (id, x, y, hp, maxHp) => ({
    id, type: 'raider', x, y, r: 14, hp, maxHp, speed: 0, touchDmg: 15,
    color: '#ff5d73', score: 10, dashCd: 99, dashT: 0, dashDirx: 0, dashDiry: 0, fireCd: 99, spawnT: 0,
  });
  r.spawnQueue = [];
  r.enemies = [];
  r.player.x = 640; r.player.y = 420; r.player.aim = -Math.PI / 2;
  r.core.x = 640; r.core.y = 500; r.core.online = true;
  r.enemies.push(raider(1, 520, 300, 30, 30));
  r.enemies.push(raider(2, 780, 330, 30, 30));
  r.enemies.push(raider(3, 520, 560, 22, 30));
  r.enemies.push(raider(4, 800, 560, 30, 30));
  return true;
})()
`;

async function openPage(ctx, mobile) {
  const page = await ctx.newPage();
  await page.goto(baseUrl, { waitUntil: 'load', timeout: 20000 });
  await waitForBoot(page, 10000);
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'load' });
  await waitForBoot(page, 10000);
  await page.click('#btn-start');
  await sleep(700);
  await page.click('[data-tutorial-skip]');
  await sleep(250);
  return page;
}

async function desktop() {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await openPage(ctx, false);

  // 1) 普通战斗
  await page.evaluate(PLACE_BATTLE);
  await sleep(450);
  await shot(page, '01-play.png');

  // 2) Boss 战（清空前两波 → 选卡推进 → 摆中央 Boss）
  await page.evaluate(() => {
    const r = window.__ll.run;
    for (let w = 1; w < 3; w += 1) {
      r.spawnQueue = [];
      r.enemies = [];
      r.step({});
      r.chooseCard(0);
    }
    const raider = (id, x, y) => ({
      id, type: 'raider', x, y, r: 14, hp: 30, maxHp: 30, speed: 0, touchDmg: 15,
      color: '#ff5d73', score: 10, dashCd: 99, dashT: 0, dashDirx: 0, dashDiry: 0, fireCd: 99, spawnT: 0,
    });
    r.spawnQueue = [];
    r.enemies = [];
    r.enemies.push({
      id: 99001, type: 'boss', x: 640, y: 380, r: 46, hp: 1600, maxHp: 2800, speed: 0, touchDmg: 25,
      color: '#ff3d5a', score: 500, dashCd: 99, dashT: 0, dashDirx: 0, dashDiry: 0, fireCd: 99, spawnT: 0,
    });
    r.enemies.push(raider(99002, 430, 560));
    r.enemies.push(raider(99003, 850, 570));
    r.player.x = 640; r.player.y = 520;
    r.core.x = 640; r.core.y = 600;
  });
  await sleep(500);
  await shot(page, '02-boss.png');

  // 3) 超载决策时刻（血量 <30% + 光核在线 + 敌人仍在场）
  await page.evaluate(() => {
    const r = window.__ll.run;
    r.player.hp = Math.floor(r.player.maxHp * 0.22);
    r.player.armor = 0;
    r.core.online = true;
    r.player.x = 640; r.player.y = 420;
  });
  await sleep(450);
  await shot(page, '03-overload-ready.png');
  await ctx.close();
}

async function mobile() {
  const ctx = await browser.newContext({
    viewport: { width: 844, height: 390 },
    deviceScaleFactor: 1,
    isMobile: true,
    hasTouch: true,
  });
  const page = await openPage(ctx, true);
  await page.evaluate(PLACE_BATTLE);
  await sleep(450);
  await shot(page, '04-mobile.png');
  await ctx.close();
}

try {
  await desktop();
  await mobile();
} finally {
  await browser.close();
  server.close();
}
console.log('done →', outDir);
