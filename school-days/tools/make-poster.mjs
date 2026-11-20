// 生成上线物料：poster.jpg（1280×720）、poster-1920.jpg（1920×1080）、icon.png（256×256）、favicon.png。
// 做法：真实标题屏（canvas 春日山舍 + 三只小熊猫）叠加 HTML 大标题贴纸字 → Playwright 截图 → sips 缩放。
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
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
await new Promise((r) => server.listen(8167, r));

const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=metal'] });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
await page.goto('http://127.0.0.1:8167/', { waitUntil: 'load', timeout: 20000 });
await page.waitForFunction(() => typeof window.__ll !== 'undefined', { timeout: 15000 });
await page.waitForTimeout(800);
// 去杂：隐藏关卡格 / 开始按钮 / 星数 / 语言下拉，只留标题贴纸 + 字幕 + 熊猫场景
await page.evaluate(() => {
  for (const id of ['level-grid', 'btn-start', 'stars-total', 'lang-select']) {
    const el = document.getElementById(id);
    if (el) el.style.display = 'none';
  }
  const ts = document.querySelector('.total-stars');
  if (ts) ts.style.display = 'none';
});
await page.waitForTimeout(300);
await page.screenshot({ path: join(ROOT, 'poster.jpg') });

// 1920×1080 海报：1280×720 原图用 sips 放大（同构图，等比 1.5×）
execFileSync('sips', ['-z', '1080', '1920', join(ROOT, 'poster.jpg'), '--out', join(ROOT, 'poster-1920.jpg')], { stdio: 'ignore' });

// 图标：从标题屏居中裁 720×720（覆盖三只小熊猫）→ 256×256（PNG）
execFileSync('sips', ['-c', '720', '720', '--cropOffset', '280', '0', join(ROOT, 'poster.jpg'), '--out', join(ROOT, 'icon.png')], { stdio: 'ignore' });
execFileSync('sips', ['-s', 'format', 'png', '-z', '256', '256', join(ROOT, 'icon.png'), '--out', join(ROOT, 'icon.png')], { stdio: 'ignore' });
execFileSync('sips', ['-s', 'format', 'png', '-z', '64', '64', join(ROOT, 'icon.png'), '--out', join(ROOT, 'favicon.png')], { stdio: 'ignore' });

await browser.close();
server.closeAllConnections?.();
server.close();
console.log('poster.jpg / poster-1920.jpg / icon.png / favicon.png done');
process.exit(0);
