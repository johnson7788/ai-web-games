// tools/make-final.mjs — 生成 tests/final/*.png（8 张含玩法剪影的验收截图）
// 用途：vision-review 只扫 tests/final 前 8 张；这里只放「含主体/目标」的截图（标题/玩法/Boss/换场景/移动端）。
// 纯菜单（暂停/结算）截图留给 verify-game 的 tests/artifacts，不污染 vision-review。
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import pw from '/opt/homebrew/lib/node_modules/playwright/index.js';
const { chromium } = pw;

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.json': 'application/json' };
const server = createServer(async (req, res) => {
  try {
    const url = decodeURIComponent((req.url || '/').split('?')[0]);
    const file = join(ROOT, normalize(url === '/' ? 'index.html' : url));
    if (!file.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
    const data = await readFile(file);
    res.writeHead(200, { 'content-type': MIME[extname(file)] || 'application/octet-stream' });
    res.end(data);
  } catch { res.writeHead(404); res.end(); }
});
await new Promise((r) => server.listen(8150, r));

const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=metal', '--autoplay-policy=no-user-gesture-required'] });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitBoot(page) {
  await page.waitForFunction(() => window.__ll && window.__ll.state?.phase !== 'boot', { timeout: 15000 }).catch(() => {});
  await sleep(400);
}
async function shot(page, name) {
  await page.screenshot({ path: join(ROOT, 'tests/final', name) });
}

// ---- 桌面 ----
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await ctx.newPage();
await page.goto('http://127.0.0.1:8150/');
await waitBoot(page);

await shot(page, '01-title.png');

await page.evaluate(() => window.__ll.setLang('zh'));
await sleep(300);
await shot(page, '08-title-zh.png');
await page.evaluate(() => window.__ll.setLang('en'));
await sleep(200);

// 玩法：开局 + 跳过引导 + 等鱼
await page.click('#btn-start');
await sleep(700);
await page.click('[data-tutorial-skip]');
await sleep(2600);
await shot(page, '02-play.png');

// Boss：注入一条巨口鲨
await page.evaluate(() => {
  const r = window.__ll.run;
  r.fish.push({ id: 9999, species: 10, hp: 25, value: 300, radius: 52, speed: 22, boss: true, x: 640, y: 260, pathId: 2, path: null, seg: 0, travel: 0, phase: 0, sway: 0, delay: 0, alive: true });
});
await sleep(500);
await shot(page, '03-boss.png');

// 换场景包：深沟（第 5 场）/ 热泉（第 9 场）
await page.evaluate(() => window.__ll.debug.startStage(5));
await sleep(2200);
await shot(page, '04-scene2.png');

await page.evaluate(() => window.__ll.debug.startStage(9));
await sleep(2200);
await shot(page, '05-scene3.png');

// 电击网：充能满立即释放
await page.evaluate(() => window.__ll.debug.startStage(7));
await sleep(1600);
await page.evaluate(() => { const r = window.__ll.run; r.electricCharge = 1; r.step({ aimX: 640, aimY: 260, electric: true }); });
await sleep(450);
await shot(page, '06-electric.png');
await ctx.close();

// ---- 移动端 ----
const mctx = await browser.newContext({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
const mp = await mctx.newPage();
await mp.goto('http://127.0.0.1:8150/');
await waitBoot(mp);
await mp.click('#btn-start');
await sleep(700);
await mp.click('[data-tutorial-skip]');
await sleep(2200);
await shot(mp, '07-mobile.png');
await mctx.close();

await browser.close();
server.closeAllConnections?.();
server.close();
console.log('saved tests/final/*.png');
process.exit(0);
