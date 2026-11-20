// tools/shots.mjs — 生成 tests/final 的验收截图（供 vision-review）
// 从真实运行状态驱动（title → 布阵 → 地图 → 战斗 → 升级），桌面 + 移动端各几张。
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import { loadPlaywright, serve } from '../../../skills/webgame-playbook/scripts/_lib.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const outDir = join(root, 'tests', 'final');
mkdirSync(outDir, { recursive: true });

const { server, port } = await serve(root, 8610);
const { chromium } = loadPlaywright();
const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=metal', '--autoplay-policy=no-user-gesture-required'] });

async function newPage(w, h) {
  const context = await browser.newContext({ viewport: { width: w, height: h } });
  await context.addInitScript(() => {
    try { localStorage.setItem('heroes-quest:tutorial-done', 'true'); } catch { /* noop */ }
  });
  const page = await context.newPage();
  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'load', timeout: 20000 });
  await page.waitForFunction(() => window.__ll && window.__ll.state.phase !== 'boot', { timeout: 10000 });
  return { context, page };
}

async function startRun(page) {
  await page.evaluate(() => window.__ll.start());
  await page.waitForFunction(() => window.__ll.run && window.__ll.run.mode === 'formation', { timeout: 5000 });
  await page.evaluate(() => window.__ll.debug.confirmFormation(['vanguard', 'ranger', 'seer']));
  await page.waitForFunction(() => window.__ll.run.mode === 'map', { timeout: 5000 });
}

async function fightOnce(page) {
  await page.evaluate(() => {
    const r = window.__ll.run;
    if (r.mode !== 'battle') return;
    let g = 0;
    while (r.mode === 'battle' && g++ < 6000) {
      if (r.battle.waiting) {
        if (r.signature >= r.signatureMax) r.step({ action: { skill: 'signature' } });
        else {
          const t = r.battle.units.filter((u) => u.side === 'enemy' && u.alive).sort((a, b) => a.hp - b.hp)[0];
          r.step({ action: { skill: 'basic', target: t ? t.id : null } });
        }
      } else r.step({});
      r.drainEvents();
    }
  });
}

// ---------- 桌面 ----------
{
  const { context, page } = await newPage(1280, 720);
  await startRun(page);
  await page.waitForTimeout(300);
  await page.screenshot({ path: join(outDir, '01-map.png') });

  // 布阵屏（回到标题再开一局）
  await page.evaluate(() => window.__ll.restart());
  await page.waitForTimeout(200);
  await page.evaluate(() => window.__ll.start());
  await page.waitForFunction(() => window.__ll.run && window.__ll.run.mode === 'formation');
  await page.waitForTimeout(300);
  await page.screenshot({ path: join(outDir, '02-formation.png') });

  // 战斗（英文）：进战斗打几回合再截
  await page.evaluate(() => window.__ll.debug.confirmFormation(['vanguard', 'ranger', 'seer']));
  await page.waitForFunction(() => window.__ll.run.mode === 'map');
  await page.evaluate(() => window.__ll.debug.chooseNode('n1a'));
  await page.waitForFunction(() => window.__ll.run.mode === 'battle');
  await page.waitForTimeout(1200);
  await page.screenshot({ path: join(outDir, '03-battle.png') });
  await fightOnce(page);
  await page.waitForTimeout(300);
  await page.screenshot({ path: join(outDir, '05-upgrade.png') });

  // 战斗（中文）
  await page.evaluate(() => { window.__ll.setLang('zh'); window.__ll.restart(); window.__ll.start(); });
  await page.waitForFunction(() => window.__ll.run && window.__ll.run.mode === 'formation');
  await page.evaluate(() => window.__ll.debug.confirmFormation(['vanguard', 'ranger', 'seer']));
  await page.waitForFunction(() => window.__ll.run.mode === 'map');
  await page.evaluate(() => window.__ll.debug.chooseNode('n1a'));
  await page.waitForFunction(() => window.__ll.run.mode === 'battle');
  await page.waitForTimeout(1200);
  await page.screenshot({ path: join(outDir, '04-battle-zh.png') });

  await context.close();
}

// ---------- 移动端 ----------
{
  const { context, page } = await newPage(844, 390);
  await startRun(page);
  await page.evaluate(() => window.__ll.debug.chooseNode('n1a'));
  await page.waitForFunction(() => window.__ll.run.mode === 'battle');
  await page.waitForTimeout(1200);
  await page.screenshot({ path: join(outDir, '06-mobile.png') });
  await context.close();
}

await browser.close();
server.close();
console.log('shots written to', outDir);
