// 生成 poster.jpg（1280×720，战斗画面），用后即关。
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadPlaywright, serve } from '../../../skills/webgame-playbook/scripts/_lib.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const { server, port } = await serve(ROOT, 8260);
const { chromium } = loadPlaywright();

const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=metal'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'load', timeout: 20000 });
await page.waitForFunction(() => typeof window.__ll !== 'undefined', { timeout: 15000 });
await page.waitForTimeout(600);
await page.evaluate(() => window.__ll.start(2));
await page.waitForTimeout(800);
await page.evaluate(() => window.__ll.debug.fastForward(90));
await page.waitForTimeout(300);
await page.screenshot({ path: path.join(ROOT, 'poster.jpg'), type: 'jpeg', quality: 88 });
console.log(`wrote ${path.join(ROOT, 'poster.jpg')}`);
await browser.close();
server.close();
