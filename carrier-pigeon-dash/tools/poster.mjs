// 生成 poster.jpg（1280×720，截标题屏）。自带服务，用完即关；端口 8200 起自增。
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadPlaywright, serve } from '../../../skills/webgame-playbook/scripts/_lib.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { server, port } = await serve(ROOT, 8200);
const { chromium } = loadPlaywright();

const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=metal'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'load', timeout: 20000 });
await page.waitForFunction(() => typeof window.__ll !== 'undefined', { timeout: 15000 });
await page.waitForTimeout(1200);
await page.screenshot({ path: path.join(ROOT, 'poster.jpg'), type: 'jpeg', quality: 90 });
console.log(`✓ poster.jpg (${port})`);

await browser.close();
server.close();
