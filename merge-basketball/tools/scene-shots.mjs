// MERGE BASKETBALL · 生成 tests/final 评审截图（纯玩法画面，供 vision-review）
// 桌面 + 移动端各几张，全部是「有球、有目标阶梯」的实战画面，避开纯菜单。
// 运行：node tools/scene-shots.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadPlaywright, serve } from '../../../skills/webgame-playbook/scripts/_lib.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'tests', 'final');

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const { chromium } = loadPlaywright();
  const { server, port } = await serve(ROOT, 8210);
  const browser = await chromium.launch({
    headless: true,
    args: ['--use-gl=angle', '--use-angle=metal', '--autoplay-policy=no-user-gesture-required'],
  });

  async function boot(ctxOpts, w, h, isMobile) {
    const context = await browser.newContext({
      viewport: { width: w, height: h },
      deviceScaleFactor: isMobile ? 2 : 1,
      isMobile,
      hasTouch: isMobile,
    });
    const page = await context.newPage();
    await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'load', timeout: 20000 });
    await page.waitForFunction(() => typeof window.__ll !== 'undefined', { timeout: 15000 });
    await page.waitForTimeout(500);
    // 跳过教程，确保截图是干净玩法画面
    await page.evaluate(() => { window.__ll.debug.setTutorialDone(true); window.__ll.start(); });
    await page.waitForTimeout(500);
    return { context, page };
  }

  async function drop(page, x) {
    await page.evaluate((xx) => window.__ll.debug.drop(xx), x);
    await page.waitForTimeout(650);
  }

  // --- 海报：标题屏（1280×720 JPEG） ---
  {
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    const page = await context.newPage();
    await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'load', timeout: 20000 });
    await page.waitForFunction(() => typeof window.__ll !== 'undefined', { timeout: 15000 });
    await page.waitForTimeout(700);
    await page.screenshot({ path: path.join(ROOT, 'poster.jpg'), type: 'jpeg', quality: 90 });
    await context.close();
  }

  // --- 桌面 01：开局几颗球 ---
  {
    const { context, page } = await boot(null, 1280, 720, false);
    await drop(page, 120);
    await drop(page, 250);
    await drop(page, 187);
    await drop(page, 90);
    await drop(page, 280);
    await page.screenshot({ path: path.join(OUT, '01-playing.png') });
    await context.close();
  }

  // --- 桌面 02：更多球 + 中央堆叠 ---
  {
    const { context, page } = await boot(null, 1280, 720, false);
    for (const x of [187, 187, 130, 240, 90, 280, 160, 210, 120, 250]) {
      await drop(page, x);
    }
    await page.screenshot({ path: path.join(OUT, '02-playing2.png') });
    await context.close();
  }

  // --- 桌面 03：结算屏（有星级/得分） ---
  {
    const { context, page } = await boot(null, 1280, 720, false);
    await drop(page, 120);
    await drop(page, 250);
    await page.evaluate(() => window.__ll.debug.forceLose());
    await page.waitForTimeout(400);
    await page.screenshot({ path: path.join(OUT, '03-result.png') });
    await context.close();
  }

  // --- 移动端 04：横屏玩法 ---
  {
    const { context, page } = await boot(null, 844, 390, true);
    await drop(page, 150);
    await drop(page, 220);
    await drop(page, 187);
    await page.screenshot({ path: path.join(OUT, '04-mobile.png') });
    await context.close();
  }

  await browser.close();
  server.close();
  console.log('wrote', fs.readdirSync(OUT).filter((n) => /\.png$/.test(n)).join(', '));
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
