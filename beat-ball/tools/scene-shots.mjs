// 生成 tests/final/ 的验收截图（供 vision-review 用，命名 01–08 排在 tutorial-* 之前）。
// 用法：node tools/scene-shots.mjs
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { mkdirSync } from 'node:fs';
import { extname, join, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const pw = require('/opt/homebrew/lib/node_modules/playwright/index.js');
const { chromium } = pw;

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'tests', 'final');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.json': 'application/json' };
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
await new Promise((r) => server.listen(8181, r));
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=metal', '--autoplay-policy=no-user-gesture-required'] });

async function newPage(vp, mobile) {
  const ctx = await browser.newContext({
    viewport: vp,
    isMobile: !!mobile,
    hasTouch: !!mobile,
    deviceScaleFactor: mobile ? 2 : 1,
  });
  const page = await ctx.newPage();
  await page.goto('http://127.0.0.1:8181/', { waitUntil: 'load' });
  await page.waitForFunction(() => typeof window.__ll !== 'undefined', { timeout: 15000 });
  await page.waitForTimeout(400);
  await page.evaluate(() => window.__ll.debug.setTutorialDone(true));
  return { ctx, page };
}

async function shot(page, name) {
  await page.screenshot({ path: join(OUT, name) });
  console.log('shot', name);
}

// 桌面
{
  const { ctx, page } = await newPage({ width: 1280, height: 720 }, false);
  await shot(page, '01-title.png');
  await page.evaluate(() => window.__ll.debug.startSeeded(0, 3));
  await page.waitForTimeout(1500);
  await shot(page, '02-playing.png');
  await page.evaluate(() => window.__ll.debug.loadLevel(2));
  await page.waitForTimeout(1200);
  await shot(page, '03-three-lanes.png');
  await page.evaluate(() => window.__ll.debug.loadLevel(4));
  await page.waitForTimeout(1200);
  await shot(page, '04-lantern.png');
  await page.evaluate(() => window.__ll.debug.loadLevel(8));
  await page.waitForTimeout(1200);
  await shot(page, '05-storm.png');
  // 结果屏：L1 单轨存活到终点（鼓槌来了就跳）
  await page.evaluate(() => {
    window.__ll.debug.startSeeded(0, 3);
    const r = window.__ll.run();
    const STEP = 1 / 60;
    let guard = 60 * 60;
    while (r && r.state.phase === 'playing' && guard-- > 0) {
      const s = r.state;
      const hz = s.obstacles.find((o) => o.kind === 'hazard' && !o.resolved && o.t - s.clock < 0.34);
      if (hz && !s.playerJumping) r.jump();
      r.step(STEP);
      window.__ll.handleInternalEvents && window.__ll.handleInternalEvents();
    }
  });
  // 结算事件需要 main 消费；等 rAF 自然推进即可
  await page.waitForTimeout(600);
  await shot(page, '06-result.png');
  await ctx.close();
}

// 中文标题
{
  const { ctx, page } = await newPage({ width: 1280, height: 720 }, false);
  await page.evaluate(() => {
    const s = document.getElementById('lang-select');
    s.value = 'zh'; s.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await page.waitForTimeout(300);
  await shot(page, '08-title-zh.png');
  await ctx.close();
}

// 移动端
{
  const { ctx, page } = await newPage({ width: 844, height: 390 }, true);
  await page.evaluate(() => window.__ll.debug.startSeeded(1, 5));
  await page.waitForTimeout(1300);
  await shot(page, '07-mobile.png');
  await ctx.close();
}

await browser.close().catch(() => {});
server.closeAllConnections?.();
server.close();
console.log('done ->', OUT);
process.exit(0);
