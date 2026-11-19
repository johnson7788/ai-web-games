// 场景截图：产出 tests/final/01..08 供 vision-review 评审，并产出 poster.jpg（1280×720）。
// 用法：node tools/scene-shots.mjs（自带服务，用完即关）
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadPlaywright, serve, createErrorCollector } from '../../../skills/webgame-playbook/scripts/_lib.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'tests', 'final');
fs.mkdirSync(OUT, { recursive: true });

const SOLUTIONS = [
  [{ x: 200, y: 470 }, { x: 1085, y: 470 }],
  [{ x: 200, y: 470 }, { x: 520, y: 250 }, { x: 760, y: 250 }, { x: 1085, y: 470 }],
  [{ x: 200, y: 470 }, { x: 350, y: 260 }, { x: 560, y: 260 }, { x: 700, y: 540 }, { x: 860, y: 540 }, { x: 1085, y: 470 }],
];

const { server, port } = await serve(ROOT, 8220);
const { chromium } = loadPlaywright();
const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=metal'] });

async function shot(page, name) {
  const file = path.join(OUT, name);
  await page.screenshot({ path: file });
  console.log(`✓ ${name}`);
}

async function boot(page) {
  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'load', timeout: 20000 });
  await page.waitForFunction(() => typeof window.__ll !== 'undefined', { timeout: 15000 });
  await page.waitForTimeout(500);
}

try {
  // ---- 桌面 1280×720 ----
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage();
  const collector = createErrorCollector();
  collector.attach(page, port);

  await boot(page);
  await shot(page, '01-title.png');

  await page.evaluate(() => window.__ll.debug.setTutorialDone(true));
  await page.evaluate(() => window.__ll.start(0));
  await page.waitForTimeout(700);
  await shot(page, '02-playing.png');

  // 发车途中
  await page.evaluate(() => window.__ll.debug.autoSolve());
  await page.waitForTimeout(1200);
  await shot(page, '03-driving.png');

  // 结算
  await page.waitForTimeout(2600);
  await page.evaluate(() => window.__ll.state.phase);
  await shot(page, '04-result.png');

  // L2 火花束（画好路线，卡车待发）
  await page.evaluate(() => window.__ll.debug.loadLevel(1));
  await page.waitForTimeout(300);
  await page.evaluate((pts) => window.__ll.debug.drawPath(pts), SOLUTIONS[1]);
  await page.waitForTimeout(500);
  await shot(page, '05-beam.png');

  // L3 双核心 + 双火花束
  await page.evaluate(() => window.__ll.debug.loadLevel(2));
  await page.waitForTimeout(300);
  await page.evaluate((pts) => window.__ll.debug.drawPath(pts), SOLUTIONS[2]);
  await page.waitForTimeout(500);
  await shot(page, '06-core.png');

  // poster：L3 发车途中（最好看的一帧）
  await page.evaluate(() => window.__ll.debug.loadLevel(2));
  await page.waitForTimeout(300);
  await page.evaluate(() => window.__ll.debug.autoSolve());
  await page.waitForTimeout(1500);
  await page.screenshot({ path: path.join(ROOT, 'poster.jpg'), type: 'jpeg', quality: 88 });
  console.log('✓ poster.jpg');

  await ctx.close();

  // ---- 移动端 844×390（横屏触屏） ----
  const mctx = await browser.newContext({
    viewport: { width: 844, height: 390 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  const mpage = await mctx.newPage();
  await boot(mpage);
  await mpage.evaluate(() => window.__ll.debug.setTutorialDone(true));
  await mpage.evaluate(() => window.__ll.start(0));
  await mpage.waitForTimeout(700);
  await shot(mpage, '07-mobile-playing.png');

  await mpage.evaluate(() => window.__ll.debug.loadLevel(2));
  await mpage.waitForTimeout(300);
  await mpage.evaluate((pts) => window.__ll.debug.drawPath(pts), SOLUTIONS[2]);
  await mpage.waitForTimeout(500);
  await shot(mpage, '08-mobile-core.png');

  await mctx.close();
} finally {
  await browser.close();
  server.close();
}
console.log('done');
