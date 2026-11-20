// tools/shots.mjs — 生成 tests/final 验收截图（全部为玩法画面，供 vision-review）。
// 覆盖：三套场景包（石殿/翡翠殿/熔岩殿）+ 三连符文 signature + 中文 + 移动端。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadPlaywright, serve, waitForBoot } from '../../../skills/webgame-playbook/scripts/_lib.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'tests', 'final');
fs.mkdirSync(OUT, { recursive: true });

const { server, port } = await serve(ROOT, 8390);
const { chromium } = loadPlaywright();
const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=metal', '--autoplay-policy=no-user-gesture-required'] });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function newPage(viewport) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: viewport[0] < 900 ? 2 : 1, isMobile: viewport[0] < 900, hasTouch: viewport[0] < 900 });
  const p = await ctx.newPage();
  return { ctx, p };
}

const { ctx, p } = await newPage({ width: 1280, height: 720 });
await p.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'load', timeout: 30000 });
await waitForBoot(p, 10000);
await p.evaluate(() => localStorage.clear());
await p.reload({ waitUntil: 'domcontentloaded' });
await waitForBoot(p, 10000);
await p.click('#btn-start');
await sleep(700);
await p.click('[data-tutorial-skip]');
await sleep(300);

async function rollShot(name) {
  await p.click('#btn-roll');
  await sleep(2100);
  await p.screenshot({ path: path.join(OUT, name) });
}

// 石殿（第 1 关）
await p.evaluate(() => window.__ll.run.jump(1));
await rollShot('01-play-stone.png');

// 翡翠殿（第 5 关）
await p.evaluate(() => window.__ll.run.jump(5));
await rollShot('02-play-jade.png');

// 熔岩殿（第 9 关）
await p.evaluate(() => window.__ll.run.jump(9));
await rollShot('03-play-lava.png');

// 三连符文 signature（第 3 关三骰同面）
await p.evaluate(() => { const r = window.__ll.run; r.jump(3); r.rng = () => 0; r.pot = 100; r.roll(); });
await sleep(700);
await p.screenshot({ path: path.join(OUT, '04-triple.png') });

// 中文玩法
await p.evaluate(() => { const s = document.getElementById('lang-select'); s.value = 'zh'; s.dispatchEvent(new Event('change', { bubbles: true })); });
await sleep(250);
await p.evaluate(() => { const r = window.__ll.run; r.jump(1); r.rng = null; });
// 恢复随机 rng（重新开始一局最干净）
await p.evaluate(() => window.__ll.start());
await sleep(300);
await p.evaluate(() => { const s = document.querySelector('#lang-select, #screen-title .lang-select'); if (s) { s.value = 'zh'; s.dispatchEvent(new Event('change', { bubbles: true })); } });
await sleep(250);
await p.click('#btn-roll');
await sleep(2100);
await p.screenshot({ path: path.join(OUT, '05-play-zh.png') });

// 移动端
await ctx.close();
const m = await newPage({ width: 844, height: 390 });
await m.p.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'load', timeout: 30000 });
await waitForBoot(m.p, 10000);
await m.p.click('#btn-start');
await sleep(700);
await m.p.click('[data-tutorial-skip]');
await sleep(300);
await m.p.click('#btn-roll');
await sleep(2100);
await m.p.screenshot({ path: path.join(OUT, '06-mobile.png') });
await m.ctx.close();

await ctx.close();
await browser.close();
server.close();
console.log('shots written to tests/final:');
for (const f of fs.readdirSync(OUT).sort()) console.log('  ' + f);
