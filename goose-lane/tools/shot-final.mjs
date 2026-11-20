// tools/shot-final.mjs — 产出 tests/final/*.png 验收截图（供 vision-review 评审）。
// 全部为真实玩法画面（无菜单），直接摆好 run 实体，保证收集物/障碍/闸机/三场景清晰可辨。
import { mkdirSync, readdirSync, unlinkSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('/opt/homebrew/lib/node_modules/playwright');
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const OUT = path.join(ROOT, 'tests', 'final');
mkdirSync(OUT, { recursive: true });
for (const f of readdirSync(OUT)) if (/\.png$/i.test(f)) unlinkSync(join(OUT, f));

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.png': 'image/png' };
const server = http.createServer((req, res) => {
  let f = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (f === '/' || f.endsWith('/')) f += 'index.html';
  const t = path.join(ROOT, f);
  fs.readFile(t, (e, d) => {
    if (e) { res.writeHead(404).end(); return; }
    res.writeHead(200, { 'content-type': MIME[path.extname(t)] || 'application/octet-stream' });
    res.end(d);
  });
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const serverPort = await new Promise((resolve) => { server.listen(8277, '127.0.0.1', () => resolve(8277)); });

const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=metal'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto(`http://127.0.0.1:${serverPort}/`, { waitUntil: 'load', timeout: 20000 });
await page.waitForFunction(() => window.__ll && window.__ll.state.phase !== 'boot', { timeout: 10000 });

const SETUP = `window.__setup = (opts) => {
  const r = window.__ll.run;
  r.sceneReached = opts.scene;
  r.stationReached = opts.station;
  r.distance = opts.distance;
  r.lane = opts.lane;
  r.laneX = [330, 640, 950][opts.lane];
  r.gems = opts.gems ?? 0;
  r.balloons = opts.balloons ?? 0;
  r.obstacles = opts.obstacles || [];
  r.pickups = opts.pickups || [];
  r.nextSpawnZ = opts.distance + 80;
  r.lastMile = Math.floor(opts.distance / 10);
};`;

await page.evaluate(SETUP);
await page.click('#btn-start');
await sleep(700);
await page.click('[data-tutorial-skip]');
await sleep(400);

async function shot(name, setup) {
  await page.evaluate(setup);
  await sleep(80);
  await page.screenshot({ path: join(OUT, name) });
}

// 01-morning：早高峰，宝石三车道 + 右道车
await shot('01-morning.png', () => window.__setup({
  scene: 1, distance: 20, station: 1, lane: 1, gems: 12, balloons: 0,
  obstacles: [{ kind: 'car', lane: 2, z: 11, resolved: false, dead: false }],
  pickups: [
    { kind: 'gem', lane: 0, z: 6, resolved: false, dead: false },
    { kind: 'gem', lane: 1, z: 8, resolved: false, dead: false },
    { kind: 'gem', lane: 2, z: 6, resolved: false, dead: false },
    { kind: 'balloon', lane: 2, z: 14, resolved: false, dead: false },
  ],
}));

// 02-obstacles：车 + 坑 + 气球护身 + 安全道宝石
await shot('02-obstacles.png', () => window.__setup({
  scene: 1, distance: 40, station: 1, lane: 0, gems: 23, balloons: 1,
  obstacles: [
    { kind: 'car', lane: 1, z: 8, resolved: false, dead: false },
    { kind: 'pit', lane: 2, z: 8, resolved: false, dead: false },
    { kind: 'car', lane: 2, z: 20, resolved: false, dead: false },
  ],
  pickups: [
    { kind: 'gem', lane: 0, z: 6, resolved: false, dead: false },
    { kind: 'gem', lane: 0, z: 14, resolved: false, dead: false },
    { kind: 'balloon', lane: 0, z: 18, resolved: false, dead: false },
  ],
}));

// 03-afternoon：午后（青），车流 + 宝石
await shot('03-afternoon.png', () => window.__setup({
  scene: 2, distance: 300, station: 6, lane: 2, gems: 31, balloons: 1,
  obstacles: [
    { kind: 'car', lane: 0, z: 7, resolved: false, dead: false },
    { kind: 'car', lane: 1, z: 9, resolved: false, dead: false },
  ],
  pickups: [
    { kind: 'gem', lane: 2, z: 6, resolved: false, dead: false },
    { kind: 'gem', lane: 2, z: 13, resolved: false, dead: false },
    { kind: 'balloon', lane: 2, z: 17, resolved: false, dead: false },
  ],
}));

// 04-gate：红灯闸机 + 前方宝石（节奏打破器）
await shot('04-gate.png', () => window.__setup({
  scene: 1, distance: 200, station: 4, lane: 1, gems: 18, balloons: 1,
  obstacles: [
    { kind: 'gate', lane: null, z: 9, state: 'red', progress: 0, resolved: false, dead: false },
  ],
  pickups: [
    { kind: 'gem', lane: 1, z: 5, resolved: false, dead: false },
    { kind: 'gem', lane: 0, z: 6, resolved: false, dead: false },
  ],
}));

// 05-night：夜班霓虹 + 绿灯闸机 + 逆行外卖车
await shot('05-night.png', () => window.__setup({
  scene: 3, distance: 490, station: 9, lane: 1, gems: 41, balloons: 2,
  obstacles: [
    { kind: 'car', lane: 0, z: 8, resolved: false, dead: false },
    { kind: 'reverse', lane: 2, z: 10, resolved: false, dead: false },
    { kind: 'gate', lane: null, z: 19, state: 'green', progress: 1, resolved: false, dead: false },
  ],
  pickups: [
    { kind: 'gem', lane: 1, z: 6, resolved: false, dead: false },
    { kind: 'gem', lane: 1, z: 12, resolved: false, dead: false },
    { kind: 'balloon', lane: 1, z: 16, resolved: false, dead: false },
  ],
}));

// 06-mobile：844×390 横屏触屏玩法
const mpage = await browser.newPage({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
await mpage.goto(`http://127.0.0.1:${serverPort}/`, { waitUntil: 'load', timeout: 20000 });
await mpage.waitForFunction(() => window.__ll && window.__ll.state.phase !== 'boot', { timeout: 10000 });
await mpage.evaluate(SETUP);
await mpage.click('#btn-start');
await sleep(700);
await mpage.click('[data-tutorial-skip]');
await sleep(300);
await mpage.evaluate(() => window.__setup({
  scene: 1, distance: 15, station: 1, lane: 1, gems: 6, balloons: 1,
  obstacles: [{ kind: 'car', lane: 0, z: 10, resolved: false, dead: false }],
  pickups: [
    { kind: 'gem', lane: 1, z: 6, resolved: false, dead: false },
    { kind: 'gem', lane: 2, z: 7, resolved: false, dead: false },
    { kind: 'balloon', lane: 1, z: 13, resolved: false, dead: false },
  ],
}));
await sleep(80);
await mpage.screenshot({ path: join(OUT, '06-mobile.png') });

await browser.close();
server.close();
console.log('final screenshots written to tests/final/');
