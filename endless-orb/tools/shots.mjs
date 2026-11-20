// tools/shots.mjs — 生成 tests/final/*.png 验收截图（标题 / 三场景玩法 / 重光子 / 双核 / 摇摆 / 移动端）。
// vision-review 扫描 tests/final 前 8 张；这里全部产出真实玩法画面（无纯菜单结算卡）。
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadPlaywright, serve, waitForBoot } from '../../../skills/webgame-playbook/scripts/_lib.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'tests', 'final');
mkdirSync(OUT, { recursive: true });

const { server, port } = await serve(ROOT, 8140);
const { chromium } = loadPlaywright();
const browser = await chromium.launch({
  headless: true,
  args: ['--use-gl=angle', '--use-angle=metal', '--autoplay-policy=no-user-gesture-required'],
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function shot(page, name) {
  await page.screenshot({ path: path.join(OUT, name), fullPage: false, animations: 'disabled', timeout: 15000 });
  console.log('shot', name);
}

async function startAndSkip(page) {
  await page.click('#btn-start');
  await sleep(600);
  const skip = page.locator('[data-tutorial-skip]').first();
  if (await skip.count() && await skip.isVisible()) {
    await skip.click({ force: true });
    await sleep(400);
  }
}

// ---------- 桌面 ----------
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await ctx.newPage();
await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'load', timeout: 20000 });
await waitForBoot(page, 10000);
await page.waitForFunction(() => window.__ll?.state?.phase === 'title', { timeout: 10000 }).catch(() => {});
await shot(page, '01-title.png');

await startAndSkip(page);
await page.evaluate(() => window.__ll.debug.pin(4));
await sleep(300);
await shot(page, '02-play.png');

await page.evaluate(() => { window.__ll.debug.jump(1); window.__ll.debug.pin(3); window.__ll.debug.pin(1, true); });
await sleep(300);
await shot(page, '03-heavy.png');

await page.evaluate(() => { window.__ll.debug.jump(5); window.__ll.debug.pin(10); });
await sleep(300);
await shot(page, '04-red.png');

await page.evaluate(() => { window.__ll.debug.jump(6); window.__ll.debug.pin(12); });
await sleep(300);
await shot(page, '05-twin.png');

await page.evaluate(() => { window.__ll.debug.jump(9); window.__ll.debug.pin(14); });
await sleep(300);
await shot(page, '06-black.png');

await page.evaluate(() => { window.__ll.debug.jump(11); window.__ll.debug.pin(16); });
await sleep(300);
await shot(page, '07-swing.png');

await ctx.close();

// ---------- 移动端 ----------
const mctx = await browser.newContext({
  viewport: { width: 844, height: 390 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
});
const mpage = await mctx.newPage();
await mpage.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'load', timeout: 20000 });
await waitForBoot(mpage, 10000);
await mpage.waitForFunction(() => window.__ll?.state?.phase === 'title', { timeout: 10000 }).catch(() => {});
await startAndSkip(mpage);
await mpage.evaluate(() => window.__ll.debug.pin(4));
await sleep(400);
await shot(mpage, '08-mobile.png');
await mctx.close();

await browser.close();
server.close();
console.log('done →', OUT);
