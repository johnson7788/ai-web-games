// Travel Master Pack · 截图工具：生成 tests/final/ 门禁截图 + poster.jpg。
// 只读引入 playbook 的 _lib（serve/loadPlaywright），用完即关，不起常驻服务。
// 运行：node tools/scene-shots.mjs

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadPlaywright, serve } from '../../../skills/webgame-playbook/scripts/_lib.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'tests', 'final');

const { server, port } = await serve(ROOT, 8260);
const { chromium } = loadPlaywright();
const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=metal', '--autoplay-policy=no-user-gesture-required'] });

async function placeScene(page, cfg) {
  return page.evaluate((c) => {
    window.__ll.start(1);
    const s = window.__ll.sim();
    s.spawnInterval = 1e9;
    s.spawnAcc = 0;
    s.entities = (c.entities || []).map((e) => ({
      kind: e[0], lane: e[1], thing: e[2] || 0, y: e[3],
      speed: 0, resolved: false, removed: false, passed: false,
    }));
    s.lane = c.lane ?? 1;
    s.score = c.score ?? 0;
    s.combo = c.combo ?? 0;
    s.comboMult = c.comboMult ?? 1;
    s.shield = c.shield ?? 0;
    s.level = 1 + Math.floor((c.score ?? 0) / 20);
    window.__ll.tutorial.skip();
    return true;
  }, cfg);
}

try {
  const desktop = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await desktop.newPage();
  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'load', timeout: 30000 });
  await page.waitForFunction(() => !!window.__ll, { timeout: 15000 });
  await page.waitForTimeout(500);

  // 海报 = 标题屏（霓虹场景 + 大字标题）
  await page.screenshot({ path: path.join(ROOT, 'poster.jpg'), type: 'jpeg', quality: 90 });

  // 01 完整玩法：路障 + 包裹(◆) + 护盾 + HUD
  await placeScene(page, {
    lane: 1, score: 45, combo: 12, comboMult: 2, shield: 1, level: 3,
    entities: [
      ['barrier', 0, 0, 220], ['barrier', 3, 2, 340], ['barrier', 2, 1, 500],
      ['goods', 2, 0, 300], ['goods', 1, 1, 430],
      ['shield', 3, 0, 180],
    ],
  });
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(OUT, '01-playing.png') });

  // 02 收集物特写：◆ 标记醒目
  await placeScene(page, {
    lane: 2, score: 8, combo: 4, comboMult: 1, shield: 0,
    entities: [
      ['goods', 2, 0, 360], ['goods', 0, 1, 260],
      ['barrier', 3, 0, 480],
    ],
  });
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(OUT, '02-collect.png') });

  // 03 护盾：金色拾取物（加号标记）在独立车道，玩家无盾，目标清晰
  await placeScene(page, {
    lane: 1, score: 20, combo: 8, comboMult: 1, shield: 0,
    entities: [
      ['shield', 2, 0, 260], ['goods', 3, 0, 400], ['barrier', 0, 0, 480],
    ],
  });
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(OUT, '03-shield.png') });

  // 04 连击 ×3
  await placeScene(page, {
    lane: 1, score: 60, combo: 25, comboMult: 3, shield: 1,
    entities: [
      ['goods', 1, 1, 380], ['barrier', 0, 0, 260], ['barrier', 2, 2, 460],
    ],
  });
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(OUT, '04-combo.png') });

  // 05 结算 2 星
  await page.evaluate(() => window.__ll.debug.forceResult(52));
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(OUT, '05-result.png') });

  await desktop.close();

  // 06 移动端横屏玩法
  const mobile = await browser.newContext({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const mp = await mobile.newPage();
  await mp.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'load', timeout: 30000 });
  await mp.waitForFunction(() => !!window.__ll, { timeout: 15000 });
  await mp.waitForTimeout(500);
  await placeScene(mp, {
    lane: 1, score: 15, combo: 6, comboMult: 1, shield: 1,
    entities: [
      ['goods', 1, 0, 300], ['barrier', 0, 1, 220], ['shield', 2, 0, 160],
    ],
  });
  await mp.waitForTimeout(300);
  await mp.screenshot({ path: path.join(OUT, '06-mobile.png') });
  await mobile.close();

  console.log('screenshots written to tests/final/ + poster.jpg');
} finally {
  await browser.close();
  server.close();
}
