// 生成 poster.jpg（1280×720）：起本地服务 → 进入第 1 关记忆阶段 → 截屏。
// 用完即关，端口 8200 起自增。运行：node tools/poster.mjs
import { loadPlaywright, serve } from '../../../skills/webgame-playbook/scripts/_lib.mjs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const { server, port } = await serve(ROOT, 8200);
const { chromium } = loadPlaywright();
const browser = await chromium.launch({
  headless: true,
  args: ['--use-gl=angle', '--use-angle=metal', '--autoplay-policy=no-user-gesture-required'],
});
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'load', timeout: 20000 });
  await page.waitForFunction(() => typeof window.__ll !== 'undefined', { timeout: 10000 });
  await page.evaluate(() => { window.__ll.start(0); window.__ll.tutorial.skip(); });
  await page.waitForTimeout(3400); // 进入记忆阶段（棱镜可见）
  await page.screenshot({ path: path.join(ROOT, 'poster.jpg'), type: 'jpeg', quality: 88 });
  console.log('poster.jpg written');
} finally {
  await browser.close();
  server.close();
}
