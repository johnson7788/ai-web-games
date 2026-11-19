// MR HAT ESCAPE · 截一张 1280×720 的玩法海报图（poster.jpg）。
// 用法：node tools/make-poster.mjs
import { loadPlaywright, serve, createErrorCollector } from '../../../skills/webgame-playbook/scripts/_lib.mjs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { server, port } = await serve(ROOT, 8200);
const { chromium } = loadPlaywright();
const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=metal'] });
const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await context.newPage();
const collector = createErrorCollector();
collector.attach(page, port);

await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'load', timeout: 20000 });
await page.waitForFunction(() => typeof window.__ll !== 'undefined', { timeout: 15000 }).catch(() => {});
await page.waitForTimeout(500);
// 进入第 1 关并走到能同时看到钥匙、尖刺、门的位置
await page.evaluate(() => {
  window.__ll.start(0);
  window.__ll.debug.teleport(760, 576);
});
await page.waitForTimeout(700);
const out = path.join(ROOT, 'poster.jpg');
await page.screenshot({ path: out, type: 'jpeg', quality: 88 });
await browser.close();
server.close();
console.log(`poster → ${out}  (${collector.consoleErrors.length} console errors)`);
process.exit(0);
