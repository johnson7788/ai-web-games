// tools/capture.mjs — 生成 tests/final/ 验收截图（8 张玩法态，供 vision-review 评审）。
// 用法：node tools/capture.mjs（自动起服务，用完即关，不常驻）。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { serve, loadPlaywright } from '../../../skills/webgame-playbook/scripts/_lib.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const OUT = path.join(root, 'tests', 'final');
fs.mkdirSync(OUT, { recursive: true });

const { chromium } = loadPlaywright();
const server = await serve(root, 8241);
const url = `http://127.0.0.1:${server.port}/`;

const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=metal', '--autoplay-policy=no-user-gesture-required'] });

async function newPage(viewport) {
  const ctx = await browser.newContext({ viewport: { width: viewport[0], height: viewport[1] }, deviceScaleFactor: viewport[0] > 1000 ? 1 : 2 });
  const p = await ctx.newPage();
  await p.goto(url, { waitUntil: 'load', timeout: 20000 });
  await p.waitForFunction(() => window.__ll && window.__ll.state.phase !== 'boot', { timeout: 10000 }).catch(() => {});
  await p.waitForTimeout(300);
  return { p, ctx };
}

// tier/fuel 只影响「三层火焰目标」的点亮程度，不触发锻造（fuel < 当层需求）
async function shot(name, { level = 1, lang = 'en', tier = 0, fuel = 2, viewport = [1280, 720] } = {}) {
  const { p, ctx } = await newPage(viewport);
  try {
    if (lang !== 'en') await p.evaluate((l) => window.__ll.setLang(l), lang);
    await p.evaluate((n) => { window.__ll.startLevel(n); if (window.__ll.tutorial.active) window.__ll.tutorial.skip(); }, level);
    await p.waitForTimeout(1100); // 让坠落物自然铺开，画面有「正在玩」的动势
    await p.evaluate(([t, f]) => { const r = window.__ll.run; if (r) { r.tier = t; r.fuel = f; } }, [tier, fuel]);
    await p.waitForTimeout(300);
    await p.screenshot({ path: path.join(OUT, name) });
    console.log('✓', name);
  } finally {
    await ctx.close();
  }
}

await shot('01-play.png', { level: 1, tier: 1, fuel: 2 });
await shot('02-play-zh.png', { level: 1, lang: 'zh', tier: 1, fuel: 2 });
await shot('03-inner.png', { level: 3, tier: 2, fuel: 3 });
await shot('04-outer.png', { level: 6, tier: 2, fuel: 4 });
await shot('05-coal.png', { level: 2, tier: 1, fuel: 3 });
await shot('06-hazards.png', { level: 4, tier: 2, fuel: 2 });
await shot('07-mobile.png', { level: 1, tier: 1, fuel: 2, viewport: [844, 390] });
await shot('08-forged.png', { level: 8, tier: 2, fuel: 5 });

await browser.close();
server.server.close();
console.log('done →', OUT);
