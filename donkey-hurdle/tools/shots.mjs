// tools/shots.mjs — 生成验收截图 tests/final/*.png（供 vision-review / report 用）
// 冻结运行（暂停后隐藏暂停遮罩，只留纯玩法画面），受控摆放障碍/场景，截 8 张。
import { mkdirSync, readFileSync, existsSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const OUT = join(ROOT, 'tests', 'final');

function loadPlaywright() {
  for (const c of ['playwright', '/opt/homebrew/lib/node_modules/playwright', '/Users/admin/.npm-global/lib/node_modules/playwright']) {
    try { return require(c); } catch { /* next */ }
  }
  throw new Error('playwright not found');
}

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.json': 'application/json' };
function serve(root, port) {
  const srv = createServer((req, res) => {
    let f = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (f === '/' || f.endsWith('/')) f += 'index.html';
    const target = join(root, f);
    if (!existsSync(target)) { res.writeHead(404).end(); return; }
    res.writeHead(200, { 'content-type': MIME[target.slice(target.lastIndexOf('.'))] || 'application/octet-stream' });
    res.end(readFileSync(target));
  });
  return new Promise((resolve) => srv.listen(port, '127.0.0.1', () => resolve(srv)));
}

const W = { GROUND_Y: 560, PLAYER_X: 240, PXM: 50 };

const SCENES = [
  { file: '01-play-dawn.png', scene: 'dawn', seg: 1, jars: 5, y: W.GROUND_Y, obstacles: [{ type: 'low', x: 520, w: 34, h: 26 }, { type: 'low', x: 720, w: 34, h: 26 }], pickup: { x: 620, y: 543 } },
  { file: '02-jump-hurdle.png', scene: 'dawn', seg: 1, jars: 5, y: W.GROUND_Y - 130, obstacles: [{ type: 'low', x: 260, w: 34, h: 26 }, { type: 'low', x: 560, w: 34, h: 26 }], pickup: { x: 480, y: 543 } },
  { file: '03-high-wall.png', scene: 'dawn', seg: 3, jars: 4, y: W.GROUND_Y - 165, obstacles: [{ type: 'high', x: 300, w: 34, h: 104 }], pickup: { x: 620, y: 543 } },
  { file: '04-pit.png', scene: 'dawn', seg: 2, jars: 3, y: W.GROUND_Y, obstacles: [{ type: 'pit', x: 430, w: 110, h: 0 }, { type: 'low', x: 760, w: 34, h: 26 }], pickup: { x: 620, y: 543 } },
  { file: '05-oasis.png', scene: 'oasis', seg: 5, jars: 5, y: W.GROUND_Y, obstacles: [{ type: 'low', x: 620, w: 34, h: 26 }, { type: 'low', x: 860, w: 34, h: 26 }], pickup: { x: 430, y: 500 } },
  { file: '06-night.png', scene: 'night', seg: 9, jars: 4, y: W.GROUND_Y - 100, obstacles: [{ type: 'high', x: 320, w: 34, h: 104 }, { type: 'rock', x: 720, w: 54, h: 54 }], pickup: { x: 520, y: 460 } },
];

async function setup(page, s) {
  await page.evaluate(({ s, W }) => {
    const r = window.__ll.run;
    r.distPx = s.seg * 1000;
    r.distance = r.distPx / W.PXM;
    r.scene = s.scene;
    r.segment = s.seg;
    r.jars = s.jars;
    r.player.y = s.y;
    r.player.vy = 0;
    r.player.onGround = s.y >= W.GROUND_Y - 2;
    r.obstacles = s.obstacles.map((o, i) => ({ id: 900 + i, type: o.type, worldX: r.distPx + o.x, w: o.w, h: o.h, extraSpeed: 1, cleared: false, hit: false, minClearance: Infinity }));
    r.pickups = s.pickup ? [{ id: 990, worldX: r.distPx + s.pickup.x, y: s.pickup.y }] : [];
    window.G.renderer.draw(r, 1);
    // 显示 HUD（距离/陶罐/路段文案），给画面可读信息
    const hudEl = document.getElementById('hud');
    if (hudEl) hudEl.classList.remove('hidden');
    window.__ll.ui().setHud(r.getHud());
  }, { s, W });
  await page.waitForTimeout(60);
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const { chromium } = loadPlaywright();
  const srv = await serve(ROOT, 8150);
  const base = 'http://127.0.0.1:8150/';
  const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=metal'] });

  // ---- 桌面 ----
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage();
  await page.goto(base, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__ll && window.__ll.state.phase !== 'boot', { timeout: 10000 });
  await page.waitForTimeout(400);
  await page.click('#btn-start');
  await page.waitForTimeout(400);
  await page.evaluate(() => { if (window.__ll.tutorial.active) window.__ll.tutorial.skip(); });
  await page.waitForTimeout(200);
  // 冻结 + 隐藏暂停遮罩（只留纯玩法画面，不受玻璃模糊影响 silhouette）
  await page.evaluate(() => { window.__ll.pause(); });
  await page.evaluate(() => { document.getElementById('screen-pause').classList.add('hidden'); });
  await page.waitForTimeout(150);

  for (const s of SCENES) {
    await setup(page, s);
    await page.screenshot({ path: join(OUT, s.file) });
  }

  // 结算卡：真实死亡
  await page.evaluate(() => window.__ll.start());
  await page.waitForTimeout(400);
  await page.evaluate(() => { if (window.__ll.tutorial.active) window.__ll.tutorial.skip(); });
  await page.evaluate(() => { const r = window.__ll.run; for (let k = 0; k < 60 * 400 && r.phase === 'playing'; k++) { r.step({ jump: false, dropJump: false }); r.drainEvents(); } });
  await page.waitForTimeout(700);
  await page.screenshot({ path: join(OUT, '07-result.png') });
  await ctx.close();

  // ---- 移动端（同样冻结 + 隐藏遮罩 + 受控障碍） ----
  const mctx = await browser.newContext({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
  const mp = await mctx.newPage();
  await mp.goto(base, { waitUntil: 'load' });
  await mp.waitForFunction(() => window.__ll && window.__ll.state.phase !== 'boot', { timeout: 10000 });
  await mp.waitForTimeout(400);
  await mp.click('#btn-start');
  await mp.waitForTimeout(400);
  await mp.evaluate(() => { if (window.__ll.tutorial.active) window.__ll.tutorial.skip(); });
  await mp.evaluate(() => { window.__ll.pause(); });
  await mp.evaluate(() => { document.getElementById('screen-pause').classList.add('hidden'); });
  await mp.waitForTimeout(120);
  await setup(mp, { scene: 'dawn', seg: 1, jars: 3, y: W.GROUND_Y, obstacles: [{ type: 'pit', x: 560, w: 110, h: 0 }], pickup: { x: 400, y: 500 } });
  await mp.screenshot({ path: join(OUT, '08-mobile.png') });
  await mctx.close();

  await browser.close();
  srv.close();
  console.log('shots written to', OUT);
}

main().catch((e) => { console.error(e); process.exit(1); });
