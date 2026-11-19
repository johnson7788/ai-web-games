// 生成 poster.jpg（1280×720，标题屏截图）
import { loadPlaywright, serve } from '../../../skills/webgame-playbook/scripts/_lib.mjs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const { server, port } = await serve(root, 8260);
const { chromium } = loadPlaywright();
const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=metal'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'load', timeout: 20000 });
await page.waitForTimeout(1000);
await page.screenshot({ path: path.join(root, 'poster.jpg'), type: 'jpeg', quality: 92 });
await browser.close();
server.close();
console.log('wrote poster.jpg (1280x720)');
