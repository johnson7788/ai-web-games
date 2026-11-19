// 生成 poster.jpg（1280×720）：起本地服务 → 进入战斗演示画面 → playwright 截图。
// 运行：node tools/poster.mjs
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

function loadPlaywright() {
  for (const c of ['playwright', '/opt/homebrew/lib/node_modules/playwright', '/Users/admin/.npm-global/lib/node_modules/playwright']) {
    try { return require(c); } catch { /* next */ }
  }
  throw new Error('playwright not found');
}

const { chromium } = loadPlaywright();
const { server, port } = await (await import('../../../skills/webgame-playbook/scripts/_lib.mjs')).serve(ROOT, 8280);

const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=metal'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'load', timeout: 20000 });
await page.waitForFunction(() => typeof window.__ll !== 'undefined', { timeout: 15000 });
await page.waitForTimeout(800);
await page.evaluate(() => {
  window.__ll.debug.setTutorialDone(true);
  window.__ll.start();
});
await page.waitForTimeout(400);
await page.evaluate(() => window.__ll.debug.spawnShowcase());
await page.waitForTimeout(500);
await page.screenshot({ path: join(ROOT, 'poster.jpg'), type: 'jpeg', quality: 90 });
await browser.close();
server.close();
console.log('✓ poster.jpg (1280×720)');
