// SNOWMAN FACTORY · 截图脚本：产出 tests/final/*.png（vision-review 用）+ poster.jpg。
// 运行：node tools/shots.mjs  （自带服务，用完即关；端口 8200 起自增）
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadPlaywright, serve, waitForBoot } from '../../../skills/webgame-playbook/scripts/_lib.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'tests', 'final');
fs.mkdirSync(OUT, { recursive: true });

const { server, port } = await serve(ROOT, 8200);
const url = `http://127.0.0.1:${port}/`;
const { chromium } = loadPlaywright();
const browser = await chromium.launch({
  headless: true,
  args: ['--use-gl=angle', '--use-angle=metal', '--autoplay-policy=no-user-gesture-required'],
});

async function shot(page, name) {
  await page.screenshot({ path: path.join(OUT, name) });
  console.log('  ✓', name);
}

async function newPage(viewport) {
  const ctx = await browser.newContext({ viewport });
  const p = await ctx.newPage();
  await p.goto(url, { waitUntil: 'load', timeout: 20000 });
  await waitForBoot(p, 10000);
  await p.evaluate(() => window.__ll.debug.setTutorialDone(true));
  return { p, ctx };
}

// 桌面：标题 / 游玩 / 多蛋筒 / 连击 / 结算
{
  const { p, ctx } = await newPage({ width: 1280, height: 720 });
  await p.waitForTimeout(600);
  await shot(p, '01-title.png');
  await p.evaluate(() => window.__ll.start(0));
  await p.waitForTimeout(700);
  await p.evaluate(() => window.__ll.debug.seedScene());
  await p.waitForTimeout(350);
  await shot(p, '02-playing.png');

  await p.evaluate(() => {
    window.__ll.debug.clearItems();
    window.__ll.debug.place('cone', 430, { color: 'red' });
    window.__ll.debug.place('cone', 560, { color: 'blue', golden: true });
    window.__ll.debug.place('cone', 780, { color: 'green' });
  });
  await p.waitForTimeout(250);
  await shot(p, '03-cones.png');

  await p.evaluate(() => {
    window.__ll.debug.clearItems();
    window.__ll.debug.place('cone', 470, { color: 'red', topped: true });
    window.__ll.debug.place('cone', 620, { color: 'blue', golden: true });
    window.__ll.debug.place('cone', 830, { color: 'green', topped: true });
    window.__ll.run().state.combo = 5;
    window.__ll.run().state.mult = 5;
    window.__ll.run().state.score = 120;
  });
  await p.waitForTimeout(250);
  await shot(p, '04-combo.png');
  // 海报：拿连击画面，输出真 JPEG
  await p.screenshot({ path: path.join(ROOT, 'poster.jpg'), type: 'jpeg', quality: 90 });
  console.log('  ✓ poster.jpg');

  await p.evaluate(() => window.__ll.debug.forceResult());
  await p.waitForTimeout(500);
  await shot(p, '05-result.png');
  await ctx.close();
}

// 中文游玩
{
  const { p, ctx } = await newPage({ width: 1280, height: 720 });
  await p.evaluate(() => {
    const s = document.getElementById('lang-select');
    s.value = 'zh';
    s.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await p.waitForTimeout(200);
  await p.evaluate(() => window.__ll.start(0));
  await p.waitForTimeout(500);
  await p.evaluate(() => {
    window.__ll.debug.clearItems();
    window.__ll.debug.place('cone', 520, { color: 'red' });
    window.__ll.debug.place('cone', 700, { color: 'green', golden: true });
  });
  await p.waitForTimeout(300);
  await shot(p, '06-zh-playing.png');
  await ctx.close();
}

// 移动端（横屏）
{
  const { p, ctx } = await newPage({ width: 844, height: 390 });
  await p.waitForTimeout(500);
  await shot(p, '07-mobile-title.png');
  await p.evaluate(() => window.__ll.start(0));
  await p.waitForTimeout(500);
  await p.evaluate(() => window.__ll.debug.seedScene());
  await p.waitForTimeout(300);
  await shot(p, '08-mobile-playing.png');
  await ctx.close();
}

await browser.close();
server.close();
console.log(`done → ${OUT}`);
