// 生成 poster.jpg（1280×720）：起本地服务 → 进入记忆阶段（霓虹牌全亮）→ 截图。
// 运行：node tools/poster.mjs
import { loadPlaywright, serve } from '../../../skills/webgame-playbook/scripts/_lib.mjs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'poster.jpg');

const { server, port } = await serve(ROOT, 8240);
const { chromium } = loadPlaywright();
const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=metal'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

try {
  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'load', timeout: 20000 });
  await page.waitForFunction(() => typeof window.__ll !== 'undefined', { timeout: 15000 });
  await page.waitForTimeout(700);
  await page.evaluate(() => window.__ll.start(0));
  await page.waitForTimeout(500);
  await page.screenshot({ path: OUT, type: 'jpeg', quality: 90 });
  console.log(`✓ poster → ${OUT}`);
} finally {
  await browser.close();
  server.close();
}
