// INK PATH · 验收截图（tests/final/*.png，供 vision-review 扫描前 8 张）。
// 自起 http 服务 → 真实运行 → 逐张截图 → 用完即关。
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { mkdirSync } from 'node:fs';
import { extname, join, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
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
await new Promise((r) => server.listen(8177, r));

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto('http://127.0.0.1:8177/');
await page.waitForTimeout(900);
await page.evaluate(() => window.__ll.debug.setTutorialDone(true));

async function shot(name) {
  await page.screenshot({ path: join(OUT, name) });
  console.log('shot', name);
}

// 01 标题（英文默认）
await shot('01-title.png');

// 02 玩法：L1 织一步丝，能看到发亮丝线
await page.evaluate(() => { window.__ll.debug.startSeeded(0, 3); window.__ll.run().tryMove(1); });
await page.waitForTimeout(350);
await shot('02-play.png');

// 03 岔路：L2 星轮
await page.evaluate(() => window.__ll.debug.startSeeded(1, 3));
await page.waitForTimeout(350);
await shot('03-fork.png');

// 04 织成：L1 自动解 → 结算（signature 涟漪在结果屏后）
await page.evaluate(() => { window.__ll.debug.startSeeded(0, 3); window.__ll.debug.autoPlaceSolution(); });
await page.waitForTimeout(500);
await shot('04-won.png');

// 05 极光冰原场景（L5）
await page.evaluate(() => window.__ll.debug.loadLevel(4));
await page.waitForTimeout(350);
await shot('05-scene-aurora.png');

// 06 深空星云场景（L12 大师网）
await page.evaluate(() => window.__ll.debug.loadLevel(11));
await page.waitForTimeout(350);
await shot('06-scene-nebula.png');

// 07 单向丝（L7，箭头）
await page.evaluate(() => window.__ll.debug.loadLevel(6));
await page.waitForTimeout(350);
await shot('07-directed.png');

// 08 中文标题
await page.evaluate(() => { window.__ll.home(); const s = document.getElementById('lang-select'); s.value = 'zh'; s.dispatchEvent(new Event('change', { bubbles: true })); });
await page.waitForTimeout(350);
await shot('08-title-zh.png');

await browser.close();
server.closeAllConnections?.();
server.close();
console.log('done →', OUT);
process.exit(0);
