// 生成 poster.jpg（1280×720）与 poster-1920.jpg（1920×1080）：真实标题屏 + 大标题贴纸字。
// 隐藏关卡格/按钮等杂物，只留 DJ 台场景 + 标题 + 副标题；自起 http 服务、用完即关。
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
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
await new Promise((r) => server.listen(8163, r));

const HIDE = `
  #level-grid, #btn-start, .total-stars, .chapter-tag, #lang-select { display: none !important; }
  #screen-title { padding-top: 150px; }
  #title-text { font-size: 6.2rem; }
  #subtitle-text { font-size: 1.7rem; }
`;

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=metal'] });

// 1280×720
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage();
  await page.goto('http://127.0.0.1:8163/');
  await page.waitForTimeout(700);
  await page.addStyleTag({ content: HIDE });
  await page.waitForTimeout(150);
  await page.screenshot({ path: join(ROOT, 'poster.jpg'), type: 'jpeg', quality: 88 });
  await ctx.close();
  console.log('saved poster.jpg');
}

// 1920×1080
{
  const ctx = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
  const page = await ctx.newPage();
  await page.goto('http://127.0.0.1:8163/');
  await page.waitForTimeout(700);
  await page.addStyleTag({ content: HIDE + `
    #screen-title { padding-top: 210px; }
    #title-text { font-size: 9rem; }
    #subtitle-text { font-size: 2.4rem; }
  ` });
  await page.waitForTimeout(150);
  await page.screenshot({ path: join(ROOT, 'poster-1920.jpg'), type: 'jpeg', quality: 90 });
  await ctx.close();
  console.log('saved poster-1920.jpg');
}

await browser.close();
server.closeAllConnections?.();
server.close();
process.exit(0);
