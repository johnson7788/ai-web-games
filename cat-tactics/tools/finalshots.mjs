// CAT TACTICS · 生成 tests/final/ 视觉评审截图（数字前缀，供 vision-review 取前 8 张）+ poster.jpg
// 运行：node tools/finalshots.mjs
import { mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadPlaywright, serve } from '../../../skills/webgame-playbook/scripts/_lib.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'tests', 'final');
mkdirSync(OUT, { recursive: true });

const { chromium } = loadPlaywright();
const { server, port } = await serve(ROOT, 8200);
const url = `http://127.0.0.1:${port}/`;

const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=metal', '--autoplay-policy=no-user-gesture-required'] });

async function newPage(viewport, mobile = false) {
  const ctx = await browser.newContext({
    viewport: { width: viewport[0], height: viewport[1] },
    deviceScaleFactor: mobile ? 2 : 1,
    isMobile: mobile,
    hasTouch: mobile,
  });
  const page = await ctx.newPage();
  await page.goto(url, { waitUntil: 'load', timeout: 20000 });
  await page.waitForFunction(() => typeof window.__ll !== 'undefined', { timeout: 15000 });
  await page.waitForFunction(() => window.__ll.state?.phase !== 'boot', { timeout: 10000 }).catch(() => {});
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'load' });
  await page.waitForFunction(() => typeof window.__ll !== 'undefined', { timeout: 15000 });
  await page.waitForTimeout(400);
  return { ctx, page };
}

async function shot(page, name) {
  await page.waitForTimeout(420);
  await page.screenshot({ path: join(OUT, name) });
  console.log('shot', name);
}

// 1) 标题（同时用作 poster.jpg）
{
  const { ctx, page } = await newPage([1280, 720]);
  await shot(page, '01-title.png');
  await page.screenshot({ path: join(ROOT, 'poster.jpg'), type: 'jpeg', quality: 90 });
  await ctx.close();
}

// 2) 初始对局
{
  const { ctx, page } = await newPage([1280, 720]);
  await page.evaluate(() => { window.__ll.start(); window.__ll.tutorial.skip(); });
  await shot(page, '02-playing.png');
  await ctx.close();
}

// 3) 招募了几只猫（车位有猫）
{
  const { ctx, page } = await newPage([1280, 720]);
  await page.evaluate(() => {
    window.__ll.start(); window.__ll.tutorial.skip();
    for (let i = 0; i < 5; i += 1) window.__ll.debug.buy();
  });
  await shot(page, '03-recruit.png');
  await ctx.close();
}

// 4) 猫上赛道巡逻
{
  const { ctx, page } = await newPage([1280, 720]);
  await page.evaluate(() => {
    window.__ll.start(); window.__ll.tutorial.skip();
    for (let i = 0; i < 6; i += 1) window.__ll.debug.buy();
    for (let i = 0; i < 8; i += 1) window.__ll.debug.deployBest();
  });
  await shot(page, '04-deploy.png');
  await ctx.close();
}

// 5) 合并出高等级猫
{
  const { ctx, page } = await newPage([1280, 720]);
  await page.evaluate(() => {
    window.__ll.start(); window.__ll.tutorial.skip();
    for (let i = 0; i < 8; i += 1) window.__ll.debug.buy();
    for (let i = 0; i < 4; i += 1) window.__ll.debug.mergeBest();
    for (let i = 0; i < 4; i += 1) window.__ll.debug.deployBest();
  });
  await shot(page, '05-merge.png');
  await ctx.close();
}

// 6) 胜利结算
{
  const { ctx, page } = await newPage([1280, 720]);
  await page.evaluate(() => { window.__ll.start(); window.__ll.tutorial.skip(); window.__ll.debug.winNow(); });
  await shot(page, '06-result.png');
  await ctx.close();
}

// 7) 移动端横屏对局
{
  const { ctx, page } = await newPage([844, 390], true);
  await page.evaluate(() => {
    window.__ll.start(); window.__ll.tutorial.skip();
    for (let i = 0; i < 3; i += 1) window.__ll.debug.buy();
    for (let i = 0; i < 3; i += 1) window.__ll.debug.deployBest();
  });
  await shot(page, '07-m-playing.png');
  await ctx.close();
}

// 8) 中文对局
{
  const { ctx, page } = await newPage([1280, 720]);
  await page.evaluate(() => {
    const s = document.getElementById('lang-select');
    s.value = 'zh'; s.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await page.waitForTimeout(250);
  await page.evaluate(() => {
    window.__ll.start(); window.__ll.tutorial.skip();
    for (let i = 0; i < 3; i += 1) window.__ll.debug.buy();
  });
  await shot(page, '08-zh-playing.png');
  await ctx.close();
}

await browser.close();
server.close();
console.log('done →', OUT);
