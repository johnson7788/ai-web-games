// tools/finalshots.mjs — 生成 tests/final/*.png（供 vision-review 评审）。
// 真实运行抓图：大厅 / 三台机台 / GRAND PRIX 亮灯 / 移动端。
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { loadPlaywright, serve } from '../../../skills/webgame-playbook/scripts/_lib.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const outDir = join(root, 'tests', 'final');
mkdirSync(outDir, { recursive: true });

const { server, port } = await serve(root, 8210);
const { chromium } = loadPlaywright();
const browser = await chromium.launch({
  headless: true,
  args: ['--use-gl=angle', '--use-angle=metal', '--autoplay-policy=no-user-gesture-required'],
});

async function freshPage(viewport) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1, isMobile: viewport[0] < 900, hasTouch: viewport[0] < 900 });
  const page = await ctx.newPage();
  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'load', timeout: 20000 });
  await page.waitForFunction(() => window.__ll && window.__ll.state.phase !== 'boot', { timeout: 10000 });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => window.__ll && window.__ll.state.phase !== 'boot', { timeout: 10000 });
  await page.waitForTimeout(600);
  return { ctx, page };
}

async function skipTutorial(page) {
  const skip = page.locator('[data-tutorial-skip]').first();
  if (await skip.count() && await skip.isVisible()) await skip.click({ force: true });
  await page.waitForTimeout(300);
}

async function ffwdToResult(page) {
  await page.evaluate(() => {
    const r = window.__ll.run;
    for (let k = 0; k < 60 * 60 && r.phase === 'playing'; k += 1) { r.step({}); r.drainEvents(); }
    return r.phase;
  });
  await page.waitForTimeout(500);
  const cont = page.locator('#btn-continue').first();
  if (await cont.count() && await cont.isVisible()) await cont.click({ force: true });
  await page.waitForTimeout(500);
}

const { page } = await freshPage({ width: 1280, height: 720 });

// 大厅
await page.click('#btn-start');
await page.waitForTimeout(700);
await skipTutorial(page);
await page.screenshot({ path: join(outDir, '01-hall.png') });

// 机房守夜
await page.click('#cab-0');
await page.waitForTimeout(2200);
await page.screenshot({ path: join(outDir, '02-mole.png') });
await ffwdToResult(page);

// 雨中拾荒
await page.click('#cab-1');
await page.waitForTimeout(2200);
await page.screenshot({ path: join(outDir, '03-rain.png') });
await ffwdToResult(page);

// 像素蜂群
await page.click('#cab-2');
await page.waitForTimeout(2200);
await page.screenshot({ path: join(outDir, '04-swarm.png') });

// GRAND PRIX 亮灯（签名瞬间：大厅 + 招牌点亮）
await page.evaluate(() => window.__ll.restart());
await page.waitForTimeout(400);
await page.click('#btn-start');
await page.waitForTimeout(700);
await skipTutorial(page);
await page.evaluate(() => { window.__ll.run.signLit = true; });
await page.waitForTimeout(300);
await page.screenshot({ path: join(outDir, '05-grandprix.png') });

// 移动端（雨中拾荒）
const m = await freshPage({ width: 844, height: 390 });
await m.page.click('#btn-start');
await m.page.waitForTimeout(800);
await skipTutorial(m.page);
await m.page.click('#cab-1');
await m.page.waitForTimeout(2200);
await m.page.screenshot({ path: join(outDir, '06-mobile.png') });
await m.ctx.close();

await browser.close();
server.close();
console.log('finalshots written to tests/final');
