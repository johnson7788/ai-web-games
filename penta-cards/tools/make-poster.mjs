// tools/make-poster.mjs — 截一张玩法图 → HTML 叠大标题 + tagline → poster.jpg（1280×720）。
// 用法：/opt/homebrew/bin/node tools/make-poster.mjs
import { loadPlaywright, serve } from '../../../skills/webgame-playbook/scripts/_lib.mjs';
import path from 'node:path';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const ROOT = path.resolve('.');
const tmpDir = path.join(ROOT, 'tests/artifacts');
mkdirSync(tmpDir, { recursive: true });

const { chromium } = loadPlaywright();
const { server, port } = await serve(ROOT, 8462);
const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=metal'] });

// 1) 玩法背景：开局 + 跳过引导 + 打几手，让牌桌出现弃牌/牌墙
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await ctx.newPage();
await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'load', timeout: 20000 });
await page.waitForFunction(() => window.__ll?.state?.phase !== 'boot', { timeout: 8000 }).catch(() => {});
await page.waitForTimeout(600);
await page.click('#btn-start');
await page.waitForTimeout(500);
await page.click('[data-tutorial-skip]').catch(() => {});
await page.waitForTimeout(300);
await page.evaluate(() => window.__ll.debug.stepN(12));
await page.waitForTimeout(500);
const bgPath = path.join(tmpDir, 'poster-bg.png');
await page.locator('#canvas').screenshot({ path: bgPath });
await ctx.close();

// 2) 叠字海报
const b64 = readFileSync(bgPath).toString('base64');
const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
html,body{margin:0;width:1280px;height:720px;overflow:hidden}
.bg{position:absolute;inset:0;width:1280px;height:720px;object-fit:cover}
.veil{position:absolute;inset:0;background:radial-gradient(ellipse at 50% 40%, rgba(5,11,20,0) 0%, rgba(5,11,20,0.35) 60%, rgba(5,11,20,0.7) 100%)}
.title{position:absolute;left:64px;top:52px;font:800 84px/1 system-ui,-apple-system,sans-serif;color:#eaffff;letter-spacing:0.06em;text-shadow:0 0 22px rgba(84,231,255,0.95),0 0 60px rgba(84,231,255,0.55),0 2px 0 #0a2a3a}
.tag{position:absolute;left:68px;top:150px;font:500 26px/1.3 system-ui,-apple-system,sans-serif;color:#d9f4ff;letter-spacing:0.02em;text-shadow:0 0 14px rgba(84,231,255,0.7)}
.star{position:absolute;left:66px;top:118px;color:#ffc94a;font:700 30px system-ui,sans-serif;text-shadow:0 0 16px rgba(255,201,74,0.8)}
</style></head><body>
<img class="bg" src="data:image/png;base64,${b64}">
<div class="veil"></div>
<div class="title">PENTA CARDS</div>
<div class="star">✦ FIVE STAR ✦</div>
<div class="tag">Build constellations.<br>Win on the Five Star.</div>
</body></html>`;

const pctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const ppage = await pctx.newPage();
await ppage.setContent(html, { waitUntil: 'load' });
await ppage.waitForTimeout(300);
await ppage.screenshot({ path: path.join(ROOT, 'poster.jpg'), type: 'jpeg', quality: 88 });
await pctx.close();

await browser.close();
server.close();
console.log('saved poster.jpg');
process.exit(0);
