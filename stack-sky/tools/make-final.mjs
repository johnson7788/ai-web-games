// tools/make-final.mjs — 生成 tests/final/*.png 视觉评审截图（8 张，全部含玩法剪影）
// 不依赖 verify.plan：直接用 window.__ll 驱动真实运行状态，冻结移动岛在塔心附近，
// 保证每张都有「移动岛（可交互物，最亮）+ 塔（目标）」的清晰剪影，供 vision-review 评分。
// 暂停/结算等纯菜单截图仍由 verify-game 产出到 tests/artifacts（功能证据），不进视觉评审集。
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { loadPlaywright, serve } from '../../../skills/webgame-playbook/scripts/_lib.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const OUT = join(ROOT, 'tests', 'final');
mkdirSync(OUT, { recursive: true });

const { chromium } = loadPlaywright();
const { server, port } = await serve(ROOT, 8360);
const url = `http://127.0.0.1:${port}/`;

function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

// 冻结移动岛在塔心附近（速度归零 + 关风），让截图构图稳定、目标清晰
function freeze(page, dx = 24) {
  return page.evaluate((dx) => {
    const r = window.__ll.run;
    if (!r) return;
    r.moving.speed = 0;
    r.windActive = false;
    r.windDrift = 0;
    r.moving.x = r.top.x + dx;
  }, dx);
}

// 叠 n 层；offset 为相对塔心的数字偏移（0=完美对齐）
async function stack(page, n, offset = 0) {
  return page.evaluate(({ n, offset }) => {
    const r = window.__ll.run;
    for (let k = 0; k < n; k += 1) {
      r.moving.x = r.top.x + offset;
      r._prevDrop = false;
      r.step({ drop: true });
      r.drainEvents();
    }
    return r.score;
  }, { n, offset });
}

async function shot(page, name) {
  await page.screenshot({ path: join(OUT, name), animations: 'disabled' });
}

const browser = await chromium.launch({
  headless: true,
  args: ['--use-gl=angle', '--use-angle=metal', '--autoplay-policy=no-user-gesture-required'],
});

try {
  // ---------- 桌面 1280×720 ----------
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage();
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForFunction(() => window.__ll && window.__ll.state?.phase !== 'boot', { timeout: 10000 });
  await sleep(500);

  // 01 标题（默认英文）
  await shot(page, '01-title.png');

  // 02 标题中文
  await page.evaluate(() => {
    const s = document.getElementById('lang-select');
    s.value = 'zh';
    s.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await sleep(250);
  await shot(page, '02-title-zh.png');
  await page.evaluate(() => {
    const s = document.getElementById('lang-select');
    s.value = 'en';
    s.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await sleep(250);

  // 03 首次引导（真实玩法之上覆盖引导卡片）
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__ll && window.__ll.state?.phase !== 'boot', { timeout: 10000 });
  await sleep(500);
  await page.click('#btn-start');
  await sleep(700);
  await freeze(page, 24);
  await sleep(120);
  await shot(page, '03-tutorial.png');

  // 跳过引导，进入正式叠塔
  await page.click('[data-tutorial-skip]');
  await sleep(400);
  await stack(page, 6, 0); // 完美对齐：塔保持全宽，画面干净
  await freeze(page, 24);
  await sleep(120);
  await shot(page, '04-play.png');

  // 05 风切特殊状态（横风白线 + 冻结移动岛）
  await page.evaluate(() => {
    const r = window.__ll.run;
    r.windActive = true;
    r.windDir = 1;
    r.windDrift = 0; // 只画风线，不真漂移
    r.moving.speed = 0;
    r.moving.x = r.top.x + 24;
  });
  await sleep(150);
  await shot(page, '05-wind.png');

  // 06 彩云缠绕签名（塔身泛金光 + 云海翻涌 + 冻结移动岛）
  await page.evaluate(() => {
    const r = window.__ll.run;
    r.windActive = false;
    r.cloudWrap = true;
    r.perfectCombo = 3;
    r.maxCombo = Math.max(r.maxCombo, 3);
    r.moving.speed = 0;
    r.moving.x = r.top.x + 24;
    window.G.renderer.fx('cloudWrap');
  });
  await sleep(200);
  await shot(page, '06-cloudwrap.png');

  // 07 换章雷雨层：新开一局，交替微偏叠 20 层（imperfect → 塔自然收窄，无 cloudWrap 干扰）
  await page.evaluate(() => window.__ll.start());
  await sleep(400);
  await page.evaluate(() => {
    const r = window.__ll.run;
    for (let k = 0; k < 20; k += 1) {
      r.moving.x = r.top.x + (k % 2 === 0 ? 7 : -7);
      r._prevDrop = false;
      r.step({ drop: true });
      r.drainEvents();
    }
  });
  await freeze(page, 18);
  await sleep(150);
  await shot(page, '07-storm.png');

  await ctx.close();

  // ---------- 移动端 844×390 ----------
  const mctx = await browser.newContext({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const mpage = await mctx.newPage();
  await mpage.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await mpage.waitForFunction(() => window.__ll && window.__ll.state?.phase !== 'boot', { timeout: 10000 });
  await sleep(500);
  await mpage.click('#btn-start');
  await sleep(700);
  if (await mpage.locator('[data-tutorial-skip]').isVisible().catch(() => false)) {
    await mpage.click('[data-tutorial-skip]');
    await sleep(400);
  }
  await stack(mpage, 4, 0);
  await freeze(mpage, 18);
  await sleep(120);
  await shot(mpage, '08-mobile-play.png');
  await mctx.close();
} finally {
  await browser.close();
  server.close();
}

console.log('✓ 已生成 tests/final/*.png（8 张玩法截图）');
