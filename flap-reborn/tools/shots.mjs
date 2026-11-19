// FLAP REBORN · 截图工具：生成 poster.jpg（1280×720）+ tests/final/*.png（供 vision-review）。
// 自带静态服务，用完即关；端口自增。运行：node tools/shots.mjs
import { loadPlaywright, serve, waitForBoot } from '../../../skills/webgame-playbook/scripts/_lib.mjs';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'tests', 'final');
mkdirSync(OUT, { recursive: true });

const { server, port } = await serve(ROOT, 8260);
const { chromium } = loadPlaywright();
const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=metal', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });

try {
  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'load', timeout: 20000 });
  await waitForBoot(page, 10000);
  await page.waitForTimeout(800);

  // 标题屏 → poster + 标题截图
  await page.screenshot({ path: join(ROOT, 'poster.jpg'), type: 'jpeg', quality: 92 });
  await page.screenshot({ path: join(OUT, '01-title.png') });

  // 游戏屏：摆一个干净的「英雄帧」——小鸟居中偏上，前方光柱间隙清晰可见，光珠悬在间隙里
  await page.evaluate(() => {
    window.__ll.debug.setTutorialDone(true);
    window.__ll.start();
    const s = window.__ll.run().state;
    s.bird.y = 280;
    s.bird.vy = 0;
    s.bird.rot = 0;
    s.pipes = [
      { x: 470, gapY: 340, gapH: 210, scored: false, orbActive: true, orbTaken: false, orbX: 470, orbY: 340 },
      { x: 810, gapY: 300, gapH: 200, scored: false, orbActive: false, orbTaken: false, orbX: 810, orbY: 300 },
      { x: 1150, gapY: 380, gapH: 190, scored: false, orbActive: false, orbTaken: false, orbX: 1150, orbY: 380 },
    ];
  });
  await page.waitForTimeout(120);
  await page.screenshot({ path: join(OUT, '02-playing.png') });

  // 结算屏
  await page.evaluate(() => window.__ll.debug.crash());
  await page.waitForTimeout(350);
  await page.screenshot({ path: join(OUT, '03-result.png') });

  console.log(`poster.jpg → ${join(ROOT, 'poster.jpg')}`);
  console.log(`screenshots → ${OUT}`);
} finally {
  await browser.close();
  server.close();
}
