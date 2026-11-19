// 生成 tests/final/ 的 8 张验收截图（数字前缀 01–08，排序永远在 tutorial-* 之前，
// 避免 tutorial-check 的截图拉低 vision-review 的 silhouette 均分）。
// 运行：node tools/scene-shots.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadPlaywright, serve, createErrorCollector, waitForBoot } from '../../../skills/webgame-playbook/scripts/_lib.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'tests', 'final');
fs.mkdirSync(OUT, { recursive: true });

const { server, port } = await serve(ROOT, 8260);
const { chromium } = loadPlaywright();
const browser = await chromium.launch({
  headless: true,
  args: ['--use-gl=angle', '--use-angle=metal', '--autoplay-policy=no-user-gesture-required'],
});
const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await context.newPage();
const collector = createErrorCollector();
collector.attach(page, port);
const url = `http://127.0.0.1:${port}/`;

const shot = async (name) => page.screenshot({ path: path.join(OUT, name) });
const setLang = (l) => page.evaluate((code) => {
  const s = document.getElementById('lang-select');
  s.value = code;
  s.dispatchEvent(new Event('change', { bubbles: true }));
}, l);
const climb = (n) => page.evaluate((k) => {
  for (let i = 0; i < k; i += 1) {
    const r = window.__ll.run;
    if (!r.state.alive) break;
    const next = r.peek(r.state.score + 1);
    const lane = next.barrier === -1 ? 1 : next.barrier === 1 ? 0 : r.state.lane;
    r.move(lane);
  }
}, n);

try {
  await page.goto(url, { waitUntil: 'load', timeout: 20000 });
  await waitForBoot(page, 10000);
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'domcontentloaded' });
  await waitForBoot(page, 10000);

  // 1 · 标题 EN
  await page.waitForTimeout(700);
  await shot('01-title.png');

  // 2 · 标题 ZH
  await setLang('zh');
  await page.waitForTimeout(250);
  await shot('02-title-zh.png');
  await setLang('en');
  await page.waitForTimeout(250);

  // 3 · 开局
  await page.evaluate(() => window.__ll.debug.setTutDone());
  await page.evaluate(() => window.__ll.start());
  await page.waitForTimeout(700);
  await shot('03-playing.png');

  // 4 · 攀爬几格（金币/星星/宝箱可见）
  await climb(5);
  await page.waitForTimeout(350);
  await shot('04-playing-climb.png');

  // 5 · 攀爬更多（速度上档，障碍更密）
  await climb(14);
  await page.waitForTimeout(350);
  await shot('05-playing-action.png');

  // 6 · 结算 EN
  await page.evaluate(() => window.__ll.debug.kill());
  await page.waitForTimeout(550);
  await shot('06-result.png');

  // 7 · 结算 ZH
  await setLang('zh');
  await page.evaluate(() => window.__ll.restart());
  await page.waitForTimeout(250);
  await page.evaluate(() => window.__ll.start());
  await page.waitForTimeout(500);
  await climb(6);
  await page.waitForTimeout(300);
  await page.evaluate(() => window.__ll.debug.kill());
  await page.waitForTimeout(550);
  await shot('07-result-zh.png');

  // 8 · 中文对局
  await page.evaluate(() => window.__ll.restart());
  await page.waitForTimeout(250);
  await page.evaluate(() => window.__ll.start());
  await page.waitForTimeout(600);
  await climb(8);
  await page.waitForTimeout(350);
  await shot('08-playing-zh.png');
} finally {
  await browser.close();
  server.close();
}

const errs = collector.toJSON();
console.log('screenshots →', path.relative(ROOT, OUT));
for (const n of fs.readdirSync(OUT).filter((f) => /\.png$/.test(f)).sort()) console.log('  -', n);
if (errs.consoleErrors.length || errs.pageErrors.length) {
  console.error(JSON.stringify(errs, null, 2));
  process.exit(1);
}
console.log('OK (0 console/page error)');
