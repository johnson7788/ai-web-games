// Ring Fusion · poster.jpg 生成（1280×720，用真实游戏画面）
// 运行：node tools/poster.mjs
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
await page.waitForTimeout(700);
await page.evaluate(() => { window.__ll.tutorial.skip(); window.__ll.start(0); });
await page.waitForTimeout(500);
await page.evaluate(() => window.__ll.debug.seedBoard(20));
await page.waitForTimeout(500);
await page.screenshot({ path: path.join(ROOT, 'poster.jpg'), type: 'jpeg', quality: 90 });
console.log(`✓ poster.jpg written (${ROOT}/poster.jpg)`);
await browser.close();
server.close();
