// 生成 poster.jpg（1280×720）：狂暴鱼群 + 红鲨 + 暗礁 + 金币 + 星，最出片的一帧。
// 运行：node tools/make-poster.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadPlaywright, serve, waitForBoot } from '../../../skills/webgame-playbook/scripts/_lib.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'poster.jpg');

const { server, port } = await serve(ROOT, 8210);
const { chromium } = loadPlaywright();
const browser = await chromium.launch({
  headless: true,
  args: ['--use-gl=angle', '--use-angle=metal', '--autoplay-policy=no-user-gesture-required'],
});
const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await context.newPage();
await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'domcontentloaded', timeout: 30000 });
await waitForBoot(page, 10000);
await page.evaluate(() => {
  window.__ll.debug.setTutorialDone(true);
  window.__ll.debug.startSeeded(11);
  window.__ll.debug.triggerFrenzy();
  window.__ll.debug.grow(7);
  window.__ll.debug.spawnPreyAt(150, -70);
  window.__ll.debug.spawnPreyAt(-160, 60);
  window.__ll.debug.spawnPredatorAt(170, -40, 26);
  window.__ll.debug.spawnPredatorAt(-190, 120, 30);
  window.__ll.debug.spawnRockAt(-280, -150, 32);
  window.__ll.debug.spawnRockAt(260, 170, 34);
  window.__ll.debug.spawnStarAt(-90, 160);
});
await page.waitForTimeout(160);
await page.screenshot({ path: OUT, type: 'jpeg', quality: 90 });
await browser.close();
server.close();
console.log('poster →', OUT);
