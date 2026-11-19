// 生成 poster.jpg（1280×720，标题屏）—— 自带静态服务，用完即关，端口 8200 起自增。
// 运行：node tools/poster-shot.mjs
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadPlaywright, serve } from '../../../skills/webgame-playbook/scripts/_lib.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'poster.jpg');

const { server, port } = await serve(ROOT, 8200);
const { chromium } = loadPlaywright();
const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=metal'] });
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'load', timeout: 20000 });
  await page.waitForFunction(() => !!window.__ll, { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1000);
  await page.screenshot({ path: OUT, type: 'jpeg', quality: 90 });
  console.log(`wrote ${OUT}`);
} finally {
  await browser.close();
  server.close();
}
