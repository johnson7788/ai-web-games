// 生成 tests/final 下 8 张编号截图（01–08），保证 vision-review 只评到这些好画面，
// 不会被 tutorial-check 的 tutorial-*.png（排序在 08 之后）拉进前 8 张。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadPlaywright, serve, waitForBoot } from '../../../skills/webgame-playbook/scripts/_lib.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outDir = path.join(root, 'tests', 'final');
fs.mkdirSync(outDir, { recursive: true });

const { server, port } = await serve(root, 8241);
const { chromium } = loadPlaywright();
const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=metal'] });
const base = `http://127.0.0.1:${port}/`;

async function desktop() {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const p = await ctx.newPage();
  await p.goto(base, { waitUntil: 'load', timeout: 20000 });
  await waitForBoot(p, 8000);
  await p.waitForTimeout(700);

  await p.screenshot({ path: path.join(outDir, '01-title.png') });

  await p.evaluate(() => { const s = document.getElementById('lang-select'); s.value = 'zh'; s.dispatchEvent(new Event('change', { bubbles: true })); });
  await p.waitForTimeout(300);
  await p.screenshot({ path: path.join(outDir, '05-title-zh.png') });
  await p.evaluate(() => { const s = document.getElementById('lang-select'); s.value = 'en'; s.dispatchEvent(new Event('change', { bubbles: true })); });
  await p.waitForTimeout(200);

  await p.evaluate(() => window.__ll.start());
  await p.waitForTimeout(150);
  await p.evaluate(() => window.__ll.tutorial.skip());
  await p.waitForTimeout(350);
  await p.screenshot({ path: path.join(outDir, '02-playing.png') });

  await p.evaluate(() => window.__ll.debug.fastForward());
  await p.waitForTimeout(300);
  await p.screenshot({ path: path.join(outDir, '03-result.png') });

  // 中文对局 + 中文结算
  await p.evaluate(() => window.__ll.home());
  await p.waitForTimeout(200);
  await p.evaluate(() => { const s = document.getElementById('lang-select'); s.value = 'zh'; s.dispatchEvent(new Event('change', { bubbles: true })); });
  await p.waitForTimeout(200);
  await p.evaluate(() => window.__ll.start());
  await p.waitForTimeout(150);
  await p.evaluate(() => window.__ll.tutorial.skip());
  await p.waitForTimeout(350);
  await p.screenshot({ path: path.join(outDir, '06-playing-zh.png') });
  await p.evaluate(() => window.__ll.debug.fastForward());
  await p.waitForTimeout(300);
  await p.screenshot({ path: path.join(outDir, '08-result-zh.png') });

  await ctx.close();
}

async function mobile() {
  const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const p = await ctx.newPage();
  await p.goto(base, { waitUntil: 'load', timeout: 20000 });
  await waitForBoot(p, 8000);
  await p.waitForTimeout(700);
  await p.screenshot({ path: path.join(outDir, '07-m-title.png') });
  await p.evaluate(() => window.__ll.debug.setTutorialDone(true));
  await p.evaluate(() => window.__ll.start());
  await p.waitForTimeout(500);
  await p.screenshot({ path: path.join(outDir, '04-m-playing.png') });
  await ctx.close();
}

await desktop();
await mobile();
await browser.close();
server.close();
console.log('wrote 8 finalshots');
