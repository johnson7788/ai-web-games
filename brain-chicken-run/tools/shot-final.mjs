#!/usr/bin/env node
// tools/shot-final.mjs — 生成 vision-review 用的 tests/final/*.png（真实运行截图）。
// 标题 / 出题中 / 玩家选 TRUE 车道 / 中文 / 移动端。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadPlaywright, serve, waitForBoot } from '../../../skills/webgame-playbook/scripts/_lib.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'tests', 'final');

const { chromium } = loadPlaywright();
const { server, port } = await serve(ROOT, 8230);
const base = `http://127.0.0.1:${port}/`;
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({
  headless: true,
  args: ['--use-gl=angle', '--use-angle=metal', '--autoplay-policy=no-user-gesture-required'],
});

async function shot(page, name) {
  await page.screenshot({ path: path.join(OUT, name) });
  console.log(`  ✓ ${name}`);
}

async function boot(page) {
  await page.goto(base, { waitUntil: 'load', timeout: 20000 });
  await waitForBoot(page, 10000);
  await page.waitForFunction(() => window.__ll && window.__ll.state.phase !== 'boot', { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(500);
}

// 1) 标题屏
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage();
  await boot(page);
  await shot(page, '01-title.png');
  await ctx.close();
}

// 2/3) 出题中 + 玩家站 TRUE 车道
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage();
  await boot(page);
  await page.evaluate(() => { window.__ll.start(); window.__ll.tutorial.skip(); });
  await page.waitForFunction(() => window.__ll.run && window.__ll.run.question, { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(600);
  await shot(page, '02-play.png');
  await page.evaluate(() => { if (window.__ll.run && window.__ll.run.question) { window.__ll.run.step({ choose: 'true' }); window.__ll.run.drainEvents(); } });
  await page.waitForTimeout(250);
  await shot(page, '03-lane.png');
  await ctx.close();
}

// 4) 中文标题
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage();
  await page.goto(`${base}?lang=zh`, { waitUntil: 'load', timeout: 20000 });
  await waitForBoot(page, 10000);
  await page.waitForTimeout(600);
  await shot(page, '04-title-zh.png');
  await ctx.close();
}

// 5) 移动端
{
  const ctx = await browser.newContext({
    viewport: { width: 844, height: 390 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  const page = await ctx.newPage();
  await boot(page);
  await page.evaluate(() => { window.__ll.start(); window.__ll.tutorial.skip(); });
  await page.waitForFunction(() => window.__ll.run && window.__ll.run.question, { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(600);
  await shot(page, '05-mobile.png');
  await ctx.close();
}

await browser.close();
server.close();
console.log(`done → ${OUT}`);
