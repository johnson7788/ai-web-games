// 生成 poster.jpg（1280×720）：用 playwright 截游戏本身最好看的战斗画面。
// 自带静态服务，用完即关；端口 8200 起自增（8200-8299）。
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadPlaywright, serve } from '../../../skills/webgame-playbook/scripts/_lib.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'poster.jpg');

const { server, port } = await serve(ROOT, 8200);
const { chromium } = loadPlaywright();
const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=metal'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

try {
  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'load', timeout: 20000 });
  await page.waitForFunction(() => typeof window.__ll !== 'undefined', { timeout: 15000 });
  await page.waitForTimeout(800);
  // 进入战斗：第 1 关 5 色无岩石，棋盘最干净鲜艳；跳过教程遮罩
  await page.evaluate(() => window.__ll.start(0));
  await page.waitForTimeout(600);
  await page.evaluate(() => window.__ll.tutorial.skip());
  await page.waitForTimeout(400);
  await page.screenshot({ path: OUT, type: 'jpeg', quality: 92 });
  console.log(`wrote ${OUT} (${port})`);
} finally {
  await browser.close();
  server.close();
}
