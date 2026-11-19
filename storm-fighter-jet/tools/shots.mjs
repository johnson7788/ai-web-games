// 截图脚本：产出 tests/final/*.png（供 vision-review）与根目录 poster.jpg。
// 只用于本地验收；自带服务，用完即关（端口 8240 起自增）。
// 运行：node tools/shots.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadPlaywright, serve } from '../../../skills/webgame-playbook/scripts/_lib.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const FINAL = path.join(ROOT, 'tests', 'final');
fs.mkdirSync(FINAL, { recursive: true });

const { chromium } = loadPlaywright();
const serverResult = await serve(ROOT, 8240);
const server = serverResult.server;
const port = serverResult.port;
const url = `http://127.0.0.1:${port}/`;

const browser = await chromium.launch({
  headless: true,
  args: ['--use-gl=angle', '--use-angle=metal', '--autoplay-policy=no-user-gesture-required'],
});

async function shot(name, page) {
  const file = path.join(FINAL, name);
  await page.screenshot({ path: file });
  console.log('✓', name);
}

try {
  // 桌面
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage();
  await page.goto(url, { waitUntil: 'load', timeout: 20000 });
  await page.waitForFunction(() => typeof window.__ll !== 'undefined', { timeout: 15000 });
  await page.waitForTimeout(700);

  // 06-title
  await shot('06-title.png', page);

  // 开始 + 跳过教程
  await page.evaluate(() => window.__ll.start());
  await page.waitForTimeout(400);
  await page.evaluate(() => window.__ll.tutorial.skip());
  await page.waitForTimeout(500);

  // 01-playing（自然玩法：飞机 + 导弹 + 金币）
  await page.waitForTimeout(1900);
  await page.evaluate(() => window.__ll.debug.spawnCoins(6));
  await page.waitForTimeout(200);
  await shot('01-playing.png', page);

  // 02-coins（金币群）
  await page.evaluate(() => window.__ll.debug.spawnCoins(12));
  await page.waitForTimeout(250);
  await shot('02-coins.png', page);

  // 03-rocks（第 3 波岩石）
  await page.evaluate(() => { window.__ll.debug.setLevel(3); window.__ll.debug.spawnRock(); window.__ll.debug.spawnRock(); window.__ll.debug.spawnRock(); });
  await page.waitForTimeout(350);
  await shot('03-rocks.png', page);

  // 04-shield（护盾道具）
  await page.evaluate(() => { const s = window.__ll.sim(); if (s) s.shields.push({ x: 640, y: 300, vx: 0, vy: 0 }); });
  await page.waitForTimeout(200);
  await shot('04-shield.png', page);

  // 05-result（结算）
  await page.evaluate(() => window.__ll.debug.die());
  await page.waitForTimeout(500);
  await shot('05-result.png', page);

  await page.evaluate(() => window.__ll.home());
  await page.waitForTimeout(300);

  // 07-title-zh
  await page.evaluate(() => { const s = document.getElementById('lang-select'); s.value = 'zh'; s.dispatchEvent(new Event('change', { bubbles: true })); });
  await page.waitForTimeout(250);
  await shot('07-title-zh.png', page);

  // 海报：漂亮战斗画面
  await page.evaluate(() => { const s = document.getElementById('lang-select'); s.value = 'en'; s.dispatchEvent(new Event('change', { bubbles: true })); });
  await page.waitForTimeout(200);
  await page.evaluate(() => window.__ll.start());
  await page.waitForTimeout(400);
  await page.evaluate(() => window.__ll.tutorial.skip());
  await page.waitForTimeout(1800);
  await page.evaluate(() => window.__ll.debug.spawnCoins(8));
  await page.waitForTimeout(250);
  await page.screenshot({ path: path.join(ROOT, 'poster.jpg'), type: 'jpeg', quality: 92 });
  console.log('✓ poster.jpg');

  await ctx.close();
} catch (err) {
  console.error('shots.mjs crashed:', err);
} finally {
  await browser.close();
  server.close();
}
console.log('done →', FINAL);
