// HAPPY CHICK HOP · 生成 vision-review 用 8 张「真实运行中的玩法剪影」截图。
// 关键：全是 gameplay 状态（标题/结算纯菜单不进这里，避免 silhouette 被拉低）；
//       每张都保证「手持对象最亮 + 顶部 HUD 的 GOAL 金鸡 + 目标脉冲环」。
// 运行：node tools/make-final.mjs（自动起服务用完即关，端口 8220+ 自增）
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadPlaywright, serve } from '../../../skills/webgame-playbook/scripts/_lib.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'tests', 'final');
fs.mkdirSync(OUT, { recursive: true });

const { server, port } = await serve(ROOT, 8220);
const { chromium } = loadPlaywright();
const browser = await chromium.launch({
  headless: true,
  args: ['--use-gl=angle', '--use-angle=metal', '--autoplay-policy=no-user-gesture-required'],
});

async function newPage(opts = {}) {
  const context = await browser.newContext({
    viewport: { width: opts.w || 1280, height: opts.h || 720 },
    deviceScaleFactor: opts.mobile ? 2 : 1,
    isMobile: !!opts.mobile,
    hasTouch: !!opts.mobile,
  });
  const page = await context.newPage();
  await page.goto(`http://127.0.0.1:${port}/${opts.query ? `?${opts.query}` : ''}`, { waitUntil: 'load', timeout: 20000 });
  await page.waitForFunction(() => typeof window.__ll !== 'undefined', { timeout: 15000 }).catch(() => {});
  await page.waitForFunction(() => window.__ll && window.__ll.state?.phase !== 'boot', { timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(400);
  return { context, page };
}

async function shot(page, name) {
  await page.screenshot({ path: path.join(OUT, name), animations: 'disabled', timeout: 15000 });
  console.log(`· ${name}`);
}

// 页面内辅助：跳过教程后开局，往中间偏左的落点撒 N 只，等堆稳定。
const START = `(() => {
  window.__ll.debug.setTutorialDone(true);
  window.__ll.start();
  return true;
})()`;
const DROP = (x) => `window.__ll.debug.drop(${x})`;
const WAIT = (ms) => new Promise((r) => setTimeout(r, ms));

async function settle(page, ms = 900) {
  await WAIT(ms);
}

// ---- 桌面 1280×720 ----
{
  const { context, page } = await newPage();
  await page.evaluate(START);

  // 01：开局，手持蛋 + 瞄准线 + GOAL 金鸡 pill
  await WAIT(300);
  await shot(page, '01-aim.png');

  // 撒几只，保证场上有同阶可合并对象 → 目标环可见
  await page.evaluate(DROP(200)); await settle(page, 500);
  await page.evaluate(DROP(360)); await settle(page, 500);
  await page.evaluate(DROP(520)); await settle(page, 500);
  await shot(page, '02-merge-field.png');

  // 更多对象，堆起来（目标环 + 更多剪影）
  await page.evaluate(DROP(260)); await settle(page, 450);
  await page.evaluate(DROP(460)); await settle(page, 450);
  await page.evaluate(DROP(320)); await settle(page, 450);
  await shot(page, '03-pile.png');

  // 继续堆，逼近红线前的高堆状态（第 7 次投放是岩石）
  for (let i = 0; i < 6; i += 1) { await page.evaluate(DROP(240 + (i % 4) * 80)); await settle(page, 350); }
  await shot(page, '04-crowded.png');

  await context.close();
}

// ---- 桌面 · 中文 ----
{
  const { context, page } = await newPage({ query: 'lang=zh' });
  await page.evaluate(START);
  await page.evaluate(DROP(200)); await settle(page, 500);
  await page.evaluate(DROP(360)); await settle(page, 500);
  await page.evaluate(DROP(520)); await settle(page, 500);
  await shot(page, '05-zh.png');
  await context.close();
}

// ---- 桌面 · 触发一次合并（粒子爆点）----
{
  const { context, page } = await newPage();
  await page.evaluate(START);
  // 让两只同阶贴一起触发合并：反复在同列投，靠物理让同类相撞
  for (let i = 0; i < 8; i += 1) { await page.evaluate(DROP(340)); await settle(page, 380); }
  await shot(page, '06-merging.png');
  await context.close();
}

// ---- 桌面 · 石头上场（第 7 次投放）----
{
  const { context, page } = await newPage();
  await page.evaluate(START);
  for (let i = 0; i < 8; i += 1) { await page.evaluate(DROP(180 + (i % 3) * 120)); await settle(page, 350); }
  await shot(page, '07-rocks.png');
  await context.close();
}

// ---- 移动端 844×390 ----
{
  const { context, page } = await newPage({ mobile: true, w: 844, h: 390 });
  await page.evaluate(START);
  await page.evaluate(DROP(300)); await settle(page, 500);
  await page.evaluate(DROP(420)); await settle(page, 500);
  await shot(page, '08-mobile.png');
  await context.close();
}

// ---- 海报：清爽的玩法帧（手持 + 目标环 + GOAL 金鸡）----
{
  const { context, page } = await newPage();
  await page.evaluate(START);
  await page.evaluate(DROP(240)); await settle(page, 480);
  await page.evaluate(DROP(400)); await settle(page, 480);
  await page.evaluate(DROP(320)); await settle(page, 480);
  await page.evaluate(DROP(480)); await settle(page, 480);
  await page.screenshot({ path: path.join(ROOT, 'poster.jpg'), type: 'jpeg', quality: 92, animations: 'disabled', timeout: 15000 });
  console.log('· poster.jpg');
  await context.close();
}

await browser.close();
server.close();
console.log(`done → ${OUT}`);
