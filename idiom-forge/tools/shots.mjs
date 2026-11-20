// tools/shots.mjs — 产出 tests/final/ 的验收截图（标题 / 玩法 / 中文 / 铸兵 / 字谜 / 结算 / 移动端）。
// 只从真实运行截图；不写 tutorial 截图进 tests/final（vision-review 只扫前 8 张，纯菜单会拉低剪影均分）。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadPlaywright, serve, waitForBoot } from '../../../skills/webgame-playbook/scripts/_lib.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const OUT = path.join(ROOT, 'tests', 'final');
fs.mkdirSync(OUT, { recursive: true });

const { server, port } = await serve(ROOT, 8260);
const baseUrl = `http://127.0.0.1:${port}/`;
const { chromium } = loadPlaywright();
const browser = await chromium.launch({
  headless: true,
  args: ['--use-gl=angle', '--use-angle=metal', '--autoplay-policy=no-user-gesture-required'],
});
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitTitle(page) {
  await waitForBoot(page, 12000);
  await page.waitForFunction(
    () => window.__ll && window.__ll.state.phase !== 'boot' && document.getElementById('loading').classList.contains('hidden'),
    { timeout: 12000 },
  ).catch(() => {});
  await page.waitForTimeout(400);
}

async function shot(page, name) {
  await page.screenshot({ path: path.join(OUT, name), animations: 'disabled' });
}

// 桌面流程
{
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();
  await page.goto(baseUrl, { waitUntil: 'load', timeout: 30000 });
  await waitTitle(page);
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'load' });
  await waitTitle(page);
  await shot(page, '01-title.png');

  await page.click('#btn-start');
  await sleep(700);
  await page.click('[data-tutorial-skip]');
  await sleep(400);
  await shot(page, '02-play.png');

  // 中文
  await page.evaluate(() => {
    const s = document.getElementById('lang-select');
    s.value = 'zh';
    s.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await sleep(300);
  await shot(page, '03-play-zh.png');
  await page.evaluate(() => {
    const s = document.getElementById('lang-select');
    s.value = 'en';
    s.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await sleep(200);

  // 铸兵：解掉 5 题触发 forge，再显式喷一件兵器剪影
  await page.evaluate(() => {
    const r = window.G.run;
    let guard = 0;
    while (r.weaponsForged < 1 && r.phase === 'playing' && guard < 60) {
      const h = r.getHud();
      const q = h.question;
      const want = q.answer[q.blanks[h.currentBlank]];
      const gi = h.grid.indexOf(want);
      r.step({ pick: gi });
      r.drainEvents();
      guard += 1;
    }
    if (r.weaponsForged >= 1) window.G.renderer.forge(r.weapons[r.weapons.length - 1]);
  });
  await sleep(450);
  await shot(page, '04-forge.png');

  // 字谜：推进直到出现 riddle 题
  await page.evaluate(() => {
    const r = window.G.run;
    let guard = 0;
    while (!r.question.riddle && r.phase === 'playing' && guard < 60) {
      const h = r.getHud();
      const q = h.question;
      const want = q.answer[q.blanks[h.currentBlank]];
      const gi = h.grid.indexOf(want);
      r.step({ pick: gi });
      r.drainEvents();
      guard += 1;
    }
  });
  await sleep(350);
  await shot(page, '05-riddle.png');

  // 结算：时间耗尽
  await page.evaluate(() => {
    const r = window.G.run;
    for (let k = 0; k < 60 * 200 && r.phase === 'playing'; k += 1) {
      r.step({});
      r.drainEvents();
    }
  });
  await sleep(700);
  await shot(page, '06-result.png');
  await context.close();
}

// 移动端
{
  const context = await browser.newContext({
    viewport: { width: 844, height: 390 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  const page = await context.newPage();
  await page.goto(baseUrl, { waitUntil: 'load', timeout: 30000 });
  await waitTitle(page);
  await page.click('#btn-start');
  await sleep(800);
  await page.click('[data-tutorial-skip]');
  await sleep(400);
  await shot(page, '07-mobile.png');
  await context.close();
}

await browser.close();
server.close();
console.log('shots written to', OUT);
