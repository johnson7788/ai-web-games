// MONSTER MELTER · 封面截图：标题屏（霓虹标题 + Boss 卡 + 漂浮宝石）→ poster.jpg (1280×720)
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadPlaywright, serve } from '../../../skills/webgame-playbook/scripts/_lib.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const result = await serve(root, 8260);
const { server, port } = result;
const { chromium } = loadPlaywright();
const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=metal'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'load', timeout: 20000 });
await page.waitForFunction(() => !!window.__ll, { timeout: 10000 });
await page.waitForTimeout(900);
await page.screenshot({ path: path.join(root, 'poster.jpg'), type: 'jpeg', quality: 90 });
await browser.close();
server.close();
console.log('wrote poster.jpg');
