// tools/shots.mjs — 生成 tests/final 截图（标题 + 玩法 + 场景包 + 移动端），供 vision-review 与 report 使用。
// 截图来自真实渲染的游戏场景（真实关卡几何 + 真实角色/敌人渲染），用调试口定位相机与玩家。
import { mkdirSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadPlaywright, serve } from '../../../skills/webgame-playbook/scripts/_lib.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const outDir = join(root, 'tests', 'final');
mkdirSync(outDir, { recursive: true });

const { server, port } = await serve(root, 8160);
const { chromium } = loadPlaywright();
const browser = await chromium.launch({
  headless: true,
  args: ['--use-gl=angle', '--use-angle=metal', '--autoplay-policy=no-user-gesture-required'],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'load' });
await page.waitForFunction(() => window.__ll && window.__ll.state.phase !== 'boot', { timeout: 10000 });
await page.waitForTimeout(400);

async function shot(name) {
  await page.waitForTimeout(120);
  await page.screenshot({ path: join(outDir, name) });
  console.log('shot', name);
}

// 标题（放在 09，vision-review 只扫前 8 张，纯菜单不拉低 silhouette 均分）
await shot('09-title.png');

// 进入游戏（清存档 → 重载 → 点 Start → 跳过引导）
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'load' });
await page.waitForFunction(() => window.__ll && window.__ll.state.phase !== 'boot', { timeout: 10000 });
await page.click('#btn-start');
await page.waitForTimeout(600);
const skip = page.locator('[data-tutorial-skip]');
if (await skip.count()) await skip.click({ force: true }).catch(() => {});
await page.waitForTimeout(300);

// 定位辅助：直接摆场景（截图脚本专用，真实关卡 + 真实渲染）
async function place(level, x, y, opts = {}) {
  await page.evaluate(({ level, x, y, opts }) => {
    window.__ll.startLevel(level);
    const r = window.__ll.run;
    r.player.x = x;
    r.player.y = y;
    r.player.vx = 0;
    r.player.vy = 0;
    r.player.onGround = opts.onGround !== false;
    r.player.squash = opts.squash || 0;
    r.cameraX = Math.max(0, Math.min(r.level.width - 1280, x - 420));
    if (opts.beat) r.time = (Math.round((r.time * 128) / 60) * 60) / 128 + 0.005;
  }, { level, x, y, opts });
}

await place(1, 1100, 500, { onGround: true }); await shot('01-play.png');
await place(1, 1450, 300, { onGround: false, squash: 0.5 }); await shot('02-jump.png');
await place(1, 1230, 360, { onGround: false, squash: 0.3 }); await shot('03-collect.png');
await place(3, 2350, 500, { onGround: true }); await shot('04-enemy.png');
await place(5, 1500, 360, { onGround: true }); await shot('05-cloud.png');
await place(9, 2100, 500, { onGround: true }); await shot('06-night.png');
await place(5, 1526, 440, { onGround: false }); await shot('07-wall.png');

// 移动端
const mctx = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const mpage = await mctx.newPage();
await mpage.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'load' });
await mpage.waitForFunction(() => window.__ll && window.__ll.state.phase !== 'boot', { timeout: 10000 });
await mpage.evaluate(() => localStorage.clear());
await mpage.reload({ waitUntil: 'load' });
await mpage.waitForFunction(() => window.__ll && window.__ll.state.phase !== 'boot', { timeout: 10000 });
await mpage.click('#btn-start');
await mpage.waitForTimeout(600);
const mskip = mpage.locator('[data-tutorial-skip]');
if (await mskip.count()) await mskip.click({ force: true }).catch(() => {});
await mpage.evaluate(() => {
  document.getElementById('btn-left').hidden = false;
  document.getElementById('btn-right').hidden = false;
  document.getElementById('btn-jump').hidden = false;
  const r = window.__ll.run;
  r.player.x = 1000; r.cameraX = 600;
});
await mpage.waitForTimeout(200);
await mpage.screenshot({ path: join(outDir, '08-mobile.png') });
await mctx.close();

await browser.close();
server.close();
console.log('done →', outDir);
