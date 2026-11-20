// tools/capture.mjs — 生成 vision-review 用的 8 张玩法截图（tests/final/01..08）
// 用真实 sim 快进到指定状态（不直接改 state 变量），截图交给 vision-review 评分。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadPlaywright, serve } from '/Users/admin/git/webgames/skills/webgame-playbook/scripts/_lib.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const outDir = path.join(root, 'tests', 'final');
fs.mkdirSync(outDir, { recursive: true });

const { server, port } = await serve(root, 8490);
const { chromium } = loadPlaywright();
const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=metal'] });

const FF = (stageTarget, extra) => `(() => {
  const r = window.__ll.run;
  if (!r) return { ok:false };
  const cap = 30000;
  for (let i = 0; i < cap && r.phase === 'playing'; i++) {
    const steer = Math.max(-1, Math.min(1, -r.playerX * 5));
    r.step({ steer, throttle: 1, brake: 0, tune: false });
    r.drainEvents();
    ${extra || ''}
    if (r.stage >= ${stageTarget} && r.position > 70) break;
  }
  return { ok: true, stage: r.stage, pos: Math.round(r.position), airborne: r.airborne, speed: Math.round(r.speed) };
})()`;

async function desktopShot(name, setup) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const p = await ctx.newPage();
  await p.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'load', timeout: 20000 });
  await p.waitForFunction(() => window.__ll && window.__ll.state?.phase !== 'boot', { timeout: 10000 });
  await p.evaluate(() => localStorage.clear());
  await p.reload({ waitUntil: 'load' });
  await p.waitForFunction(() => window.__ll && window.__ll.state?.phase !== 'boot', { timeout: 10000 });
  await p.evaluate(() => window.__ll.start());
  await p.waitForTimeout(500);
  await p.evaluate(() => { const el = document.querySelector('[data-tutorial-skip]'); if (el) el.click(); });
  await p.waitForTimeout(200);
  await p.evaluate(setup);
  await p.waitForTimeout(80);
  await p.screenshot({ path: path.join(outDir, name) });
  await ctx.close();
}

async function main() {
  // 1 早期玩法
  await desktopShot('01-play.png', `(() => { const r=window.__ll.run; for(let i=0;i<200;i++){ r.step({steer:0,throttle:1,brake:0,tune:false}); r.drainEvents(); } })()`);
  // 2 沙脊
  await desktopShot('02-ridge.png', `(() => { const r=window.__ll.run; for(let i=0;i<20000&&r.phase==='playing';i++){ const s=Math.max(-1,Math.min(1,-r.playerX*5)); r.step({steer:s,throttle:1,brake:0,tune:false}); r.drainEvents(); if(r.stage>=2){ const seg=r.segments[Math.floor(r.position/6)]; if(seg&&seg.ridge){ r.playerX=0; break; } } } })()`);
  // 3 跳台腾空（签名瞬间）
  await desktopShot('03-jump.png', `(() => { const r=window.__ll.run; for(let i=0;i<30000&&r.phase==='playing';i++){ const s=Math.max(-1,Math.min(1,-r.playerX*5)); r.step({steer:s,throttle:1,brake:0,tune:false}); r.drainEvents(); if(r.stage>=4 && r.airborne) break; } })()`);
  // 4 岩区
  await desktopShot('04-rock.png', `(() => { const r=window.__ll.run; for(let i=0;i<30000&&r.phase==='playing';i++){ const s=Math.max(-1,Math.min(1,-r.playerX*5)); r.step({steer:s,throttle:1,brake:0,tune:false}); r.drainEvents(); if(r.stage>=3){ const seg=r.segments[Math.floor(r.position/6)]; if(seg&&seg.terrain==='rock'&&r.position>80) break; } } })()`);
  // 5 沙暴
  await desktopShot('05-storm.png', `(() => { const r=window.__ll.run; for(let i=0;i<30000&&r.phase==='playing';i++){ const s=Math.max(-1,Math.min(1,-r.playerX*5)); r.step({steer:s,throttle:1,brake:0,tune:false}); r.drainEvents(); if(r.stage>=10&&r.position>60) break; } })()`);
  // 6 暮丘（场景包 2）
  await desktopShot('06-dusk.png', `(() => { const r=window.__ll.run; for(let i=0;i<30000&&r.phase==='playing';i++){ const s=Math.max(-1,Math.min(1,-r.playerX*5)); r.step({steer:s,throttle:1,brake:0,tune:false}); r.drainEvents(); if(r.stage>=9&&r.position>60) break; } })()`);

  // 7 移动端
  const mctx = await browser.newContext({ viewport: { width: 844, height: 390 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const mp = await mctx.newPage();
  await mp.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'load', timeout: 20000 });
  await mp.waitForFunction(() => window.__ll && window.__ll.state?.phase !== 'boot', { timeout: 10000 });
  await mp.evaluate(() => localStorage.clear());
  await mp.reload({ waitUntil: 'load' });
  await mp.waitForFunction(() => window.__ll && window.__ll.state?.phase !== 'boot', { timeout: 10000 });
  await mp.evaluate(() => window.__ll.start());
  await mp.waitForTimeout(400);
  await mp.evaluate(() => { const el = document.querySelector('[data-tutorial-skip]'); if (el) el.click(); });
  await mp.evaluate(() => { const b=document.getElementById('btn-gas'); if(b) b.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true})); });
  await mp.waitForTimeout(900);
  await mp.screenshot({ path: path.join(outDir, '07-mobile.png') });
  await mctx.close();

  // 8 标题
  const tctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const tp = await tctx.newPage();
  await tp.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'load', timeout: 20000 });
  await tp.waitForFunction(() => window.__ll && window.__ll.state?.phase !== 'boot', { timeout: 10000 });
  await tp.waitForTimeout(300);
  await tp.screenshot({ path: path.join(outDir, '08-title.png') });
  await tctx.close();

  await browser.close();
  server.close();
  console.log('captured 8 screenshots into tests/final');
}

main().catch((e) => { console.error(e); process.exit(1); });
