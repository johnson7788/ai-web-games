#!/usr/bin/env node
// 浏览器自动玩测：greedy（追最近敌人、对准开火、漂移蓄力、捡箱）/ random（乱按）/ noinput（不动）。
// 产出 tools/fun/autoplay.json（schema 见 playbook references/playtest-protocol.md §3）。
import fs from 'node:fs';
import path from 'node:path';
import { loadPlaywright, serve } from '../../../skills/webgame-playbook/scripts/_lib.mjs';

const root = process.cwd();
const outFile = path.resolve(root, 'tools/fun/autoplay.json');
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const { server, port } = await serve(root, 8192);
const { chromium } = loadPlaywright();
const browser = await chromium.launch({
  headless: true,
  args: ['--autoplay-policy=no-user-gesture-required', '--mute-audio'],
});
const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => !!window.__ll, null, { timeout: 15000 });
// 关掉首次引导，bot 直接在正式局里跑
await page.evaluate(() => { try { window.__ll.save('tutorialDone', true); } catch { /* noop */ } });

const keys = new Set();
async function setKey(code, on) {
  if (on && !keys.has(code)) { keys.add(code); await page.keyboard.down(code).catch(() => {}); }
  if (!on && keys.has(code)) { keys.delete(code); await page.keyboard.up(code).catch(() => {}); }
}
async function releaseAll() { for (const k of [...keys]) await setKey(k, false); }

async function snapshot() {
  return page.evaluate(() => {
    const run = window.__ll.sim;
    if (!run) return { phase: window.__ll.state.phase };
    const p = run.karts[0];
    return {
      phase: window.__ll.state.phase,
      simPhase: run.phase,
      round: run.roundIndex ?? 0,
      you: { x: p.x, y: p.y, angle: p.angle, hp: p.hp, dead: !!p.dead, boost: p.boost || 0, weapon: p.weapon, kills: p.kills },
      karts: run.karts.map((k) => ({
        x: k.x, y: k.y, dead: !!k.dead, isPlayer: k.isPlayer, kills: k.kills, hp: k.hp,
      })),
      crates: (run.crates || []).map((c) => ({ x: c.x, y: c.y })),
    };
  });
}

async function start() {
  await page.evaluate(() => window.__ll.start());
  await sleep(900);
}

const norm = (a) => {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
};

async function handleRoundEnd() {
  await releaseAll();
  const card = page.locator('.upgrade-card').first();
  if (await card.count()) {
    await card.click({ force: true });
    await sleep(1200);
    return true;
  }
  // 兜底：直接调用 UI 回调
  await page.evaluate(() => {
    const c = document.querySelector('.upgrade-card');
    if (c) c.click();
  });
  await sleep(800);
  return false;
}

async function greedy(seconds = 240) {
  await start();
  const t0 = Date.now();
  let fireDown = false;
  let lastRound = 0;
  while (Date.now() - t0 < seconds * 1000) {
    const s = await snapshot();
    if (s.phase === 'matchOver' || s.phase === 'roundEnd' || s.phase === 'countdown') {
      if (s.phase === 'roundEnd') { await handleRoundEnd(); continue; }
      if (s.phase === 'matchOver') break;
      await sleep(200);
      continue;
    }
    if (s.you.dead) {
      if (fireDown) { await page.keyboard.up('Space').catch(() => {}); fireDown = false; }
      await setKey('KeyW', false);
      await setKey('KeyA', false);
      await setKey('KeyD', false);
      await sleep(200);
      continue;
    }
    if (s.round !== lastRound) lastRound = s.round;

    const enemies = s.karts.filter((k) => !k.isPlayer && !k.dead);
    const me = s.you;
    let target = null;
    let bestD = Infinity;
    for (const e of enemies) {
      const d = Math.hypot(e.x - me.x, e.y - me.y);
      if (d < bestD) { bestD = d; target = e; }
    }
    // 没枪/枪快打空且附近有箱子 → 先拿箱子
    const wantCrate = (me.weapon === 'gun' || s.crates.length > 0) && s.crates.length > 0 && Math.random() < 0.45;
    let aimX = target?.x ?? 640;
    let aimY = target?.y ?? 360;
    if (wantCrate) {
      let cd = Infinity;
      for (const c of s.crates) {
        const d = Math.hypot(c.x - me.x, c.y - me.y);
        if (d < cd) { cd = d; aimX = c.x; aimY = c.y; bestD = cd; }
      }
    }
    const desired = Math.atan2(aimY - me.y, aimX - me.x);
    const diff = norm(desired - me.angle);

    await setKey('KeyW', true);
    await setKey('KeyD', diff > 0.09);
    await setKey('KeyA', diff < -0.09);

    // 漂移：转弯幅度大且加速条没满时按住；满了就松开触发加速
    const wantDrift = Math.abs(diff) > 0.42 && me.boost < 0.92;
    await setKey('ShiftLeft', wantDrift);

    const inRange = bestD < 560 && !wantCrate;
    const aligned = Math.abs(diff) < 0.3;
    if (inRange && aligned && !fireDown) { await page.keyboard.down('Space').catch(() => {}); fireDown = true; }
    if ((!inRange || !aligned) && fireDown) { await page.keyboard.up('Space').catch(() => {}); fireDown = false; }

    await sleep(80);
  }
  await releaseAll();
  if (fireDown) await page.keyboard.up('Space').catch(() => {});
  return page.evaluate(() => window.__ll.telemetry('greedy'));
}

async function random(seconds = 16) {
  await start();
  const t0 = Date.now();
  const pool = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ShiftLeft'];
  let down = false;
  while (Date.now() - t0 < seconds * 1000) {
    const s = await page.evaluate(() => ({ phase: window.__ll.state.phase }));
    if (s.phase === 'roundEnd') { await handleRoundEnd(); continue; }
    if (s.phase === 'matchOver') break;
    const k = pool[Math.floor(Math.random() * pool.length)];
    await page.keyboard.down(k).catch(() => {});
    await sleep(90 + Math.random() * 140);
    await page.keyboard.up(k).catch(() => {});
    if (Math.random() < 0.4) {
      if (down) { await page.keyboard.up('Space').catch(() => {}); down = false; }
      else { await page.keyboard.down('Space').catch(() => {}); down = true; }
    }
    await sleep(80);
  }
  if (down) await page.keyboard.up('Space').catch(() => {});
  await releaseAll();
  return page.evaluate(() => window.__ll.telemetry('random'));
}

async function noinput() {
  await start();
  await sleep(5200);
  return page.evaluate(() => window.__ll.telemetry('noinput'));
}

const runs = [];
try {
  runs.push({ id: 'greedy-1', ...(await greedy(340)) });
  runs.push({ id: 'greedy-2', ...(await greedy(340)) });
  runs.push({ id: 'random-1', ...(await random(16)) });
  runs.push({ id: 'noinput-1', ...(await noinput()) });
} catch (e) {
  errors.push(`playtest: ${e.message}`);
} finally {
  await browser.close();
  server.close();
}
const payload = {
  game: 'smash-karts',
  genre: 'action',
  source: 'bot',
  generatedAt: new Date().toISOString(),
  errors,
  runs,
};
fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, `${JSON.stringify(payload, null, 2)}\n`);
console.log(`→ ${outFile}`);
for (const r of runs) {
  console.log(r.id, r.policy, `success=${r.firstSuccessSec}`, `actions=${r.actions}`, `lvl=${r.levelsReached}`, `deaths=${r.deaths}`, `completed=${r.completed}`);
}
if (errors.length) { console.error(errors.slice(0, 5).join('\n')); process.exitCode = 1; }
