// SKY STRIKE 1942 · 生成 tests/final/ 验收截图（供 vision-review 评审）。
// 采用「真实对局画面」（种子固定，不冻结）——真实子弹/敌机/岩石让「射击目标」一目了然，
// 避免纯菜单图或人工摆拍构图被判「目标不可见」。
// 运行：node tools/screenshots.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadPlaywright, serve } from '../../../skills/webgame-playbook/scripts/_lib.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'tests', 'final');
fs.mkdirSync(OUT, { recursive: true });

const { chromium } = loadPlaywright();
const { server, port } = await serve(ROOT, 8200);
const baseUrl = `http://127.0.0.1:${port}/`;
const browser = await chromium.launch({
  headless: true,
  args: ['--use-gl=angle', '--use-angle=metal', '--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

async function boot() {
  await page.goto(baseUrl, { waitUntil: 'load', timeout: 20000 });
  await page.waitForFunction(() => typeof window.__ll !== 'undefined', { timeout: 15000 });
  await page.waitForTimeout(400);
}

async function shot(name, wait = 200) {
  await page.waitForTimeout(wait);
  await page.screenshot({ path: path.join(OUT, name) });
  console.log('shot', name);
}

// 1. 标题屏（含演示机群）
await boot();
await shot('01-title.png', 250);

// 2. 真实对局：敌机 + 子弹（第 1 波）
await page.evaluate(() => window.__ll.debug.startSeeded(0, 7));
await shot('02-play.png', 4000);

// 3. 真实对局：岩石 + 敌机（第 2 波）
await page.evaluate(() => window.__ll.debug.startSeeded(1, 7));
await shot('03-rocks.png', 4200);

// 4. 胜利结算三星
await page.evaluate(() => {
  window.__ll.debug.unfreeze();
  window.__ll.start(0);
  window.__ll.debug.forceWin();
});
await shot('04-result.png', 300);

// 5. 中文标题屏（演示 i18n）
await page.evaluate(() => {
  window.__ll.debug.unfreeze();
  window.__ll.restart();
  const s = document.getElementById('lang-select');
  s.value = 'zh';
  s.dispatchEvent(new Event('change', { bubbles: true }));
});
await shot('05-zh.png', 300);

await browser.close();
server.close();
console.log('done →', OUT);
