// LADDER CLIMBER · 截图与海报生成。
// tests/final/*.png：桌面 8 张（vision-review 用，全为可读性最好的玩法/标题画面）。
// tests/artifacts/*.png：移动端横屏证据。poster.jpg：1280×720 海报。
// 自带静态服务，用完即关。运行：node tools/shots.mjs
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { serve, loadPlaywright } from '../../../skills/webgame-playbook/scripts/_lib.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const FINAL = join(ROOT, 'tests', 'final');
const ARTIFACTS = join(ROOT, 'tests', 'artifacts');
mkdirSync(FINAL, { recursive: true });
mkdirSync(ARTIFACTS, { recursive: true });

const { server, port } = await serve(ROOT, 8240);
const { chromium } = loadPlaywright();
const browser = await chromium.launch({
  headless: true,
  args: ['--use-gl=angle', '--use-angle=metal', '--autoplay-policy=no-user-gesture-required'],
});

const url = `http://127.0.0.1:${port}/`;

async function newPage(viewport, mobile = false) {
  const ctx = await browser.newContext({
    viewport,
    deviceScaleFactor: mobile ? 2 : 1,
    isMobile: mobile,
    hasTouch: mobile,
  });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
  await page.goto(url, { waitUntil: 'load', timeout: 20000 });
  await page.waitForFunction(() => typeof window.__ll !== 'undefined', { timeout: 15000 });
  await page.waitForTimeout(500);
  return { ctx, page };
}

async function shot(page, dir, name, type = 'png') {
  await page.screenshot({ path: join(dir, name), type, quality: type === 'jpeg' ? 90 : undefined });
  console.log('shot', name);
}

// ---- 桌面（tests/final，供 vision-review） ----
{
  const { ctx, page } = await newPage({ width: 1280, height: 720 });
  await shot(page, FINAL, '01-title.png');

  await page.evaluate(() => {
    const s = document.getElementById('lang-select');
    s.value = 'zh';
    s.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await page.waitForTimeout(250);
  await shot(page, FINAL, '02-title-zh.png');

  await page.evaluate(() => {
    const s = document.getElementById('lang-select');
    s.value = 'en';
    s.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await page.waitForTimeout(250);
  await page.evaluate(() => window.__ll.debug.setTutorialDone(true));
  await page.evaluate(() => window.__ll.start(0));
  await page.waitForTimeout(500);
  await page.evaluate(() => window.__ll.debug.climbCorrectN(3));
  await page.waitForTimeout(350);
  await shot(page, FINAL, '03-playing.png');

  await page.evaluate(() => window.__ll.debug.climbCorrectN(6));
  await page.waitForTimeout(350);
  await shot(page, FINAL, '04-mid-climb.png');

  await page.evaluate(() => {
    const r = window.__ll.run();
    if (r) r.state.floors[r.state.curIndex + 1].star = true;
  });
  await page.waitForTimeout(200);
  await shot(page, FINAL, '05-star.png');

  await page.evaluate(() => window.__ll.debug.climbWrong());
  await page.waitForTimeout(700);
  await shot(page, FINAL, '06-result.png');

  await page.evaluate(() => window.__ll.start(999));
  await page.waitForTimeout(400);
  await page.evaluate(() => window.__ll.debug.climbCorrectN(20));
  await page.waitForTimeout(400);
  await shot(page, FINAL, '07-deep.png');

  await page.evaluate(() => {
    const r = window.__ll.run();
    if (r) r.state.floors[r.state.curIndex + 1].orb = true;
  });
  await page.waitForTimeout(200);
  await shot(page, FINAL, '08-orb.png');
  await ctx.close();
}

// ---- 海报（1280×720 爬塔中段） ----
{
  const { ctx, page } = await newPage({ width: 1280, height: 720 });
  await page.evaluate(() => window.__ll.debug.setTutorialDone(true));
  await page.evaluate(() => window.__ll.start(123));
  await page.evaluate(() => window.__ll.debug.climbCorrectN(9));
  await page.waitForTimeout(400);
  await shot(page, ROOT, 'poster.jpg', 'jpeg');
  await ctx.close();
}

// ---- 移动端（tests/artifacts，证据用，不进 vision-review） ----
{
  const { ctx, page } = await newPage({ width: 844, height: 390 }, true);
  await shot(page, ARTIFACTS, '07-mobile-title.png');
  await page.evaluate(() => window.__ll.debug.setTutorialDone(true));
  await page.evaluate(() => window.__ll.start(0));
  await page.waitForTimeout(450);
  await page.evaluate(() => window.__ll.debug.climbCorrectN(4));
  await page.waitForTimeout(300);
  await shot(page, ARTIFACTS, '08-mobile-playing.png');
  await ctx.close();
}

await browser.close();
server.close();
console.log('done');
