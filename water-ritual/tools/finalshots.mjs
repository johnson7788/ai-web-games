// tools/finalshots.mjs — 生成 tests/final/*.png（供 vision-review 评审的精选截图）。
// 真实鼠标按住倒水出「玩法中」截图；eval 驱动 perfect 金圈 / 商店 / 结算。
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';
import { loadPlaywright, serve } from '../../../skills/webgame-playbook/scripts/_lib.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '..');
const OUT = join(ROOT, 'tests', 'final');
mkdirSync(OUT, { recursive: true });

const { chromium } = loadPlaywright();
const { server, port } = await serve(ROOT, 8280);
const url = `http://127.0.0.1:${port}/`;
const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=metal', '--autoplay-policy=no-user-gesture-required'] });

const COMP_ONE = `(()=>{const r=window.__ll.run; if(!r||r.phase!=='playing') return false; let w=0; while(r.phase==='playing'&&!r.currentOrder&&w++<700) r.step({pouring:false}); if(!r.currentOrder) return false; const o=r.currentOrder; let g=0; while(g++<500&&r.currentOrder){ if(r.pour.state==='pouring'&&r.pour.level>=o.line-0.005) break; r.step({pouring:true}); } r.step({pouring:false}); for(let i=0;i<10;i++) r.step({pouring:false}); return true;})()`;
const COMP_DAY = `(()=>{const r=window.__ll.run; while(r.phase==='playing'&&r.dayOrdersFilled<r.dayTarget){ const done=(()=>{ let w=0; while(r.phase==='playing'&&!r.currentOrder&&w++<700) r.step({pouring:false}); if(!r.currentOrder) return false; const o=r.currentOrder; let g=0; while(g++<500&&r.currentOrder){ if(r.pour.state==='pouring'&&r.pour.level>=o.line-0.005) break; r.step({pouring:true}); } r.step({pouring:false}); for(let i=0;i<10;i++) r.step({pouring:false}); return true;})(); if(!done) break; } return r.phase;})()`;
const DIE = `(()=>{const r=window.__ll.run; let guard=0; while(r.phase!=='dead'&&r.phase!=='won'&&guard++<60000){ if(r.phase==='shop'){r.nextDay();continue;} if(r.currentOrder){ const o=r.currentOrder; for(let k=0;k<Math.ceil(o.patienceMax/0.0166667)+2&&r.currentOrder;k++) r.step({}); } else { r.step({}); } } return r.phase;})()`;

async function waitBoot(p) {
  await p.waitForFunction(() => window.__ll && window.__ll.state?.phase !== 'boot', { timeout: 15000 }).catch(() => {});
  await p.waitForTimeout(300);
}

async function skipTutorialIfAny(p) {
  const has = await p.locator('[data-tutorial-skip]').count();
  if (has && await p.locator('[data-tutorial-skip]').isVisible().catch(() => false)) {
    await p.locator('[data-tutorial-skip]').click({ force: true }).catch(() => {});
    await p.waitForTimeout(300);
  }
}

// ---------- 桌面 ----------
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const p = await ctx.newPage();
  await p.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await waitBoot(p);

  // 1 标题
  await p.screenshot({ path: join(OUT, '01-title.png') });

  // 7 中文标题
  await p.evaluate(() => { const s = document.getElementById('lang-select'); s.value = 'zh'; s.dispatchEvent(new Event('change', { bubbles: true })); });
  await p.waitForTimeout(250);
  await p.screenshot({ path: join(OUT, '07-title-zh.png') });
  await p.evaluate(() => { const s = document.getElementById('lang-select'); s.value = 'en'; s.dispatchEvent(new Event('change', { bubbles: true })); });
  await p.waitForTimeout(200);

  // 开局 + 跳过引导
  await p.click('#btn-start');
  await p.waitForTimeout(600);
  await skipTutorialIfAny(p);
  await p.waitForTimeout(300);

  // 2 玩法中：真实按住倒水
  const box = await p.locator('#canvas').boundingBox();
  const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
  await p.mouse.move(cx, cy);
  await p.mouse.down();
  await p.waitForTimeout(820);
  await p.screenshot({ path: join(OUT, '02-play.png') });
  await p.mouse.up();
  await p.waitForTimeout(500);

  // 3 perfect 金圈涟漪：完成一单 perfect 后立刻截
  await p.evaluate(COMP_ONE);
  await p.waitForTimeout(140);
  await p.screenshot({ path: join(OUT, '03-perfect.png') });

  // 4 商店
  await p.evaluate(COMP_DAY);
  await p.waitForTimeout(400);
  await p.screenshot({ path: join(OUT, '04-shop.png') });

  // 5 结算卡（死亡结算）
  await p.evaluate(DIE);
  await p.waitForTimeout(700);
  await p.screenshot({ path: join(OUT, '05-result.png') });

  await ctx.close();
}

// ---------- 移动端 ----------
{
  const ctx = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const p = await ctx.newPage();
  await p.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await waitBoot(p);
  await p.click('#btn-start');
  await p.waitForTimeout(600);
  await skipTutorialIfAny(p);
  await p.waitForTimeout(300);

  const box = await p.locator('#canvas').boundingBox();
  const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
  await p.mouse.move(cx, cy);
  await p.mouse.down();
  await p.waitForTimeout(820);
  await p.screenshot({ path: join(OUT, '06-mobile.png') });
  await p.mouse.up();

  await ctx.close();
}

await browser.close();
server.close();
console.log('✓ tests/final screenshots written');
