// 生成 poster.jpg（1280×720）：用 playwright 截取游戏本身最好看的画面（第 1 关记忆阶段）。
// 用法：node tools/poster.mjs
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadPlaywright, serve } from '../../../skills/webgame-playbook/scripts/_lib.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { chromium } = loadPlaywright();

const { server, port } = await serve(ROOT, 8210);
const url = `http://127.0.0.1:${port}/`;
const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=metal'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto(url, { waitUntil: 'load', timeout: 20000 });
await page.waitForFunction(() => typeof window.__ll !== 'undefined', { timeout: 15000 });
await page.waitForTimeout(800);
// 进入第 1 关记忆阶段（跳过教程，展示 3 位霓虹朋友 + 名字）
await page.evaluate(() => window.__ll.start(0));
await page.waitForTimeout(900);
const out = path.join(ROOT, 'poster.jpg');
await page.screenshot({ path: out, type: 'jpeg', quality: 90 });
console.log(`✓ poster: ${out}`);
await browser.close();
server.close();
