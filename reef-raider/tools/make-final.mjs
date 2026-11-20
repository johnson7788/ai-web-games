// 生成 tests/final 的 8 张「玩法剪影」截图，供 vision-review.mjs 评审。
// 每张都有最亮的可交互物（炮台）+ 明确目标（鱼身上金币值标签 + HUD 目标分）。
// 纯菜单（暂停/结算不透明底）不进 tests/final，避免 silhouette 0 拉低均分。
// 用法：node tools/make-final.mjs
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mkdirSync } from 'node:fs';
import pw from '/opt/homebrew/lib/node_modules/playwright/index.js';
const { chromium } = pw;

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'tests', 'final');
mkdirSync(OUT, { recursive: true });
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
await new Promise((r) => server.listen(8161, r));

const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=metal'] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await ctx.newPage();
await page.goto('http://127.0.0.1:8161/');
await page.waitForTimeout(800);

async function shot(name) {
  await page.screenshot({ path: join(OUT, name) });
  console.log('shot', name);
}

// 01 标题屏（canvas 演示鱼 + 炮台，有主体剪影）
await shot('01-title.png');

// 02 玩法（L1 鱼群 + 炮台 + HUD）
await page.evaluate(() => {
  window.__ll.debug.setTutorialDone(true);
  window.__ll.debug.startSeeded(0, 3);
});
await page.waitForTimeout(1100);
await shot('02-playing.png');

// 03 命中：朝一条蝠鲼开火（子弹在飞 + 命中涟漪）
await page.evaluate(() => {
  window.__ll.debug.startSeeded(0, 3);
  const r = window.__ll.run();
  r.setPower(3);
  r.spawnFish('manta', 700, 320, 1);
  window.__ll.debug.fireAt(700, 320);
});
await page.waitForTimeout(520);
await shot('03-hit.png');

// 04 捕获：同步击杀一条海龟 → 灯影环绕（signature）
await page.evaluate(() => {
  window.__ll.debug.startSeeded(0, 3);
  const r = window.__ll.run();
  r.setPower(5);
  r.spawnFish('turtle', 640, 360, 1);
  const f = r.state.fish[r.state.fish.length - 1];
  let g = 2000;
  while (g-- > 0 && f.alive) {
    const dx = f.x - 640, dy = f.y - 668;
    r.fire(Math.atan2(dx, -dy));
    r.step(1 / 60);
  }
});
await shot('04-capture.png');

// 05 暗礁场景（L5）
await page.evaluate(() => window.__ll.debug.loadLevel(4));
await page.waitForTimeout(1100);
await shot('05-reef.png');

// 06 磷光夜海（L9 幽灵灯笼鱼）
await page.evaluate(() => window.__ll.debug.loadLevel(8));
await page.waitForTimeout(1100);
await shot('06-night.png');

// 07 终局灯笼鱼王（L12，王鱼显式放到画面中）
await page.evaluate(() => {
  window.__ll.debug.loadLevel(11);
  window.__ll.debug.spawnFish('king', 880, 300, 1);
  window.__ll.debug.spawnFish('manta', 420, 430, 1);
});
await page.waitForTimeout(900);
await shot('07-boss.png');

// 08 移动端玩法
await page.setViewportSize({ width: 844, height: 390 });
await page.evaluate(() => window.__ll.debug.startSeeded(0, 3));
await page.waitForTimeout(1100);
await shot('08-mobile.png');

await ctx.close();
await browser.close();
server.closeAllConnections?.();
server.close();
console.log('done →', OUT);
process.exit(0);
