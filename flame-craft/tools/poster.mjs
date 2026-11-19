// tools/poster.mjs — 生成 poster.jpg（1280×720）：截游戏标题屏（霓虹 LOGO + 三层火焰目标）。
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadPlaywright, serve } from '../../../skills/webgame-playbook/scripts/_lib.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const { chromium } = loadPlaywright();
const { server, port } = await serve(root, 8240);
const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=metal'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

try {
  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'load', timeout: 30000 });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'load' });
  await page.waitForTimeout(1600);
  await page.screenshot({ path: path.join(root, 'poster.jpg'), type: 'jpeg', quality: 90 });
  console.log('✓ poster.jpg');
} finally {
  await browser.close();
  server.close();
}
