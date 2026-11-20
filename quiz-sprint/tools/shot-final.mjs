// tools/shot-final.mjs — 生成 tests/final 验收截图（标题/引导/玩法/赌注/学霸冲刺/结算/移动端）。
// 供 vision-review 与 report 使用；名称按字母序让玩法截图靠前。
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

// 桌面
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await ctx.newPage();
await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'load' });
await waitBoot(page);
await shot(page, '01-title.png');

await page.click('#btn-start');
await page.waitForTimeout(800);
await shot(page, '02-tutorial.png');
await page.click('[data-tutorial-skip]');
await page.waitForTimeout(300);

// 真实点击正确选项作答
await page.evaluate(() => {
  const r = window.__ll.run;
  if (r.question) document.getElementById('opt-' + r.question.answerIndex).click();
});
await page.waitForTimeout(500);
await shot(page, '03-play.png');

// 赌注题（DOUBLE 徽章 + 跳过按钮）
await page.evaluate(() => {
  const r = window.__ll.run;
  for (let k = 0; k < 60 * 90 && r.phase === 'playing' && !(r.question && r.question.wager); k += 1) {
    r.step({ choose: r.question ? r.question.answerIndex : null });
    r.drainEvents();
  }
});
await page.waitForTimeout(250);
await shot(page, '04-wager.png');

// 5 连对触发学霸冲刺
await page.evaluate(() => {
  const r = window.__ll.run;
  for (let k = 0; k < 60 * 90 && r.phase === 'playing' && r.combo < 5; k += 1) {
    r.step({ choose: r.question ? r.question.answerIndex : null });
    r.drainEvents();
  }
});
await page.waitForTimeout(250);
await shot(page, '05-scholar.png');

// 结算
await page.evaluate(() => {
  const r = window.__ll.run;
  for (let k = 0; k < 60 * 500 && r.phase === 'playing'; k += 1) {
    r.step({ choose: r.question ? r.question.answerIndex : null });
    r.drainEvents();
  }
});
await page.waitForTimeout(400);
await shot(page, '06-result.png');

// 移动端
const mctx = await browser.newContext({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true });
const mpage = await mctx.newPage();
await mpage.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'load' });
await waitBoot(mpage);
await mpage.click('#btn-start');
await mpage.waitForTimeout(700);
await mpage.evaluate(() => window.__ll.tutorial.skip());
await mpage.waitForTimeout(400);
await shot(mpage, '07-mobile.png');

await browser.close();
server.close();
console.log('done →', outDir);
