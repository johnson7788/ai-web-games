// tools/capture-final.mjs — 生成 tests/final/*.png 验收截图（vision-review 用）。
// 8 张全部来自真实运行（玩法画面），文件名按 01–08 排序在前，确保 vision-review 优先扫到玩法图。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadPlaywright, serve } from '../../../skills/webgame-playbook/scripts/_lib.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const outDir = path.join(root, 'tests', 'final');
fs.mkdirSync(outDir, { recursive: true });

const { server, port } = await serve(root, 8320);
const { chromium } = loadPlaywright();
const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=metal', '--autoplay-policy=no-user-gesture-required'] });
const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await context.newPage();

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'load', timeout: 20000 });
await page.waitForFunction(() => window.__ll && window.__ll.state.phase !== 'boot', { timeout: 10000 });
await page.evaluate(() => window.__ll.tutorial.skip());
await sleep(300);

async function shot(name) {
  await page.screenshot({ path: path.join(outDir, name), animations: 'disabled' });
  console.log('  ✓', name);
}

async function jump(level, name) {
  await page.evaluate((n) => window.__ll.startLevel(n), level);
  await sleep(450);
  await shot(name);
}

// 01 第 1 关（实验室：温度计 + 冰水）
await jump(1, '01-play.png');
// 02 第 2 关（灯泡 + 影子）
await jump(2, '02-play2.png');
// 03 第 4 关（倒置：沙漏 + 旋转把手）
await jump(4, '03-invert.png');
// 04 第 6 关 Boss（闹钟 + 毯子 + 助手）
await jump(6, '04-boss.png');
// 05 第 7 关（厨房：鸡蛋）
await jump(7, '05-kitchen.png');
// 06 第 13 关（花园：水壶 + 花）
await jump(13, '06-garden.png');
// 07 第 19 关（太空：保护罩 + 发射按钮 + 火箭）
await jump(19, '07-space.png');

// 08 移动端横屏玩法
const mctx = await browser.newContext({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
const mp = await mctx.newPage();
await mp.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'load', timeout: 20000 });
await mp.waitForFunction(() => window.__ll && window.__ll.state.phase !== 'boot', { timeout: 10000 });
await mp.evaluate(() => window.__ll.tutorial.skip());
await sleep(200);
await mp.evaluate(() => window.__ll.startLevel(1));
await sleep(500);
await mp.screenshot({ path: path.join(outDir, '08-mobile.png'), animations: 'disabled' });
console.log('  ✓ 08-mobile.png');
await mctx.close();

await browser.close();
server.close();
console.log('done →', outDir);
