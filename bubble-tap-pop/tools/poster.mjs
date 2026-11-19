// 生成海报 poster.jpg（1280×720）：起服务、截标题屏、关服务。
// 用法：node tools/poster.mjs
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadPlaywright, serve } from '../../../skills/webgame-playbook/scripts/_lib.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const { server, port } = await serve(ROOT, 8260);
const { chromium } = loadPlaywright();
const browser = await chromium.launch({
  headless: true,
  args: ['--use-gl=angle', '--use-angle=metal'],
});
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'load', timeout: 20000 });
  await page.waitForTimeout(1400);
  await page.screenshot({ path: path.join(ROOT, 'poster.jpg'), type: 'jpeg', quality: 92 });
  console.log(`wrote poster.jpg (1280x720)`);
} finally {
  await browser.close();
  server.close();
}
