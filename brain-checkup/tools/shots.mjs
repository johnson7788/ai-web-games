// BRAIN CHECKUP · 生成 tests/final/*.png 供 vision-review 评审 + poster.jpg（1280×720）。
// 运行：node tools/shots.mjs
// 只写 games/brain-checkup/ 内部；服务用完即关。
import { loadPlaywright, serve } from '../../../skills/webgame-playbook/scripts/_lib.mjs';
import { mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const FINAL = join(ROOT, 'tests', 'final');
mkdirSync(FINAL, { recursive: true });

const { server, port } = await serve(resolve(ROOT), 8260);
const base = `http://127.0.0.1:${port}/`;
const { chromium } = loadPlaywright();
const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=metal', '--autoplay-policy=no-user-gesture-required'] });

async function freshPage(viewport) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  await page.goto(base, { waitUntil: 'load', timeout: 20000 });
  await page.waitForFunction(() => typeof window.__ll !== 'undefined', { timeout: 15000 });
  // 关闭教程，避免遮挡截图
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem('brain-checkup:tutorialDone', 'true'); });
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => typeof window.__ll !== 'undefined', { timeout: 15000 });
  await page.waitForTimeout(600);
  return { page, context };
}

const shot = (page, name) => page.screenshot({ path: join(FINAL, name) });

// 桌面：游戏画面优先（vision-review 按文件名排序取前 8）
{
  const { page, context } = await freshPage({ width: 1280, height: 720 });
  await page.evaluate(() => window.__ll.start(0));
  await page.waitForTimeout(800);
  await shot(page, '01-play.png');

  await page.evaluate(() => window.__ll.debug.autoSolve());
  await page.waitForTimeout(500);
  await shot(page, '02-play-result.png');

  await page.evaluate(() => window.__ll.debug.loadLevel(1));
  await page.waitForTimeout(800);
  await shot(page, '03-play-hold.png');

  await page.evaluate(() => window.__ll.debug.loadLevel(2));
  await page.waitForTimeout(800);
  await shot(page, '04-play-choice.png');

  await page.evaluate(() => window.__ll.home());
  await page.waitForTimeout(500);
  await shot(page, '05-title.png');
  await page.screenshot({ path: join(ROOT, 'poster.jpg'), type: 'jpeg', quality: 92 });
  await context.close();
}

// 移动端
{
  const { page, context } = await freshPage({ width: 844, height: 390 });
  await page.evaluate(() => window.__ll.start(0));
  await page.waitForTimeout(800);
  await shot(page, '06-mobile.png');
  await context.close();
}

await browser.close();
server.close();
console.log('✓ wrote tests/final screenshots + poster.jpg');
