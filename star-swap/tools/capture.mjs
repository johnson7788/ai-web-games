// tools/capture.mjs — 生成 tests/final/ 验收截图（全玩法态，供 vision-review 评审）
// 用法：node tools/capture.mjs（自动起服务，用完即关，不常驻）
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const OUT = path.join(root, 'tests', 'final');
fs.mkdirSync(OUT, { recursive: true });

// 复用 _lib 的静态服务 + playwright 加载器
const { serve, loadPlaywright } = await import('../../../skills/webgame-playbook/scripts/_lib.mjs');
const { chromium } = loadPlaywright();

const server = await serve(root, 8200);
const url = `http://127.0.0.1:${server.port}/`;
const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=metal', '--autoplay-policy=no-user-gesture-required'] });

async function newPage(viewport) {
  const ctx = await browser.newContext({ viewport: { width: viewport[0], height: viewport[1] }, deviceScaleFactor: viewport[0] > 1000 ? 1 : 2 });
  const p = await ctx.newPage();
  await p.goto(url, { waitUntil: 'load', timeout: 20000 });
  await p.waitForFunction(() => window.__ll && window.__ll.state.phase !== 'boot', { timeout: 10000 }).catch(() => {});
  await p.waitForTimeout(400);
  return { p, ctx };
}

async function shot(name, { level = 1, lang = 'en', swaps = 1, nova = false, viewport = [1280, 720] } = {}) {
  const { p, ctx } = await newPage(viewport);
  try {
    if (lang !== 'en') await p.evaluate((l) => window.__ll.setLang(l), lang);
    await p.evaluate((n) => { window.__ll.startLevel(n); if (window.__ll.tutorial.active) window.__ll.tutorial.skip(); }, level);
    await p.waitForTimeout(350);
    // 打几手让画面有「正在玩」的动势（粒子 + 得分浮字）
    await p.evaluate((n) => { for (let k = 0; k < n; k += 1) window.__ll.debug.autoSwap(); }, swaps);
    await p.waitForTimeout(320);
    if (nova) {
      await p.evaluate(() => { window.G.renderer.flashNova(); });
      await p.waitForTimeout(60);
    }
    await p.screenshot({ path: path.join(OUT, name) });
    console.log('✓', name);
  } finally {
    await ctx.close();
  }
}

await shot('01-play.png', { level: 1, swaps: 2 });
await shot('02-play-zh.png', { level: 1, lang: 'zh', swaps: 2 });
await shot('03-orion.png', { level: 5, swaps: 2 });
await shot('04-south.png', { level: 9, swaps: 2 });
await shot('05-dark.png', { level: 3, swaps: 1 });
await shot('06-special.png', { level: 5, swaps: 3 });
await shot('07-mobile.png', { level: 1, swaps: 2, viewport: [844, 390] });
await shot('08-nova.png', { level: 11, swaps: 2, nova: true });

await browser.close();
server.server.close();
console.log('done →', OUT);
