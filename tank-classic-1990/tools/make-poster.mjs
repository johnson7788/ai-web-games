// 生成 poster.jpg（1280×720 标题屏，用游戏本身最好看的画面）。
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('/opt/homebrew/lib/node_modules/playwright');
const { serve } = await import('../../../skills/webgame-playbook/scripts/_lib.mjs');

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const { server, port } = await serve(root, 8211);
const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=metal'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'load', timeout: 20000 });
await page.waitForTimeout(1300);
await page.screenshot({ path: join(root, 'poster.jpg'), type: 'jpeg', quality: 90 });
await browser.close();
server.close();
console.log('poster.jpg written');
