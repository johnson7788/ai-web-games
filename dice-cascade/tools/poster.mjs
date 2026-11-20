// tools/poster.mjs — 生成 poster.jpg（1280×720）：截一张玩法帧 + HTML 叠大标题/tagline → 截图存 jpg。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadPlaywright, serve, waitForBoot } from '../../../skills/webgame-playbook/scripts/_lib.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const BASE = path.join(ROOT, 'tests', 'artifacts', 'poster-base.png');
const OUT = path.join(ROOT, 'poster.jpg');
fs.mkdirSync(path.dirname(BASE), { recursive: true });

const { server, port } = await serve(ROOT, 8400);
const { chromium } = loadPlaywright();
const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=metal', '--autoplay-policy=no-user-gesture-required'] });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const p = await ctx.newPage();
await p.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'load', timeout: 30000 });
await waitForBoot(p, 10000);
await p.evaluate(() => localStorage.clear());
await p.reload({ waitUntil: 'domcontentloaded' });
await waitForBoot(p, 10000);
await p.click('#btn-start');
await sleep(600);
await p.click('[data-tutorial-skip]');
await sleep(200);
// 跳到第 3 关（3 骰），掷一次，抓珠在半空的张力帧
await p.evaluate(() => { const r = window.__ll.run; r.jump(3); r.pot = 100; r.roll(); });
await sleep(650);
await p.screenshot({ path: BASE });

// HTML 叠字海报
const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
  * { margin:0; padding:0; }
  html,body { width:1280px; height:720px; overflow:hidden; background:#0d0805; }
  img.bg { position:absolute; inset:0; width:1280px; height:720px; object-fit:cover; }
  .veil { position:absolute; inset:0; background: radial-gradient(ellipse at 50% 46%, rgba(13,8,5,0.05) 0%, rgba(13,8,5,0.55) 100%); }
  .title { position:absolute; left:50%; top:50%; transform:translate(-50%,-50%); text-align:center; color:#fff4dd;
    font: 900 92px/1 system-ui,-apple-system,'PingFang SC',sans-serif; letter-spacing:0.08em; white-space:nowrap;
    text-shadow: 0 0 18px #ffcf6a, 0 0 42px #ffcf6a, 0 0 90px #c98a2c, 0 4px 0 #3a2410; }
  .tag { position:absolute; left:50%; top:calc(50% + 62px); transform:translateX(-50%); color:#f7ead2; font: 500 24px/1.4 system-ui,-apple-system,'PingFang SC',sans-serif; letter-spacing:0.06em; text-shadow: 0 2px 8px #0d0805; }
  .kick { position:absolute; left:50%; top:calc(50% - 62px); transform:translateX(-50%); color:#ffcf6a; font: 700 20px/1 system-ui,sans-serif; letter-spacing:0.34em; text-shadow: 0 0 14px #ffcf6a; }
</style></head><body>
  <img class="bg" src="http://127.0.0.1:${port}/tests/artifacts/poster-base.png">
  <div class="veil"></div>
  <div class="kick">BET · ROLL · BANK</div>
  <div class="title">DICE CASCADE</div>
  <div class="tag">Cast the rune dice. Land the multiplier. Open the temple.</div>
</body></html>`;

await p.setContent(html, { waitUntil: 'load' });
await sleep(300);
await p.screenshot({ path: OUT, type: 'jpeg', quality: 90 });

await ctx.close();
await browser.close();
server.close();
console.log('poster.jpg written:', OUT, fs.statSync(OUT).size, 'bytes');
