// tools/poster.mjs — 生成 poster.jpg（1280×720，标题屏）。
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadPlaywright, serve } from '../../../skills/webgame-playbook/scripts/_lib.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const outPath = path.join(root, 'poster.jpg');

const { server, port } = await serve(root, 8340);
const { chromium } = loadPlaywright();
const browser = await chromium.launch({
  headless: true,
  args: ['--use-gl=angle', '--use-angle=metal', '--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__ll && window.__ll.state.phase === 'title', { timeout: 10000 });
await page.waitForTimeout(500);
await page.screenshot({ path: outPath, type: 'jpeg', quality: 90, animations: 'disabled' });
console.log('✓', outPath);
await browser.close();
server.close();
