// 生成 poster.jpg（1280×720，截取游戏战斗画面）。
// 运行：node tools/poster.mjs
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadPlaywright, serve } from '../../../skills/webgame-playbook/scripts/_lib.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'poster.jpg');
const { server, port } = await serve(ROOT, 8210);
const { chromium } = loadPlaywright();
const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=metal'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'load', timeout: 20000 });
await page.waitForFunction(() => typeof window.__ll !== 'undefined', { timeout: 15000 });
await page.evaluate(() => window.__ll.start());
await page.waitForTimeout(400);
await page.evaluate(() => {
  const el = document.querySelector('[data-tutorial-skip]');
  if (el && !el.closest('#tutorial').classList.contains('hidden')) el.click();
  window.__ll.debug.stageDemo();
});
await page.waitForTimeout(1800);
await page.screenshot({ path: OUT, type: 'jpeg', quality: 90 });
console.log(`wrote ${OUT}`);
await browser.close();
server.close();
