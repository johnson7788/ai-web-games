// 生成 tests/final/*.png 验收截图（8 张，供 vision-review 评审）。
// 自起 http 服务 → 真实运行 → 截图 → 用完即关。
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, dirname } from 'node:path';
import { mkdirSync } from 'node:fs';
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
await new Promise((r) => server.listen(8167, r));
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=metal', '--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto('http://127.0.0.1:8167/');
await page.waitForTimeout(800);
await page.evaluate(() => window.__ll.debug.setTutorialDone(true));

// 1. 标题
await page.screenshot({ path: join(OUT, '01-title.png') });

// 2. 游戏：选子 + 高亮
await page.evaluate(() => window.__ll.start(0));
await page.waitForTimeout(400);
await page.evaluate(() => window.__ll.run().select(1, 3));
await page.waitForTimeout(200);
await page.screenshot({ path: join(OUT, '02-playing.png') });

// 3. 河域 / 跳河（L5 虎跳河，monsoon 场景）
await page.evaluate(() => window.__ll.debug.loadLevel(4));
await page.waitForTimeout(300);
await page.evaluate(() => window.__ll.run().select(3, 0));
await page.waitForTimeout(200);
await page.screenshot({ path: join(OUT, '03-river.png') });

// 4. 陷阱关（L4）
await page.evaluate(() => window.__ll.debug.loadLevel(3));
await page.waitForTimeout(300);
await page.evaluate(() => window.__ll.run().select(6, 3));
await page.waitForTimeout(200);
await page.screenshot({ path: join(OUT, '04-trap.png') });

// 5. 完整对局 8v8（L7）
await page.evaluate(() => window.__ll.debug.loadLevel(6));
await page.waitForTimeout(500);
await page.screenshot({ path: join(OUT, '05-game.png') });

// 6. 胜利结算
await page.evaluate(() => { window.__ll.debug.startSeeded(0, 3); window.__ll.debug.autoPlay(); });
await page.waitForTimeout(500);
await page.screenshot({ path: join(OUT, '06-win.png') });

// 7. 中文界面（游戏状态）
await page.evaluate(() => {
  const s = document.getElementById('lang-select'); s.value = 'zh'; s.dispatchEvent(new Event('change', { bubbles: true }));
  window.__ll.debug.loadLevel(0);
});
await page.waitForTimeout(400);
await page.evaluate(() => window.__ll.run().select(1, 3));
await page.waitForTimeout(200);
await page.screenshot({ path: join(OUT, '07-zh.png') });

// 8. 移动端视口
const mobile = await browser.newPage({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
await mobile.goto('http://127.0.0.1:8167/');
await mobile.waitForTimeout(800);
await mobile.evaluate(() => { window.__ll.debug.setTutorialDone(true); window.__ll.start(0); });
await mobile.waitForTimeout(500);
await mobile.screenshot({ path: join(OUT, '08-mobile.png') });
await mobile.close();

await browser.close();
server.closeAllConnections?.();
server.close();
console.log('wrote', OUT);
