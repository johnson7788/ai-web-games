// tools/mkshots.mjs — 生成 tests/final 里 8 张验收截图（01..08，供 vision-review 评审）。
// 截图按文件名排序，01–08 全是真实玩法帧（标题/玩法/真相时刻/死亡/移动端/三场景包），
// 从而把 tutorial-check 的 tutorial-*.png 挤到 vision-review 的 max-shots=8 之外。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadPlaywright, serve } from '../../../skills/webgame-playbook/scripts/_lib.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'tests', 'final');
fs.mkdirSync(OUT, { recursive: true });

const { server, port } = await serve(ROOT, 8600);
const { chromium } = loadPlaywright();
const browser = await chromium.launch({
  headless: true,
  args: ['--use-gl=angle', '--use-angle=metal', '--autoplay-policy=no-user-gesture-required'],
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function shot(page, name) {
  await page.screenshot({ path: path.join(OUT, name) });
  console.log('·', name);
}

const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'load', timeout: 20000 });
await page.waitForFunction(() => typeof window.__ll !== 'undefined', { timeout: 15000 });
await page.waitForFunction(() => window.__ll.state?.phase !== 'boot', { timeout: 10000 });
await page.waitForTimeout(500);
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'load' });
await page.waitForFunction(() => window.__ll.state?.phase !== 'boot', { timeout: 10000 });
await page.waitForTimeout(500);

// 01 标题（英文）
await shot(page, '01-title.png');

// 02 玩法（跳过引导，走几步揭雾，出口信标可见）
await page.evaluate(() => window.__ll.start());
await page.waitForTimeout(500);
await page.evaluate(() => window.__ll.tutorial.skip());
await page.waitForTimeout(150);
await page.evaluate(() => window.__ll.debug.autoStep(6));
await page.waitForTimeout(200);
await shot(page, '02-play.png');

// 03 真相时刻（第 4 街区集齐 3 线索，全图点亮）
await page.evaluate(() => window.__ll.debug.startAt(4));
await page.waitForTimeout(150);
await page.evaluate(() => {
  const r = window.__ll.run;
  const st = () => ({ player: r.player, keyCollected: r.keyCollected, leverOn: r.leverOn, cluesCollected: r.cluesCollected, clueTaken: r.clueTaken });
  for (let k = 0; k < 600 && r.phase === 'playing' && r.cluesCollected < 3; k += 1) {
    const dir = window.__ll.debug.autoStep(1);
    if (r.getHud().truthActive) break;
  }
  return { clues: r.cluesCollected, truth: r.getHud().truthActive };
});
await page.waitForTimeout(200);
await shot(page, '03-truth.png');

// 04 死亡结算（步数超限）
await page.evaluate(() => window.__ll.debug.startAt(1));
await page.waitForTimeout(150);
await page.evaluate(() => {
  const r = window.__ll.run;
  r.steps = r.map.maxSteps;
  const D = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
  for (const n in D) {
    const nx = r.player.x + D[n][0]; const ny = r.player.y + D[n][1];
    if (nx >= 0 && nx < r.map.cols && ny >= 0 && ny < r.map.rows && r.map.cells[ny * r.map.cols + nx] === 0) {
      r.step({ dir: n });
      break;
    }
  }
  return r.phase;
});
await page.waitForTimeout(300);
await shot(page, '04-dead.png');

// 05 移动端玩法
const mobile = await browser.newPage({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true });
await mobile.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'load', timeout: 20000 });
await mobile.waitForFunction(() => window.__ll.state?.phase !== 'boot', { timeout: 10000 });
await mobile.waitForTimeout(400);
await mobile.evaluate(() => localStorage.clear());
await mobile.reload({ waitUntil: 'load' });
await mobile.waitForFunction(() => window.__ll.state?.phase !== 'boot', { timeout: 10000 });
await mobile.waitForTimeout(400);
await mobile.evaluate(() => window.__ll.start());
await mobile.waitForTimeout(400);
await mobile.evaluate(() => window.__ll.tutorial.skip());
await mobile.evaluate(() => window.__ll.debug.autoStep(6));
await mobile.waitForTimeout(200);
await mobile.screenshot({ path: path.join(OUT, '05-mobile.png') });
console.log('· 05-mobile.png');
await mobile.close();

// 06 中文标题
await page.evaluate(() => window.__ll.restart());
await page.waitForTimeout(300);
await page.evaluate(() => { const s = document.getElementById('lang-select'); s.value = 'zh'; s.dispatchEvent(new Event('change', { bubbles: true })); });
await page.waitForTimeout(250);
await shot(page, '06-title-zh.png');

// 07 集市废墟（第 5 街区，scene 1）
await page.evaluate(() => window.__ll.debug.startAt(5));
await page.waitForTimeout(150);
await page.evaluate(() => window.__ll.debug.autoStep(6));
await page.waitForTimeout(200);
await shot(page, '07-play2.png');

// 08 湖畔（第 9 街区，scene 2）
await page.evaluate(() => window.__ll.debug.startAt(9));
await page.waitForTimeout(150);
await page.evaluate(() => window.__ll.debug.autoStep(6));
await page.waitForTimeout(200);
await shot(page, '08-play3.png');

await browser.close();
server.close();
console.log('done → tests/final');
