// tools/poster.mjs — 截取最好看的战斗画面生成 poster.jpg（1280×720）
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serve, loadPlaywright, waitForBoot } from '../../../skills/webgame-playbook/scripts/_lib.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const OUT = path.join(ROOT, 'poster.jpg');

const { server, port } = await serve(ROOT, 8220);
const { chromium } = loadPlaywright();
const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=metal', '--autoplay-policy=no-user-gesture-required'] });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const base = `http://127.0.0.1:${port}/`;

try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage();
  await page.goto(base, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await waitForBoot(page, 10000);
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'domcontentloaded' });
  await waitForBoot(page, 10000);
  await page.waitForTimeout(500);

  await page.click('#btn-start');
  await page.waitForTimeout(700);
  const skip = page.locator('[data-tutorial-skip]').first();
  if (await skip.count()) await skip.click({ force: true }).catch(() => {});
  await page.waitForTimeout(400);

  // Boss 关：全机制 + 引爆双核心制造高潮画面
  await page.evaluate(() => window.__ll.run.loadLevel(12));
  await page.waitForTimeout(500);
  await page.evaluate(() => {
    const r = window.__ll.run;
    r.bolts.push({ id: 900001, x: 200, y: 140, vx: 400, vy: 0, life: 1 });
  });
  await page.waitForTimeout(450);
  await page.screenshot({ path: OUT, type: 'jpeg', quality: 90, fullPage: false });
  console.log('poster.jpg written:', OUT);
  await ctx.close();
} finally {
  await browser.close();
  server.close();
}
