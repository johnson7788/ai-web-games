// tools/make-screens.mjs — 生成 tests/final 的 8 张玩法截图（供 vision-review 评审）。
// 全部是真实对局状态（叫分/加倍/选牌/出牌/结算/移动端/中文），标题屏故意排在后面。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadPlaywright, serve } from '../../../skills/webgame-playbook/scripts/_lib.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const out = path.join(root, 'tests/final');
fs.mkdirSync(out, { recursive: true });

const { chromium } = loadPlaywright();
const { server, port } = await serve(root, 8400);
const url = `http://127.0.0.1:${port}/`;

const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=metal', '--autoplay-policy=no-user-gesture-required'] });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function act(input) {
  await page.evaluate((i) => window.__ll.act(i), input);
  await sleep(260);
}
async function shot(name) {
  await page.screenshot({ path: path.join(out, name), animations: 'disabled' });
}

await page.goto(url, { waitUntil: 'load' });
await page.waitForFunction(() => window.__ll && window.__ll.state.phase !== 'boot', { timeout: 10000 });
await sleep(400);

// 首次开始 + 跳过引导，进入真实对局
await page.click('#btn-start');
await sleep(600);
await page.click('[data-tutorial-skip]').catch(() => {});
await sleep(300);

// 01 叫分阶段
await shot('01-bidding.png');

// 叫 1 分
await act({ action: 'bid', bid: 1 });
// 02 加倍阶段（若被 AI 抢到地主，则为加倍；否则可能直接出牌）
await shot('02-doubling.png');
await act({ action: 'double', double: false });

// 03 出牌阶段（选好一手提示牌，目标清晰）
await page.evaluate(() => window.__ll.selectHint());
await sleep(240);
await shot('03-playing.png');

// 04 出一手后回到玩家回合并选牌
await act({ action: 'play' });
await humanTurnWithHint();
await shot('04-selected.png');

async function humanTurnWithHint() {
  await page.evaluate(() => {
    let g = 0;
    while (g < 400 && window.__ll.run && window.__ll.run.roundPhase === 'playing') {
      if (window.__ll.run.currentTurn === 0) break;
      window.__ll.act({ action: 'pass' });
      g += 1;
    }
    if (window.__ll.run && window.__ll.run.roundPhase === 'playing' && window.__ll.run.currentTurn === 0) {
      window.__ll.selectHint();
    }
  });
  await sleep(260);
}

// 05 出牌后（牌池里出现上一手，回到玩家回合并选好一手）
await act({ action: 'play' });
await humanTurnWithHint();
await shot('05-after-play.png');

// 06 打几手推进到中后期，再回到玩家回合选牌
for (let i = 0; i < 6; i += 1) {
  await page.evaluate(() => {
    const h = window.__ll.run && window.__ll.run.roundPhase === 'playing' ? window.__ll.run.hint() : null;
    if (h) window.__ll.act({ action: 'play', cards: h });
    else window.__ll.act({ action: 'pass' });
  });
  await sleep(220);
}
await humanTurnWithHint();
await shot('06-late.png');

// 07 中文界面（回到标题再开一局，避免结算干扰）
await page.evaluate(() => { const s = document.getElementById('lang-select'); if (s) { s.value = 'zh'; s.dispatchEvent(new Event('change', { bubbles: true })); } });
await sleep(300);
await shot('07-zh.png');

// 08 结算卡（打完本局）
await page.evaluate(() => {
  let g = 0;
  while (window.__ll.run && window.__ll.run.roundPhase !== 'done' && g < 400) {
    const h = window.__ll.run.hint();
    if (h) window.__ll.act({ action: 'play', cards: h });
    else window.__ll.act({ action: 'pass' });
    g += 1;
  }
});
await sleep(500);
await shot('08-result.png');

// 移动端截图（另存 09，避免进入前 8）
const mctx = await browser.newContext({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true });
const mp = await mctx.newPage();
await mp.goto(url, { waitUntil: 'load' });
await mp.waitForFunction(() => window.__ll && window.__ll.state.phase !== 'boot', { timeout: 10000 });
await sleep(400);
await mp.click('#btn-start');
await sleep(600);
await mp.click('[data-tutorial-skip]').catch(() => {});
await sleep(300);
await mp.screenshot({ path: path.join(out, '09-mobile.png'), animations: 'disabled' });
await mctx.close();

await browser.close();
server.close();
console.log('screenshots written to', out);
