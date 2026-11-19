// 生成 vision-review 用的战斗屏截图（多关卡，球在飞行）。
// 用法：node tools/scene-shots.mjs
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import pw from '/opt/homebrew/lib/node_modules/playwright/index.js';
const { chromium } = pw;

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'tests', 'final');
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
await new Promise((r) => server.listen(8212, r));

const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=metal'] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await ctx.newPage();
await page.goto('http://127.0.0.1:8212/', { waitUntil: 'load' });
await page.waitForFunction(() => !!window.__ll, { timeout: 10000 });
await page.waitForTimeout(500);
await page.evaluate(() => window.__ll.debug.setTutorialDone(true));

const shots = [
  { level: 3, angle: 24, name: '05-laser-level.png' },  // L4 交叉火力
  { level: 4, angle: 10, name: '06-bomb-level.png' },   // L5 炸弹突袭
  { level: 7, angle: 30, name: '07-final-level.png' },  // L8 霓虹堡垒
];
for (const s of shots) {
  await page.evaluate(({ level, angle }) => {
    window.__ll.start(level);
    const run = window.__ll.run();
    if (run) { run.aim(angle); run.fire(); }
  }, s);
  await page.waitForTimeout(1400);
  await page.screenshot({ path: join(OUT, s.name) });
}

await browser.close();
server.close();
console.log('✓ scene shots generated');
