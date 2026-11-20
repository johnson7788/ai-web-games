// TILE TRIAD · 验收截图生成：自起 http 服务 → Playwright 驱动真实玩法 → tests/final/*.png。
// 前 8 张（按文件名排序）优先放玩法画面，避免纯菜单拉低 vision-review 剪影均分。
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
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.json': 'application/json' };

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
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const port = server.address().port;

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=metal'] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await ctx.newPage();
await page.goto(`http://127.0.0.1:${port}/`);
await page.waitForTimeout(800);
await page.evaluate(() => window.__ll.debug.setTutorialDone(true));

async function shot(name) {
  await page.screenshot({ path: join(OUT, name) });
  console.log('shot', name);
}

async function seeded(lv, seed) {
  await page.evaluate(([lv, seed]) => window.__ll.debug.startSeeded(lv, seed), [lv, seed]);
  await page.waitForTimeout(350);
}

// 01：晨光集市 L1 玩法（已拾取两张，收槽可见）
await seeded(0, 3);
await page.evaluate(() => { const s = window.__ll.run().solution(); window.__ll.debug.tapStack(s[0]); window.__ll.debug.tapStack(s[1]); });
await page.waitForTimeout(200);
await shot('01-playing-dawn.png');

// 02：三同消除瞬间（香料烟尘 + 小猫反应）
await page.evaluate(() => { const s = window.__ll.run().solution(); window.__ll.debug.tapStack(s[2]); });
await page.waitForTimeout(120);
await shot('02-clear-dust.png');

// 03：午后市集 L4 压顶大层（收槽已有两张同款，展示凑三目标）
await seeded(3, 4);
await page.evaluate(() => { const s = window.__ll.run().solution(); window.__ll.debug.tapStack(s[0]); window.__ll.debug.tapStack(s[1]); });
await page.waitForTimeout(200);
await shot('03-cap-layer.png');

// 04：午后市集 L6 假锁层（锁标可见）
await seeded(5, 6);
await page.evaluate(() => { const s = window.__ll.run().solution(); window.__ll.debug.tapStack(s[0]); });
await page.waitForTimeout(200);
await shot('04-fake-lock.png');

// 05：灯会夜市 L9（收槽已有两张同款）
await seeded(8, 9);
await page.evaluate(() => { const s = window.__ll.run().solution(); window.__ll.debug.tapStack(s[0]); window.__ll.debug.tapStack(s[1]); });
await page.waitForTimeout(200);
await shot('05-night-market.png');

// 06：通关结算（三星）
await seeded(0, 3);
await page.evaluate(() => { window.__ll.debug.autoPlaceSolution(); window.__ll.debug.fastForward(); });
await page.waitForTimeout(300);
await shot('06-result.png');

// 07：标题屏（英文）
await page.evaluate(() => window.__ll.home());
await page.waitForTimeout(300);
await shot('07-title.png');

// 08：标题屏（中文）
await page.evaluate(() => { const s = document.getElementById('lang-select'); s.value = 'zh'; s.dispatchEvent(new Event('change', { bubbles: true })); });
await page.waitForTimeout(250);
await shot('08-title-zh.png');

await browser.close();
server.closeAllConnections?.();
server.close();
console.log('done →', OUT);
process.exit(0);
