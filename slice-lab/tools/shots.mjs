// SLICE LAB · 截图脚本：产出 tests/final/*.png（供 vision-review）与 poster.jpg（1280×720）。
// 自带静态服务，用完即关。运行：node tools/shots.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadPlaywright, serve, waitForBoot } from '../../../skills/webgame-playbook/scripts/_lib.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'tests', 'final');
fs.mkdirSync(OUT, { recursive: true });

const { server, port } = await serve(ROOT, 8200);
const url = `http://127.0.0.1:${port}/`;
const { chromium } = loadPlaywright();
const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=metal', '--autoplay-policy=no-user-gesture-required'] });

async function desktopPage() {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage();
  await page.goto(url, { waitUntil: 'load', timeout: 20000 });
  await waitForBoot(page, 10000);
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'domcontentloaded' });
  await waitForBoot(page, 10000);
  await page.waitForTimeout(400);
  return { ctx, page };
}

async function shot(page, name, { jpeg = false } = {}) {
  const file = path.join(OUT, name);
  const opts = { path: file, type: jpeg ? 'jpeg' : 'png' };
  if (jpeg) opts.quality = 92;
  await page.screenshot(opts);
  console.log('✓', path.relative(ROOT, file));
}

const d = await desktopPage();
const { page } = d;

// 1. 标题屏
await shot(page, '01-title.png');
await page.screenshot({ path: path.join(ROOT, 'poster.jpg'), type: 'jpeg', quality: 92 });
await page.screenshot({ path: path.join(OUT, 'poster.jpg'), type: 'jpeg', quality: 92 });
console.log('✓ poster.jpg');

// 关闭教程，进入第 1 关
await page.evaluate(() => window.__ll.debug.setTutorialDone(true));
await page.evaluate(() => window.__ll.start(0));
await page.waitForTimeout(600);
await shot(page, '02-playing.png');

// 3. 切割瞬间（等分线切开后，两半正在分离）
await page.evaluate(() => window.__ll.debug.startSeeded(0, 3));
await page.waitForTimeout(200);
await page.evaluate(() => window.__ll.debug.autoSlice());
await page.waitForTimeout(360);
await shot(page, '03-split.png');

// 4. 结算屏
await page.evaluate(() => window.__ll.debug.fastForward());
await page.waitForTimeout(400);
await shot(page, '04-result.png');

// 5. 岩核关（L3）
await page.evaluate(() => window.__ll.debug.loadLevel(2));
await page.waitForTimeout(500);
await shot(page, '05-rock.png');

// 6. 旋转水晶关（L10）
await page.evaluate(() => window.__ll.debug.loadLevel(9));
await page.waitForTimeout(700);
await shot(page, '06-spin.png');

await d.ctx.close();

// 7. 移动端（横屏触屏）
const mctx = await browser.newContext({
  viewport: { width: 844, height: 390 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
});
const mpage = await mctx.newPage();
await mpage.goto(url, { waitUntil: 'load', timeout: 20000 });
await waitForBoot(mpage, 10000);
await mpage.evaluate(() => localStorage.clear());
await mpage.reload({ waitUntil: 'domcontentloaded' });
await waitForBoot(mpage, 10000);
await mpage.evaluate(() => window.__ll.debug.setTutorialDone(true));
await mpage.evaluate(() => window.__ll.start(0));
await mpage.waitForTimeout(600);
await shot(mpage, '07-mobile.png');
await mctx.close();

await browser.close();
server.close();
console.log('done');
