// 生成 poster.jpg（1280×720，标题屏霓虹画面）
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadPlaywright, serve, waitForBoot } from '../../../skills/webgame-playbook/scripts/_lib.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { server, port } = await serve(root, 8240);
const { chromium } = loadPlaywright();
const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=metal'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'load', timeout: 20000 });
await waitForBoot(page, 8000);
await page.waitForTimeout(1200);
await page.screenshot({ path: path.join(root, 'poster.jpg'), type: 'jpeg', quality: 92 });
await browser.close();
server.close();
console.log('wrote poster.jpg');
