// 生成验收用「纯战斗」截图（供 vision-review / poster 使用）：
//   1) tests/final/01-battle.png …（战斗画面，避免菜单截图拉低 silhouette 均分）
//   2) poster.jpg（1280×720 最美战斗画面）
// 运行：node tools/scene-shots.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadPlaywright, serve } from '../../../skills/webgame-playbook/scripts/_lib.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const FINAL = path.join(ROOT, 'tests', 'final');
fs.mkdirSync(FINAL, { recursive: true });
// 清掉 tests/final 里的旧截图，保证 vision-review 只看到「纯战斗」画面
for (const f of fs.readdirSync(FINAL)) {
  if (/\.(png|jpe?g)$/i.test(f)) fs.rmSync(path.join(FINAL, f));
}

const { chromium } = loadPlaywright();
const { server, port } = await serve(ROOT, 8220);
const url = `http://127.0.0.1:${port}/`;
const browser = await chromium.launch({
  headless: true,
  args: ['--use-gl=angle', '--use-angle=metal', '--autoplay-policy=no-user-gesture-required'],
});
const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await context.newPage();

async function boot() {
  await page.goto(url, { waitUntil: 'load', timeout: 20000 });
  await page.waitForFunction(() => typeof window.__ll !== 'undefined', { timeout: 15000 });
  await page.waitForFunction(() => window.__ll.state.phase !== 'boot', { timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(600);
}

async function battleShot(name, wave, waitMs = 3000, fireMs = 0) {
  await page.evaluate((w) => window.__ll.start(w), wave);
  await page.waitForTimeout(waitMs);
  if (fireMs > 0) {
    await page.mouse.move(640, 360);
    await page.mouse.down();
    await page.waitForTimeout(fireMs);
  }
  await page.screenshot({ path: path.join(FINAL, name) });
  if (fireMs > 0) await page.mouse.up();
}

await boot();
// 战斗截图不需要教程遮罩（真实玩家可在引导里跳过；这里先关掉以拍干净画面）
await page.evaluate(() => window.__ll.debug.setTutorialDone(true));
await battleShot('01-battle.png', 0, 3000, 0);
await battleShot('02-battle.png', 1, 3000, 0);
await battleShot('03-battle.png', 3, 3600, 0);

// 中文战斗画面（证明 zh 完整渲染）
await page.evaluate(() => window.__ll.ui().setLang('zh'));
await battleShot('04-battle-zh.png', 1, 3000, 0);
await page.evaluate(() => window.__ll.ui().setLang('en'));

// poster：火力全开的画面（敌人 + 子弹 + 基座），存到游戏根目录
await page.evaluate(() => window.__ll.start(3));
await page.waitForTimeout(3000);
await page.mouse.move(640, 360);
await page.mouse.down();
await page.waitForTimeout(500);
await page.screenshot({ path: path.join(ROOT, 'poster.jpg'), type: 'jpeg', quality: 90 });
await page.mouse.up();

await browser.close();
server.close();
console.log('screenshots written to tests/final/ and poster.jpg');
