// 生成 poster.jpg（1280×720）：加载游戏 → 进入格斗 → 打两拳制造火花 → 截图到根目录。
// 运行：node tools/poster.mjs（自带服务，用完即关）
import { loadPlaywright, serve, waitForBoot } from '../../../skills/webgame-playbook/scripts/_lib.mjs';
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const { server, port } = await serve(ROOT, 8240);
const { chromium } = loadPlaywright();

try {
  const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=metal', '--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await waitForBoot(page, 10000);
  // 跳过首玩引导，直接进战斗画面
  await page.evaluate(() => { window.__ll.start(0); window.__ll.tutorial.skip(); });
  await page.waitForTimeout(2300);
  // 打两拳制造命中火花
  await page.click('#btn-strike');
  await page.waitForTimeout(340);
  await page.click('#btn-strike');
  await page.waitForTimeout(120);
  await page.screenshot({ path: join(ROOT, 'poster.jpg'), type: 'jpeg', quality: 92 });
  console.log('poster.jpg written');
  await browser.close();
} finally {
  server.close();
}
