// SNAKE NEON 2048 · 海报截取：起本地服务 → 进入第 1 关 → 截 1280×720 游戏画面存 poster.jpg。
// 用后即关，不起常驻服务器。
import { createRequire } from 'node:module';
import { serve } from '../../../skills/webgame-playbook/scripts/_lib.mjs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('/opt/homebrew/lib/node_modules/playwright');

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'poster.jpg');

const { server, port } = await serve(ROOT, 8270);
const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=metal'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => typeof window.__ll !== 'undefined');
await page.waitForTimeout(400);
await page.evaluate(() => window.__ll.debug.setTutorialDone(true));
await page.evaluate(() => window.__ll.start(0));
await page.waitForTimeout(900);
await page.screenshot({ path: OUT, type: 'jpeg', quality: 92 });
await browser.close();
server.close();
console.log(`wrote ${OUT}`);
