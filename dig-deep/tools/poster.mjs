// tools/poster.mjs — 生成 poster.jpg（1280×720：玩法图 + 大标题 + tagline）
// 用法：node tools/poster.mjs
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadPlaywright, serve } from '../../../skills/webgame-playbook/scripts/_lib.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'poster.jpg');

const DIG_TO = `(()=>{const r=window.__ll.run; let n=0; while(n<8000 && r.phase==='playing' && r.depth<80){const f=r.peek(r.depth); let c=r.col,b=-1e9; for(let i=0;i<5;i++){const e=f[i]; if(!e.alive)continue; let s= e.type==='lava'?-1e9: e.type==='rock'?(r.laserCharges>0?-8:-200): e.type==='diamond'?120: e.type==='fossil'?110: e.type==='fault'?45:25-e.hard*8; if(s>b){b=s;c=i;}} r.step({move:Math.sign(c-r.col),dig:r.col===c,tool:r.maxTool>=1?1:0}); r.drainEvents(); n++;} return r.depth;})()`;

const { chromium } = loadPlaywright();
const server = await serve(ROOT, 8210);
const base = `http://127.0.0.1:${server.port}/`;

const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=metal', '--autoplay-policy=no-user-gesture-required'] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await ctx.newPage();
await page.goto(base, { waitUntil: 'load', timeout: 20000 });
await page.waitForFunction(() => window.__ll && window.__ll.state.phase !== 'boot', { timeout: 10000 });
await page.waitForTimeout(400);
await page.click('#btn-start');
await page.waitForTimeout(250);
await page.click('[data-tutorial-skip]').catch(() => {});
await page.waitForTimeout(250);
await page.evaluate(DIG_TO);
await page.waitForTimeout(200);

const baseBuf = await page.screenshot({ type: 'png' });
const b64 = baseBuf.toString('base64');

const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
* { margin:0; padding:0; }
html,body { width:1280px; height:720px; overflow:hidden; background:#120a04; }
.bg { position:absolute; inset:0; width:1280px; height:720px; object-fit:cover; }
.grad { position:absolute; inset:0; background: linear-gradient(180deg, rgba(18,10,4,0.82) 0%, rgba(18,10,4,0.10) 38%, rgba(18,10,4,0.55) 100%); }
.overlay { position:absolute; left:0; right:0; top:48px; display:flex; flex-direction:column; align-items:center; gap:10px; text-align:center; font-family: 'PingFang SC','Hiragino Sans','Segoe UI','Courier New',monospace; }
.kicker { font-size:22px; letter-spacing:0.5em; color:#ffcf6a; text-transform:uppercase; opacity:0.9; }
.title { font-size:120px; font-weight:900; letter-spacing:0.08em; color:#fff6e8; text-shadow: 0 0 24px rgba(255,207,106,0.95), 0 0 60px rgba(255,122,32,0.7), 0 4px 0 rgba(60,30,8,0.9); }
.tagline { font-size:26px; letter-spacing:0.06em; color:#fff3e0; text-shadow: 0 2px 8px rgba(0,0,0,0.8); max-width:760px; }
</style></head><body>
<img class="bg" src="data:image/png;base64,${b64}">
<div class="grad"></div>
<div class="overlay">
  <div class="kicker">Drill · Dig · Discover</div>
  <div class="title">DIG DEEP</div>
  <div class="tagline">Break the crust. Choose your tool. Outrun the flood.</div>
</div>
</body></html>`;

await page.setContent(html, { waitUntil: 'load' });
await page.waitForTimeout(150);
await page.screenshot({ path: OUT, type: 'jpeg', quality: 92 });

await ctx.close().catch(() => {});
await browser.close().catch(() => {});
server.server.close();
console.log('saved', OUT);
