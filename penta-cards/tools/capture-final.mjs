// tools/capture-final.mjs — 生成 tests/final 验收截图（标题/玩法/结算/移动端）。
// 用法：/opt/homebrew/bin/node tools/capture-final.mjs
import { loadPlaywright, serve } from '../../../skills/webgame-playbook/scripts/_lib.mjs';
import path from 'node:path';
import { mkdirSync } from 'node:fs';

const { chromium } = loadPlaywright();
const { server, port } = await serve(path.resolve('.'), 8460);
const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=metal', '--autoplay-policy=no-user-gesture-required'] });
const outDir = path.resolve('tests/final');
mkdirSync(outDir, { recursive: true });

async function shot(page, name) {
  await page.screenshot({ path: path.join(outDir, name), timeout: 15000 });
}

const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await ctx.newPage();
await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'load', timeout: 20000 });
await page.waitForFunction(() => window.__ll?.state?.phase !== 'boot', { timeout: 8000 }).catch(() => {});
await page.waitForTimeout(700);

await shot(page, '01-title.png');

// 中文标题
await page.evaluate(() => { const s = document.getElementById('lang-select'); s.value = 'zh'; s.dispatchEvent(new Event('change', { bubbles: true })); });
await page.waitForTimeout(250);
await shot(page, '02-title-zh.png');
await page.evaluate(() => { const s = document.getElementById('lang-select'); s.value = 'en'; s.dispatchEvent(new Event('change', { bubbles: true })); });
await page.waitForTimeout(250);

// 开局 + 跳过引导 + 打几手（让弃牌/牌墙可见）
await page.click('#btn-start');
await page.waitForTimeout(600);
await page.click('[data-tutorial-skip]');
await page.waitForTimeout(400);
await page.evaluate(() => window.__ll.debug.stepN(9));
await page.waitForTimeout(500);
await shot(page, '03-play.png');

// 打到结算
await page.evaluate(() => window.__ll.debug.playToRoundEnd());
await page.waitForTimeout(500);
await shot(page, '04-result.png');

// 下一局再打几手
await page.click('#btn-next');
await page.waitForTimeout(600);
await page.evaluate(() => window.__ll.debug.stepN(6));
await page.waitForTimeout(500);
await shot(page, '05-play2.png');

await ctx.close();

// 移动端
const mctx = await browser.newContext({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
const mpage = await mctx.newPage();
await mpage.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'load', timeout: 20000 });
await mpage.waitForFunction(() => window.__ll?.state?.phase !== 'boot', { timeout: 8000 }).catch(() => {});
await mpage.waitForTimeout(700);
await mpage.click('#btn-start');
await mpage.waitForTimeout(600);
await mpage.click('[data-tutorial-skip]');
await mpage.waitForTimeout(400);
await mpage.evaluate(() => window.__ll.debug.stepN(6));
await mpage.waitForTimeout(500);
await shot(mpage, '06-mobile.png');
await mctx.close();

await browser.close();
server.close();
console.log('captured → tests/final/');
