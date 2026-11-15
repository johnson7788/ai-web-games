// tools/selfplay.mjs — bot 遥测：greedy×3 / random×3 / noinput×2，纯 sim 跑局 + 浏览器输入延迟探针。
// 产出 tools/fun/autoplay.json（schema: references/playtest-protocol.md §3）。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createSim, updateSim, drainEvents, getHud, nearestEnemy, nearestLoot } from '../src/game/sim.js';
import { STEP, PLAYER, WEAPONS } from '../config/game.config.js';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const MAX_SEC = 240;

function aimAt(e, tx, ty, tz) {
  const dx = tx - e.x, dy = ty - (e.y + PLAYER.eye), dz = tz - e.z;
  const h = Math.hypot(dx, dz);
  return { yaw: Math.atan2(-dx, -dz), pitch: clamp(Math.atan2(dy, h), -1.45, 1.45) };
}

// 贪心：先捡更好的枪 → 追最近可见敌人 → 射击（低血后撤）→ 圈外跑圈 → 决赛圈偶尔建墙
function greedy(run, mem) {
  const p = run.player;
  const inp = { yaw: p.yaw, pitch: p.pitch, forward: 0, strafe: 0, fire: false, build: false, reload: false, pickup: false };
  const enemy = nearestEnemy(run, p);
  const loot = nearestLoot(run, p);
  const eDist = enemy ? Math.hypot(enemy.x - p.x, enemy.z - p.z) : Infinity;
  const lDist = loot ? Math.hypot(loot.x - p.x, loot.z - p.z) : Infinity;
  const inZone = Math.hypot(p.x - run.zone.cx, p.z - run.zone.cz) <= run.zone.r;

  if (p.mag === 0 && p.ammo > 0) inp.reload = true;
  const betterLoot = loot && loot.items.some((it) => it.type === 'rifle' || it.type === 'sniper') && p.weapon !== 'sniper' && p.weapon !== 'rifle';

  let gx, gz, wantShoot = false, retreat = false;
  if (!inZone) { gx = run.zone.cx; gz = run.zone.cz; }
  else if (p.hp < 55 && enemy && eDist < 12) { gx = 2 * p.x - enemy.x; gz = 2 * p.z - enemy.z; wantShoot = !!p.weapon && p.mag > 0 && eDist < 8; retreat = true; }
  else if (betterLoot && lDist < 25) { gx = loot.x; gz = loot.z; }
  else if (enemy && eDist < 30) { gx = enemy.x; gz = enemy.z; wantShoot = !!p.weapon && p.mag > 0; }
  else if (!p.weapon || p.ammo + p.mag < 14) { if (loot) { gx = loot.x; gz = loot.z; } else { gx = run.zone.cx; gz = run.zone.cz; } }
  else if (enemy) { gx = enemy.x; gz = enemy.z; wantShoot = !!p.weapon && p.mag > 0; }
  else { gx = run.zone.cx; gz = run.zone.cz; }

  const dx = gx - p.x, dz = gz - p.z;
  const goalDist = Math.hypot(dx, dz);

  if (wantShoot && enemy) {
    const a = aimAt(p, enemy.x, enemy.y + 1.25, enemy.z);
    inp.yaw = a.yaw; inp.pitch = a.pitch;
    inp.fire = p.mag > 0 && eDist < (WEAPONS[p.weapon] ? WEAPONS[p.weapon].range : 30);
    inp.strafe = mem.strafe;
    if (retreat) inp.forward = -0.6;
    if (mem.strafeT-- <= 0) { mem.strafe *= -1; mem.strafeT = 35; }
  } else {
    inp.yaw = Math.atan2(-dx, -dz);
    inp.pitch = 0;
    inp.forward = goalDist > 0.8 ? 1 : 0;
  }

  if (loot && lDist < 2.2) inp.pickup = true;
  if (p.blocks > 0 && !wantShoot && run.zone.stage >= 2 && mem.buildCd-- <= 0) { inp.build = true; mem.buildCd = 30; }

  return inp;
}

function random(run, mem) {
  mem.t -= STEP;
  if (mem.t <= 0) {
    mem.t = 0.4;
    mem.s = { forward: Math.random() < 0.6 ? 1 : 0, strafe: Math.random() * 2 - 1, fire: Math.random() < 0.5, yaw: Math.random() * Math.PI * 2 };
  }
  return {
    yaw: mem.s.yaw, pitch: 0, forward: mem.s.forward, strafe: mem.s.strafe,
    fire: mem.s.fire, build: Math.random() < 0.02, reload: Math.random() < 0.01, pickup: Math.random() < 0.05,
  };
}

function sigOf(inp) {
  return `${Math.sign(inp.forward || 0)}|${Math.sign(inp.strafe || 0)}|${inp.fire ? 1 : 0}|${inp.build ? 1 : 0}|${inp.reload ? 1 : 0}|${inp.pickup ? 1 : 0}`;
}

function runPolicy(policy, seed) {
  const run = createSim({ seed });
  const mem = { strafe: 1, strafeT: 30, buildCd: 20, t: 0 };
  const events = [{ t: 0, type: 'start' }];
  let actions = 0, firstInputSec = null, firstSuccessSec = null;
  let prev = null, idleSec = 0, lastEventT = 0, maxGap = 0;
  const kinds = new Set();
  let t = 0;

  while (t < MAX_SEC && run.phase !== 'won' && run.phase !== 'dead') {
    let inp;
    if (policy === 'greedy') inp = greedy(run, mem);
    else if (policy === 'random') inp = random(run, mem);
    else inp = { yaw: 0, pitch: 0, forward: 0, strafe: 0, fire: false, build: false, reload: false, pickup: false };

    const sig = sigOf(inp);
    if (prev !== null && sig !== prev) actions++;
    if (firstInputSec == null && (inp.forward || inp.strafe || inp.fire || inp.build || inp.pickup || inp.reload)) firstInputSec = t;
    prev = sig;

    updateSim(run, inp);
    t += STEP;
    for (const ev of drainEvents(run)) {
      events.push({ t, type: ev.type });
      kinds.add(ev.type);
      const gap = t - lastEventT;
      maxGap = Math.max(maxGap, gap);
      idleSec += Math.max(0, gap - 1);
      lastEventT = t;
      if (firstSuccessSec == null && ev.type === 'kill' && ev.killer === run.player.id) firstSuccessSec = t;
    }
  }
  maxGap = Math.max(maxGap, t - lastEventT);
  idleSec += Math.max(0, t - lastEventT - 1);
  const hud = getHud(run);
  return {
    id: `${policy}-${seed}`, policy,
    durationSec: +t.toFixed(2),
    firstInputSec: firstInputSec == null ? +t.toFixed(2) : +firstInputSec.toFixed(2),
    inputLatencyMs: 0,
    firstSuccessSec: firstSuccessSec == null ? null : +firstSuccessSec.toFixed(2),
    deaths: run.phase === 'dead' ? 1 : 0,
    actions,
    idleSec: +idleSec.toFixed(2),
    maxEventGapSec: +maxGap.toFixed(2),
    uniqueEvents: kinds.size,
    levelsReached: run.zone.stage + 1,
    completed: run.phase === 'won',
    progressRate: +clamp(run.zone.stage / 5, 0, 1).toFixed(2),
    kills: hud.kills, hp: hud.hp, alive: hud.alive,
    events: events.slice(0, 400),
  };
}

async function loadPlaywright() {
  const { createRequire } = await import('node:module');
  const require = createRequire(import.meta.url);
  for (const c of ['playwright', '/opt/homebrew/lib/node_modules/playwright', '/Users/admin/.npm-global/lib/node_modules/playwright']) {
    try { return require(c); } catch { /* next */ }
  }
  return null;
}

async function latencyProbe() {
  try {
    const pw = await loadPlaywright();
    if (!pw) throw new Error('playwright not found');
    const { chromium } = pw;
    const { spawn } = await import('node:child_process');
    const srv = spawn('python3', ['-m', 'http.server', '0', '--directory', ROOT], { stdio: ['ignore', 'pipe', 'ignore'] });
    const port = await new Promise((res) => srv.stdout.once('data', (d) => res(String(d).match(/port (\d+)/)?.[1])));
    const browser = await chromium.launch();
    const page = await browser.newPage();
    await page.goto(`http://127.0.0.1:${port}/`);
    await page.waitForFunction(() => !!window.__ll, { timeout: 15000 });
    await page.evaluate(() => { window.__ll.start(); window.__ll.tutorial.skip(); });
    await page.evaluate(() => {
      window.__lat = [];
      window.addEventListener('keydown', () => {
        const t0 = performance.now();
        requestAnimationFrame(() => window.__lat.push(performance.now() - t0));
      });
    });
    for (let i = 0; i < 12; i++) { await page.keyboard.press('ArrowLeft'); await page.waitForTimeout(60); }
    const lat = await page.evaluate(() => window.__lat);
    await browser.close();
    srv.kill();
    lat.sort((a, b) => a - b);
    return lat.length ? +lat[Math.floor(lat.length / 2)].toFixed(1) : 16;
  } catch (e) {
    console.error('latency probe fallback:', e.message);
    return 16;
  }
}

const runs = [
  runPolicy('greedy', 11), runPolicy('greedy', 22), runPolicy('greedy', 33),
  runPolicy('random', 44), runPolicy('random', 45), runPolicy('random', 46),
  runPolicy('noinput', 55), runPolicy('noinput', 56),
];
const latency = await latencyProbe();
for (const r of runs) r.inputLatencyMs = latency;

fs.mkdirSync(path.join(ROOT, 'tools/fun'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'tools/fun/autoplay.json'), JSON.stringify({ game: 'block-battle-royale', genre: 'action', source: 'bot', runs }, null, 2));
console.log('autoplay.json written:');
for (const r of runs) {
  console.log(` ${r.id}: dur=${r.durationSec}s kills=${r.kills} hp=${r.hp} alive=${r.alive} firstWin=${r.firstSuccessSec == null ? '—' : r.firstSuccessSec + 's'} deaths=${r.deaths} gap=${r.maxEventGapSec}s idle=${r.idleSec}s actions=${r.actions} kinds=${r.uniqueEvents} lvl=${r.levelsReached} done=${r.completed} latency=${r.inputLatencyMs}ms`);
}
