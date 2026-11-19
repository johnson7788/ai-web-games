// 生成 poster.jpg（1280×720，用游戏本身画面）+ 竖屏遮罩人工自检。
// 运行：node tools/poster.mjs
import { loadPlaywright, serve } from '../../../skills/webgame-playbook/scripts/_lib.mjs';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const { chromium } = loadPlaywright();
const { server, port } = await serve(ROOT, 8260);
const url = `http://127.0.0.1:${port}/`;

const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=metal', '--autoplay-policy=no-user-gesture-required'] });

// 桌面海报：进入花园后截图
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage();
  await page.goto(url, { waitUntil: 'load', timeout: 20000 });
  await page.waitForFunction(() => !!window.__ll, { timeout: 15000 });
  await page.waitForTimeout(800);
  await page.evaluate(() => window.__ll.start());
  await page.waitForTimeout(600);
  await page.evaluate(() => window.__ll.tutorial.skip());
  await page.waitForTimeout(2600);
  await page.screenshot({ path: join(ROOT, 'poster.jpg') });
  console.log(`✓ poster.jpg`);
  await ctx.close();
}

// 竖屏遮罩自检：portrait + coarse 显示；内联 onclick 可关
{
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  const page = await ctx.newPage();
  await page.goto(url, { waitUntil: 'load', timeout: 20000 });
  await page.waitForFunction(() => !!window.__ll, { timeout: 15000 });
  await page.waitForTimeout(800);
  const shown = await page.evaluate(() => {
    const el = document.getElementById('rotate-screen');
    return el && getComputedStyle(el).display !== 'none';
  });
  await page.screenshot({ path: join(ROOT, 'tests', 'artifacts', 'rotate-portrait.png') });
  await page.evaluate(() => document.getElementById('btn-rotate-skip').click());
  await page.waitForTimeout(200);
  const hidden = await page.evaluate(() => {
    const el = document.getElementById('rotate-screen');
    return el && getComputedStyle(el).display === 'none';
  });
  console.log(`rotate-screen shown=${shown} skipHidden=${hidden}`);
  await ctx.close();
}

await browser.close();
server.close();
console.log('done');
