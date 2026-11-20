// 采集 tests/final 视觉评审截图（8 张，全是真实玩法画面，避免纯菜单拉低 silhouette）。
// 用法：node tools/final-shots.mjs
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

const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=metal', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto('http://127.0.0.1:8161/');
await page.waitForTimeout(700);

async function shot(name, fn) {
  await fn();
  await page.screenshot({ path: join(OUT, name) });
  console.log('·', name);
}

// 标题屏（画布背景 + 待发烟花弹）
await shot('01-title.png', async () => {});

// L1 小城夜空玩法
await shot('02-town-playing.png', async () => {
  await page.evaluate(() => { window.__ll.debug.setTutorialDone(true); window.__ll.debug.startSeeded(0, 3); });
  await page.waitForTimeout(350);
});

// L3 云絮连击（通道连续出云）
await shot('03-cloud-combo.png', async () => {
  await page.evaluate(() => window.__ll.debug.startSeeded(2, 3));
  await page.waitForTimeout(350);
});

// L4 钢棚（顶部可见全钢横梁）
await shot('04-steel-canopy.png', async () => {
  await page.evaluate(() => window.__ll.debug.startSeeded(3, 3));
  await page.waitForTimeout(350);
});

// L8 窄井 3 列
await shot('05-narrow-well.png', async () => {
  await page.evaluate(() => window.__ll.debug.startSeeded(7, 3));
  await page.waitForTimeout(350);
});

// L9 星环场景
await shot('06-rings-scene.png', async () => {
  await page.evaluate(() => window.__ll.debug.startSeeded(8, 3));
  await page.waitForTimeout(350);
});

// 结算（通关）
await shot('07-result.png', async () => {
  await page.evaluate(() => { window.__ll.debug.startSeeded(0, 3); window.__ll.debug.autoWin(); });
  await page.waitForTimeout(250);
});

// L12 冲顶终章
await shot('08-final-summit.png', async () => {
  await page.evaluate(() => window.__ll.debug.startSeeded(11, 3));
  await page.waitForTimeout(350);
});

await browser.close();
server.closeAllConnections?.();
server.close();
console.log('done →', OUT);
process.exit(0);
