// tools/make-poster.mjs — 生成 poster.jpg（1280×720）：启动游戏、跳过引导、进入战斗屏截图。
import { loadPlaywright, serve } from '../../../skills/webgame-playbook/scripts/_lib.mjs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const { chromium } = loadPlaywright();
const { server, port } = await serve(ROOT, 8260);
const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=metal', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'load' });
await page.waitForFunction(() => typeof window.__ll !== 'undefined', { timeout: 8000 });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'load' });
await page.waitForFunction(() => typeof window.__ll !== 'undefined', { timeout: 8000 });
await page.click('#btn-start');
await page.waitForTimeout(600);
await page.evaluate(() => { const t = window.__ll?.tutorial; if (t && t.active) t.skip(); });
await page.waitForTimeout(2600); // 等乌鸦飞出来
const out = path.join(ROOT, 'poster.jpg');
await page.screenshot({ path: out, type: 'jpeg', quality: 92 });
console.log('poster.jpg →', out);
await browser.close();
server.close();
