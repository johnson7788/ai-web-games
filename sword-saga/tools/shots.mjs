// tools/shots.mjs — 生成验收/视觉评审截图到 tests/final/（真实浏览器驱动，非设计稿）。
// 用真实 UI 点击 + __ll 调试口把游戏推到指定状态后截图。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadPlaywright, serve } from '../../../skills/webgame-playbook/scripts/_lib.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'tests', 'final');
fs.mkdirSync(OUT, { recursive: true });

const { server, port } = await serve(ROOT, 8420);
const baseUrl = `http://127.0.0.1:${port}/`;
const { chromium } = loadPlaywright();

const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=metal', '--autoplay-policy=no-user-gesture-required'] });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function shot(page, name) {
  await page.screenshot({ path: path.join(OUT, name), animations: 'disabled' });
  console.log('·', name);
}

async function evalJs(page, js) {
  return page.evaluate(js);
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

// 进入游戏并跳过引导
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

const { ctx: desktop, page } = await newPage({ width: 1280, height: 720 });

// 1) 地图（青竹林）
await startPlaying(page);
await shot(page, '01-map-bamboo.png');

// 2) 对话
await evalJs(page, `(()=>{const r=window.__ll.run; r.map.px=10; r.map.py=7; r.step({}); return r.mode;})()`);
await sleep(300);
await shot(page, '02-dialog.png');

// 3) 战斗（轮到剑客）
await evalJs(page, `(()=>{const r=window.__ll.run; let g=0; while(r.mode==='dialog' && g<40){r.step({advance:true}); r.drainEvents(); g++;} r.map.px=20; r.map.py=7; r.step({}); return r.mode;})()`);
await sleep(500);
await shot(page, '03-battle.png');

// 4) 目标选择（战斗菜单显示敌人目标，目标清晰可见）
await evalJs(page, `(()=>{const r=window.__ll.run; if(r.mode==='battle'){ r.battle.pending='hero'; } return true;})()`);
await sleep(400);
await page.click('[data-action="attack"]');
await sleep(300);
await shot(page, '04-target-select.png');

// 5) Boss 战（第 4 章竹王）
await evalJs(page, `(()=>{const r=window.__ll.run; r.jumpTo(4); r.map.openingDone=true; r.map.px=20; r.map.py=7; r.step({}); return r.mode;})()`);
await sleep(1800);
await shot(page, '05-boss.png');

// 6) 雪山道（第 5 章地图）
await evalJs(page, `(()=>{const r=window.__ll.run; r.jumpTo(5); return r.scene;})()`);
await sleep(500);
await shot(page, '06-snow.png');

// 7) 锁妖塔（第 9 章地图）
await evalJs(page, `(()=>{const r=window.__ll.run; r.jumpTo(9); return r.scene;})()`);
await sleep(500);
await shot(page, '07-tower.png');

await desktop.close();

// 8) 移动端
const { ctx: mobileCtx, page: mobilePage } = await newPage({ width: 844, height: 390 }, true);
await mobilePage.click('#btn-start');
await sleep(800);
await shot(mobilePage, '08-mobile.png');
await mobileCtx.close();

await browser.close();
server.close();
console.log('done → tests/final/');
