// TILE TRIAD · 生成海报：真实标题屏（集市场景 + 小猫 + 大标题贴纸字）→ Playwright 截图。
// poster.jpg 1280×720；poster-1920.jpg 1920×1080（DPR 1.5 放大，标题字为矢量 DOM，保持清晰）。
// 用法：node tools/poster.mjs
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import pw from '/opt/homebrew/lib/node_modules/playwright/index.js';
const { chromium } = pw;

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
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

async function shoot(deviceScaleFactor, out) {
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=metal'] });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor });
  const page = await ctx.newPage();
  await page.goto(`http://127.0.0.1:${port}/`);
  await page.waitForTimeout(900);
  await page.evaluate(() => window.__ll.debug.setTutorialDone(true));
  // 海报排版：隐藏关卡格/开始按钮/星星，放大标题贴纸字，突出场景 + 小猫 + 副标题
  await page.addStyleTag({ content: `
    #level-grid, #btn-start, .total-stars { display: none !important; }
    #screen-title { padding-top: 96px; }
    #title-text { font-size: 5.6rem !important; letter-spacing: 0.08em !important; }
    #subtitle-text { font-size: 1.5rem !important; margin-top: 16px; }
  ` });
  await page.waitForTimeout(400);
  await page.screenshot({ path: join(ROOT, out) });
  await browser.close();
  console.log('saved', out);
}

await shoot(1, 'poster.jpg');
await shoot(1.5, 'poster-1920.jpg');
server.closeAllConnections?.();
server.close();
process.exit(0);
