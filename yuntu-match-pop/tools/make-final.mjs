// 生成 vision-review 用的 8 张「含玩法剪影」截图到 tests/final/。
// 只放真实运行状态（标题带演示盘 / 玩法 / 合并 / 岩石 / 结算带棋盘 / 移动端 / 中文），
// 不放纯菜单截图（纯菜单会被 vision-review 判 silhouette 0 拉低均分）。
// 运行：node tools/make-final.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadPlaywright, serve } from '../../../skills/webgame-playbook/scripts/_lib.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const outDir = path.join(root, 'tests', 'final');
fs.mkdirSync(outDir, { recursive: true });

const { server, port } = await serve(root, 8260);
const { chromium } = loadPlaywright();
const browser = await chromium.launch({
  headless: true,
  args: ['--use-gl=angle', '--use-angle=metal', '--autoplay-policy=no-user-gesture-required'],
});
const url = `http://127.0.0.1:${port}/`;

async function newPage(viewport, dpr = 1) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: dpr });
  const page = await context.newPage();
  await page.goto(url, { waitUntil: 'load', timeout: 20000 });
  await page.waitForFunction(() => typeof window.__ll !== 'undefined', { timeout: 15000 });
  await page.waitForTimeout(500);
  return { context, page };
}

try {
  // 01 标题屏：canvas 演示棋盘 + 目标瓦 + Start
  {
    const { context, page } = await newPage({ width: 1280, height: 720 });
    await page.screenshot({ path: path.join(outDir, '01-title.png') });
    await context.close();
  }

  // 02 玩法：第 1 关落几块
  {
    const { context, page } = await newPage({ width: 1280, height: 720 });
    await page.evaluate(() => window.__ll.start(0));
    await page.waitForTimeout(300);
    await page.evaluate(() => window.__ll.debug.playGreedy(6));
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(outDir, '02-playing.png') });
    await context.close();
  }

  // 03 合成中：更多块 + 大值瓦
  {
    const { context, page } = await newPage({ width: 1280, height: 720 });
    await page.evaluate(() => window.__ll.start(0));
    await page.waitForTimeout(200);
    await page.evaluate(() => window.__ll.debug.playGreedy(16));
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(outDir, '03-merge.png') });
    await context.close();
  }

  // 04 岩石：第 3 关注入一块岩石 + 若干瓦
  {
    const { context, page } = await newPage({ width: 1280, height: 720 });
    await page.evaluate(() => window.__ll.debug.loadLevel(2));
    await page.waitForTimeout(250);
    await page.evaluate(() => {
      const st = window.__ll.debug.state();
      if (st) { st.grid[1].push({ v: 4 }); st.grid[2].push({ v: 0 }); st.grid[3].push({ v: 2 }); }
    });
    await page.waitForTimeout(350);
    await page.screenshot({ path: path.join(outDir, '04-rock.png') });
    await context.close();
  }

  // 05 大瓦/连击：第 1 关逼近目标
  {
    const { context, page } = await newPage({ width: 1280, height: 720 });
    await page.evaluate(() => window.__ll.start(0));
    await page.waitForTimeout(200);
    await page.evaluate(() => window.__ll.debug.playGreedy(10));
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(outDir, '05-combo.png') });
    await context.close();
  }

  // 06 结算：通关后棋盘仍透出
  {
    const { context, page } = await newPage({ width: 1280, height: 720 });
    await page.evaluate(() => window.__ll.debug.loadLevel(0));
    await page.waitForTimeout(200);
    await page.evaluate(() => window.__ll.debug.fastWin());
    await page.waitForTimeout(600);
    await page.screenshot({ path: path.join(outDir, '06-result.png') });
    await context.close();
  }

  // 07 中文玩法：无豆腐块
  {
    const { context, page } = await newPage({ width: 1280, height: 720 });
    await page.evaluate(() => {
      const s = document.getElementById('lang-select');
      if (s) { s.value = 'zh'; s.dispatchEvent(new Event('change', { bubbles: true })); }
      window.__ll.start(0);
    });
    await page.waitForTimeout(300);
    await page.evaluate(() => window.__ll.debug.playGreedy(8));
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(outDir, '07-zh.png') });
    await context.close();
  }

  // 08 移动端：横屏玩法
  {
    const { context, page } = await newPage({ width: 844, height: 390 }, 2);
    await page.evaluate(() => window.__ll.start(0));
    await page.waitForTimeout(300);
    await page.evaluate(() => window.__ll.debug.playGreedy(8));
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(outDir, '08-mobile.png') });
    await context.close();
  }

  console.log('✓ final screenshots written to tests/final/');
} finally {
  await browser.close();
  server.close();
}
