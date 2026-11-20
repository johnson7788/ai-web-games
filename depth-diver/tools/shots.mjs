// 生成 tests/final/*.png（vision-review 用）：真实运行 + 确定性注入实体，保证每张都
// 有清晰潜航器/样本/障碍，且命名排序让前 8 张以玩法画面为主（只有 1 张标题 + 1 张结算）。
// 用法：node tools/shots.mjs
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { mkdirSync } from 'node:fs';
import { extname, join, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import pw from '/opt/homebrew/lib/node_modules/playwright/index.js';
const { chromium } = pw;

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'tests', 'final');
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
await new Promise((r) => server.listen(8146, r));

const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=metal', '--autoplay-policy=no-user-gesture-required'] });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 })).newPage();
page.on('pageerror', (e) => console.error('PAGEERROR', e.message));
await page.goto('http://127.0.0.1:8146/', { waitUntil: 'load' });
await page.waitForTimeout(700);
await page.evaluate(() => window.__ll.debug.setTutorialDone(true));
mkdirSync(OUT, { recursive: true });

// 确定性注入一个可读的玩法场景（真实 run.state，只改实体与位置，不步进）
function stage(level, scene) {
  return page.evaluate(({ level, scene }) => {
    window.__ll.debug.startSeeded(level, 5);
    const st = window.__ll.run().state;
    st.player.x = 560; st.player.y = 300;
    st.pickups = scene.pickups;
    st.obstacles = scene.obstacles;
    st.vents = scene.vents || [];
    st.chaser = scene.chaser || null;
    st.lightRadius = scene.lightRadius ?? st.lightRadius;
  }, { level, scene });
}

const SUNLIT_ROCKS = {
  pickups: [
    { kind: 'sample', x: 420, y: 470, r: 22, taken: false },
    { kind: 'sample', x: 960, y: 560, r: 22, taken: false },
  ],
  obstacles: [
    { kind: 'rock', x: 600, y: 520, r: 58, passed: false },
    { kind: 'rock', x: 820, y: 640, r: 64, passed: false },
  ],
};
const SAMPLES = {
  pickups: [
    { kind: 'sample', x: 380, y: 480, r: 22, taken: false },
    { kind: 'sample', x: 780, y: 430, r: 22, taken: false },
    { kind: 'sample', x: 1000, y: 570, r: 22, taken: false },
    { kind: 'oxygen', x: 620, y: 560, r: 20, taken: false },
  ],
  obstacles: [{ kind: 'rock', x: 460, y: 620, r: 56, passed: false }],
};
const MINES = {
  pickups: [{ kind: 'sample', x: 620, y: 480, r: 22, taken: false }],
  obstacles: [
    { kind: 'mine', x: 360, y: 520, r: 24, passed: false },
    { kind: 'mine', x: 880, y: 560, r: 24, passed: false },
    { kind: 'mine', x: 520, y: 640, r: 24, passed: false },
  ],
};
const TWILIGHT = {
  pickups: [
    { kind: 'sample', x: 420, y: 440, r: 22, taken: false },
    { kind: 'sample', x: 700, y: 470, r: 22, taken: false },
    { kind: 'sample', x: 980, y: 430, r: 22, taken: false },
    { kind: 'sample', x: 900, y: 560, r: 22, taken: false },
  ],
  obstacles: [
    { kind: 'rock', x: 560, y: 560, r: 58, passed: false },
    { kind: 'rock', x: 820, y: 660, r: 66, passed: false },
  ],
  vents: [{ kind: 'vent', x: 760, y: 500, w: 92, h: 300, entered: false }],
};
const ABYSS = {
  pickups: [
    { kind: 'sample', x: 380, y: 440, r: 22, taken: false },
    { kind: 'sample', x: 640, y: 460, r: 22, taken: false },
    { kind: 'sample', x: 900, y: 420, r: 22, taken: false },
    { kind: 'sample', x: 1040, y: 560, r: 22, taken: false },
    { kind: 'sample', x: 520, y: 580, r: 22, taken: false },
    { kind: 'oxygen', x: 780, y: 560, r: 20, taken: false },
  ],
  obstacles: [
    { kind: 'rock', x: 460, y: 660, r: 56, passed: false },
    { kind: 'mine', x: 880, y: 620, r: 24, passed: false },
    { kind: 'mine', x: 300, y: 520, r: 24, passed: false },
  ],
};

// 1) 标题
await page.evaluate(() => window.__ll.home());
await page.waitForTimeout(500);
await page.screenshot({ path: join(OUT, '01-title.png') });

// 2-7) 玩法场景
await stage(0, SUNLIT_ROCKS); await page.waitForTimeout(350); await page.screenshot({ path: join(OUT, '02-gameplay-sunlit.png') });
await stage(0, SAMPLES); await page.waitForTimeout(350); await page.screenshot({ path: join(OUT, '03-gameplay-samples.png') });
await stage(1, MINES); await page.waitForTimeout(350); await page.screenshot({ path: join(OUT, '04-gameplay-mines.png') });
await stage(4, TWILIGHT); await page.waitForTimeout(350); await page.screenshot({ path: join(OUT, '05-gameplay-twilight.png') });
await stage(8, ABYSS); await page.waitForTimeout(350); await page.screenshot({ path: join(OUT, '06-gameplay-abyss.png') });
await stage(11, { ...ABYSS, lightRadius: 150, pickups: [...ABYSS.pickups, { kind: 'sample', x: 800, y: 430, r: 22, taken: false }] });
await page.waitForTimeout(350); await page.screenshot({ path: join(OUT, '07-gameplay-abyss2.png') });

// 8) 结算（真实 win）
await page.evaluate(() => {
  window.__ll.debug.startSeeded(0, 5);
  const st = window.__ll.run().state;
  st.samples = st.sampleTotal;
  st.depth = st.depthTarget - 1;
});
await page.waitForTimeout(600);
await page.screenshot({ path: join(OUT, '08-result-win.png') });

await browser.close();
server.closeAllConnections?.();
server.close();
console.log('wrote', OUT);
