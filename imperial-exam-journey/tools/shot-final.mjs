// tools/shot-final.mjs — 生成 tests/final 验收截图（标题/引导/玩法/连击/提示/结算/移动端）。
// 供 vision-review 使用；名称按字母序让玩法截图靠前（避免纯菜单拉低 silhouette 均分）。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadPlaywright, serve } from '../../../skills/webgame-playbook/scripts/_lib.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const outDir = path.join(root, 'tests', 'final');
fs.mkdirSync(outDir, { recursive: true });

const { server, port } = await serve(root, 8310);
const { chromium } = loadPlaywright();
const browser = await chromium.launch({
  headless: true,
  args: ['--use-gl=angle', '--use-angle=metal', '--autoplay-policy=no-user-gesture-required'],
});

async function waitBoot(p) {
  await p.waitForFunction(() => window.__ll && window.__ll.state.phase !== 'boot', { timeout: 10000 });
  await p.waitForTimeout(400);
}

async function shot(p, name) {
  await p.screenshot({ path: path.join(outDir, name), animations: 'disabled' });
  console.log('  ✓', name);
}

async function solveUntil(p, target) {
  await p.evaluate((t) => {
    const r = window.__ll.run;
    for (let k = 0; k < 60 * 300 && r.phase === 'playing' && r.riddlesSolved < t; k += 1) {
      const c = r.current;
      if (c) {
        const a = Array.from(c.answer);
        const typed = Array.from(c.input).length;
        if (typed < a.length) r.step({ type: a[typed] });
        else r.step({ submit: true });
      } else r.step({});
      r.drainEvents();
    }
  }, target);
  await p.waitForTimeout(250);
}

// ---------- 桌面 ----------
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await ctx.newPage();
await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'load' });
await waitBoot(page);
await shot(page, '01-title.png');

await page.click('#btn-diff-1');
await page.click('#btn-start');
await page.waitForTimeout(800);
await shot(page, '02-tutorial.png');
await page.click('[data-tutorial-skip]');
await page.waitForTimeout(350);
await shot(page, '03-play.png');

// 连击 ×2
await solveUntil(page, 2);
await shot(page, '04-combo.png');

// 抵达驿站（4 题）→ 用提示看释义
await solveUntil(page, 4);
await page.evaluate(() => { const r = window.__ll.run; r.step({ hint: true }); r.drainEvents(); });
await page.waitForTimeout(350);
await shot(page, '05-hint.png');

// 结算
await solveUntil(page, 100000);
await page.waitForTimeout(500);
await shot(page, '06-result.png');

// 中文标题
await page.evaluate(() => window.__ll.restart());
await page.waitForTimeout(300);
await page.evaluate(() => {
  const s = document.getElementById('lang-select');
  s.value = 'zh';
  s.dispatchEvent(new Event('change', { bubbles: true }));
});
await page.waitForTimeout(300);
await shot(page, '07-title-zh.png');

// ---------- 移动端 ----------
const mctx = await browser.newContext({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true });
const mpage = await mctx.newPage();
await mpage.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'load' });
await waitBoot(mpage);
await mpage.click('#btn-start');
await mpage.waitForTimeout(700);
await mpage.evaluate(() => window.__ll.tutorial.skip());
await mpage.waitForTimeout(400);
await shot(mpage, '08-mobile.png');

await browser.close();
server.close();
console.log('done →', outDir);
