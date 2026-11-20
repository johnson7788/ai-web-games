// tools/make-poster.mjs — 生成根目录 poster.jpg（1280×720）
// 做法：驱动游戏到「彩云缠绕 + 高塔」签名时刻截图 → HTML 叠发光大标题 + tagline → Playwright 截图存 jpg。
import { mkdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { loadPlaywright, serve } from '../../../skills/webgame-playbook/scripts/_lib.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const POSTER = join(ROOT, 'poster.jpg');
const SHOT = join(ROOT, 'tests', 'artifacts', 'poster-src.png');
mkdirSync(join(ROOT, 'tests', 'artifacts'), { recursive: true });

const { chromium } = loadPlaywright();
const { server, port } = await serve(ROOT, 8370);
const url = `http://127.0.0.1:${port}/`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch({
  headless: true,
  args: ['--use-gl=angle', '--use-angle=metal', '--autoplay-policy=no-user-gesture-required'],
});

let gameplayPng = SHOT;
try {
  // 1) 玩法源图：14 层完美叠塔（触发彩云缠绕）+ 冻结移动岛
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await ctx.newPage();
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForFunction(() => window.__ll && window.__ll.state?.phase !== 'boot', { timeout: 10000 });
  await sleep(500);
  await page.click('#btn-start');
  await sleep(700);
  if (await page.locator('[data-tutorial-skip]').isVisible().catch(() => false)) {
    await page.click('[data-tutorial-skip]');
    await sleep(400);
  }
  await page.evaluate(() => {
    const r = window.__ll.run;
    for (let k = 0; k < 14; k += 1) {
      r.moving.x = r.top.x;
      r._prevDrop = false;
      r.step({ drop: true });
      r.drainEvents();
    }
    r.cloudWrap = true;
    r.moving.speed = 0;
    r.moving.x = r.top.x + 22;
    window.G.renderer.fx('cloudWrap');
  });
  await sleep(250);
  await page.screenshot({ path: SHOT, animations: 'disabled' });
  await ctx.close();

  // 2) HTML 叠发光大标题 + tagline（图片以 base64 data URI 内嵌，避免 file:// 拦截）
  const b64 = readFileSync(SHOT).toString('base64');
  const overlayHtml = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><style>
  html,body{margin:0;padding:0;width:1280px;height:720px;overflow:hidden;}
  .poster{position:relative;width:1280px;height:720px;}
  .poster img{position:absolute;inset:0;width:1280px;height:720px;object-fit:cover;}
  .brand{position:absolute;left:0;right:0;top:0;bottom:0;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;padding-bottom:70px;text-align:center;font-family:'PingFang SC','Hiragino Sans','Segoe UI','Microsoft YaHei',sans-serif;}
  .logo{font-size:96px;font-weight:800;letter-spacing:0.14em;color:#fff6e0;
    text-shadow:0 0 12px rgba(255,179,92,.9),0 0 30px rgba(255,179,92,.7),0 0 60px rgba(255,120,40,.6),0 3px 6px rgba(60,30,0,.85);}
  .tag{font-size:26px;letter-spacing:0.05em;color:#fff2d0;margin-top:12px;
    text-shadow:0 2px 6px rgba(60,30,0,.9),0 0 18px rgba(255,179,92,.5);}
</style></head>
<body><div class="poster"><img src="data:image/png;base64,${b64}"><div class="brand">
  <div class="logo">STACK SKY</div>
  <div class="tag">Drop · Align · Reach the sky</div>
</div></div></body></html>`;

  const octx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const opage = await octx.newPage();
  await opage.setContent(overlayHtml, { waitUntil: 'load' });
  await sleep(300);
  await opage.screenshot({ path: POSTER, type: 'jpeg', quality: 88 });
  await octx.close();
} finally {
  await browser.close();
  server.close();
}

console.log('✓ 已生成 poster.jpg（1280×720）');
