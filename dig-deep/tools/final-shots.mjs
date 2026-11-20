// tools/final-shots.mjs — 生成 tests/final/ 验收截图（标题/三场景包/结算/移动端）
// 供 vision-review 评审；用真实运行状态截图，不写设计稿。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadPlaywright, serve } from '../../../skills/webgame-playbook/scripts/_lib.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'tests/final');
fs.mkdirSync(OUT, { recursive: true });

const DIG_TO = (depth, max = 4000) => `(()=>{const r=window.__ll.run; let n=0; while(n<${max} && r.phase==='playing' && r.depth<${depth}){const f=r.peek(r.depth); let c=r.col,b=-1e9; for(let i=0;i<5;i++){const e=f[i]; if(!e.alive)continue; let s= e.type==='lava'?-1e9: e.type==='rock'?(r.laserCharges>0?-8:-200): e.type==='diamond'?120: e.type==='fossil'?110: e.type==='fault'?45:25-e.hard*8; if(s>b){b=s;c=i;}} r.step({move:Math.sign(c-r.col),dig:r.col===c,tool:r.maxTool>=1?1:0}); r.drainEvents(); n++;} return r.depth;})()`;
const DROWN = `(()=>{const r=window.__ll.run; for(let i=0;i<4000&&r.phase==='playing';i++){r.step({}); r.drainEvents();} return r.phase;})()`;

const { chromium } = loadPlaywright();
const server = await serve(ROOT, 8190);
const base = `http://127.0.0.1:${server.port}/`;

async function shot(page, name) {
  await page.screenshot({ path: path.join(OUT, name) });
  console.log('✓', name);
}

const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=metal', '--autoplay-policy=no-user-gesture-required'] });

// 桌面
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await ctx.newPage();
await page.goto(base, { waitUntil: 'load', timeout: 20000 });
await page.waitForFunction(() => window.__ll && window.__ll.state.phase !== 'boot', { timeout: 10000 });
await page.waitForTimeout(600);

await shot(page, '01-title.png');
await page.click('#btn-start');
await page.waitForTimeout(500);
await page.click('[data-tutorial-skip]');
await page.waitForTimeout(300);
await page.evaluate(DIG_TO(10));
await page.waitForTimeout(200);
await shot(page, '02-play.png');

await page.evaluate(DIG_TO(50));
await page.waitForTimeout(200);
await shot(page, '03-fossil.png');

await page.evaluate(DIG_TO(85));
await page.waitForTimeout(300);
await shot(page, '04-core.png');

// 死亡：回标题重开，等洪水淹没
await page.evaluate(() => window.__ll.restart());
await page.waitForTimeout(300);
await page.click('#btn-start');
await page.waitForTimeout(300);
await page.evaluate(DROWN);
await page.waitForTimeout(600);
await shot(page, '05-dead.png');
await ctx.close();

// 移动端
const mctx = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const mpage = await mctx.newPage();
await mpage.goto(base, { waitUntil: 'load', timeout: 20000 });
await mpage.waitForFunction(() => window.__ll && window.__ll.state.phase !== 'boot', { timeout: 10000 });
await mpage.waitForTimeout(600);
await mpage.click('#btn-start');
await mpage.waitForTimeout(500);
await mpage.click('[data-tutorial-skip]');
await mpage.waitForTimeout(300);
await mpage.evaluate(DIG_TO(8));
await mpage.waitForTimeout(200);
await shot(mpage, '06-mobile.png');
await mctx.close();

await browser.close();
server.server.close();
console.log('done');
