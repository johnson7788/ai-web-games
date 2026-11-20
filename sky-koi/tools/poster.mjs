// 生成 poster.jpg（真实标题屏 + 大标题贴纸字）与 tests/final 验收截图（玩法画面带门柱）。
// 用法：node tools/poster.mjs
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { mkdirSync } from 'node:fs';
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
await new Promise((r) => server.listen(8149, r));
await mkdirSync(join(ROOT, 'tests/final'), { recursive: true });

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=metal'] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await ctx.newPage();
await page.goto('http://127.0.0.1:8149/', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(900);
await page.evaluate(() => window.__ll.debug.setTutorialDone(true));

// 同步摆拍：seeded 起局 + greedy 精确推进 N 帧，保证「锦鲤存活 + 门柱可见」的稳定画面。
async function poseShot(levelIdx, seed, frames) {
  await page.evaluate(([lv, sd, fr]) => {
    window.__ll.debug.startSeeded(lv, sd);
    const r = window.__ll.run();
    for (let i = 0; i < fr; i += 1) {
      if (!r.state.started) r.flap();
      else {
        const g = r.gateAhead();
        if (!g) { if (r.state.koi.vy > 0 && r.state.koi.y > 350) r.flap(); }
        else if (r.state.koi.vy > 0 && r.state.koi.y > g.targetY - 10) r.flap();
      }
      r.step(1 / 60);
    }
  }, [levelIdx, seed, frames]);
}

// 标题屏 → poster.jpg + 验收截图
await page.screenshot({ path: join(ROOT, 'poster.jpg') });
await page.screenshot({ path: join(ROOT, 'tests/final/01-title.png') });

// 玩法画面（晨曦云海，含鸟居门柱）
await page.evaluate(() => window.__ll.start(0));
await poseShot(0, 3, 80);
await page.screenshot({ path: join(ROOT, 'tests/final/02-playing.png') });

// 结算（greedy 自动通关）
await page.evaluate(() => window.__ll.debug.startSeeded(0, 3));
await page.waitForTimeout(300);
await page.evaluate(() => window.__ll.debug.fastForward());
await page.waitForTimeout(400);
await page.screenshot({ path: join(ROOT, 'tests/final/03-result.png') });

// 三场景包（落樱 / 夜空，均含门柱）
await poseShot(3, 3, 80);
await page.screenshot({ path: join(ROOT, 'tests/final/04-sakura.png') });
await poseShot(6, 3, 80);
await page.screenshot({ path: join(ROOT, 'tests/final/05-night.png') });

// 纯 canvas（标题场景，锦鲤无 HTML 叠层）→ 用于裁 icon
await page.evaluate(() => window.__ll.home());
await page.waitForTimeout(400);
await page.locator('#canvas').screenshot({ path: join(ROOT, 'tests/artifacts/00-canvas.png') });

// 移动端视口（含门柱）
const mctx = await browser.newContext({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true });
const mp = await mctx.newPage();
await mp.goto('http://127.0.0.1:8149/', { waitUntil: 'domcontentloaded' });
await mp.waitForTimeout(800);
await mp.evaluate(() => window.__ll.debug.setTutorialDone(true));
await mp.evaluate(() => {
  window.__ll.debug.startSeeded(0, 3);
  const r = window.__ll.run();
  for (let i = 0; i < 80; i += 1) {
    if (!r.state.started) r.flap();
    else {
      const g = r.gateAhead();
      if (!g) { if (r.state.koi.vy > 0 && r.state.koi.y > 350) r.flap(); }
      else if (r.state.koi.vy > 0 && r.state.koi.y > g.targetY - 10) r.flap();
    }
    r.step(1 / 60);
  }
});
await mp.screenshot({ path: join(ROOT, 'tests/final/06-mobile.png') });
await mctx.close();

await browser.close();
server.closeAllConnections?.();
server.close();
console.log('saved poster.jpg + tests/final/*');
process.exit(0);
