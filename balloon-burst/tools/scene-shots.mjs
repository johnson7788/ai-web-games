// 生成验收/视觉评审截图到 tests/final（8 张，全部真实运行画面）。
// 用法：node tools/scene-shots.mjs
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import pw from '/opt/homebrew/lib/node_modules/playwright/index.js';
const { chromium } = pw;

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
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
await new Promise((r) => server.listen(8172, r));

const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=metal'] });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
await page.goto('http://127.0.0.1:8172/');
await page.waitForTimeout(700);
await page.evaluate(() => { window.__ll.debug.setTutorialDone(true); });
const shot = (name) => page.screenshot({ path: join(ROOT, 'tests/final', name) });

const load = async (idx) => { await page.evaluate((i) => window.__ll.debug.loadLevel(i), idx); await page.waitForTimeout(350); };

await load(0);
await shot('01-dusk.png');
await page.evaluate(() => window.__ll.debug.popLargest());
await page.waitForTimeout(90);
await shot('02-action.png');

await load(2);
await shot('03-metal.png');

await load(3);
await shot('04-fire.png');

await load(4);
await shot('05-night.png');

await load(5);
await shot('06-shifting.png');

await load(8);
await shot('07-mist.png');

await page.evaluate(() => { window.__ll.debug.loadLevel(0); window.__ll.debug.autoClear(); });
await page.waitForTimeout(400);
await shot('08-result.png');

await browser.close();
server.closeAllConnections?.();
server.close();
console.log('screenshots written to tests/final');
process.exit(0);
