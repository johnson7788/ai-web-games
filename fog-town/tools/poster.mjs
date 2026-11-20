// tools/poster.mjs — 生成 poster.jpg（1280×720）：玩法帧 + HTML 叠大标题（发光描边）+ tagline。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadPlaywright, serve } from '../../../skills/webgame-playbook/scripts/_lib.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const BG = path.join(ROOT, 'tests', 'artifacts', 'poster-bg.png');
const POSTER = path.join(ROOT, 'poster.jpg');

const { server, port } = await serve(ROOT, 8800);
const { chromium } = loadPlaywright();
const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=metal', '--autoplay-policy=no-user-gesture-required'] });

// 1) 玩法帧（第 4 街区真相时刻前后，最有张力）
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'load', timeout: 20000 });
await page.waitForFunction(() => window.__ll.state?.phase !== 'boot', { timeout: 10000 });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'load' });
await page.waitForFunction(() => window.__ll.state?.phase !== 'boot', { timeout: 10000 });
await page.waitForTimeout(400);
await page.evaluate(() => window.__ll.debug.startAt(4));
await page.waitForTimeout(150);
for (let i = 0; i < 26; i += 1) {
  const active = await page.evaluate(() => {
    const r = window.__ll.run;
    if (!r.getHud().truthActive) window.__ll.debug.autoStep(3);
    return r.getHud().truthActive;
  });
  await page.waitForTimeout(110);
  if (active) break;
}
await page.waitForTimeout(200);
await page.screenshot({ path: BG });
await page.close();

// 2) HTML 叠标题 → jpg
const bgB64 = fs.readFileSync(BG).toString('base64');
const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
  html,body{margin:0;width:1280px;height:720px;overflow:hidden;font-family:'PingFang SC','Hiragino Sans','Segoe UI',sans-serif;}
  .wrap{position:relative;width:1280px;height:720px;background:#0d1320 url(data:image/png;base64,${bgB64}) center/cover no-repeat;}
  .veil{position:absolute;inset:0;background:linear-gradient(180deg,rgba(8,12,22,.15) 0%,rgba(8,12,22,.05) 40%,rgba(8,12,22,.72) 100%);}
  .txt{position:absolute;left:72px;bottom:64px;}
  .logo{font-size:96px;font-weight:900;letter-spacing:.16em;color:#f2fbff;text-shadow:0 0 24px rgba(127,227,255,.95),0 0 60px rgba(127,227,255,.6),0 2px 0 rgba(0,0,0,.35);}
  .tag{font-size:26px;color:#dff4fb;letter-spacing:.08em;margin-top:14px;text-shadow:0 1px 6px rgba(0,0,0,.6);}
  .tag b{color:#ffb85c;text-shadow:0 0 14px rgba(255,184,92,.8);}
</style></head><body><div class="wrap"><div class="veil"></div><div class="txt">
  <div class="logo">FOG TOWN</div>
  <div class="tag">Oil-lamp detective — <b>light the fog</b>, find the key, reach the door.</div>
</div></div></body></html>`;

const p2 = await browser.newPage({ viewport: { width: 1280, height: 720 } });
await p2.setContent(html, { waitUntil: 'load' });
await p2.screenshot({ path: POSTER, type: 'jpeg', quality: 88 });
await p2.close();

await browser.close();
server.close();
console.log('saved', POSTER, `${(fs.statSync(POSTER).size / 1024).toFixed(1)}KB`);
process.exit(0);
