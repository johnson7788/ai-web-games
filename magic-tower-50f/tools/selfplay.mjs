// Magic Tower 50F · 自对弈（M1 拥有）。
// Node 无头，直接 import sim（无 DOM）。用固定 seed 驱动 greedy / random / noinput 三策略，
// 输出 tools/fun/autoplay.json（schema 见 skills/webgame-playbook/references/playtest-protocol.md §3）。
// 运行：node tools/selfplay.mjs

import { createRun, predictBattle } from '../src/game/sim.js';
import { mulberry32 } from '../src/game/data.js';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'tools', 'fun', 'autoplay.json');

const KEY = (r, c) => `${r},${c}`;

function makeTracker(policy, seed) {
  return {
    id: `${policy}-1`,
    policy,
    seed,
    simTime: 0,
    firstInputAt: null,
    firstSuccessAt: null,
    deaths: 0,
    actions: 0,
    seen: new Set(),
    eventTimes: [0],
  };
}

function drain(tel, run) {
  const evs = run.drainEvents();
  for (const e of evs) {
    tel.seen.add(e.type);
    tel.eventTimes.push(tel.simTime);
    if (e.type === 'death') tel.deaths += 1;
    if (tel.firstSuccessAt === null && (e.type === 'kill' || e.type === 'levelup' || e.type === 'floorUp')) {
      tel.firstSuccessAt = tel.simTime;
    }
  }
}

function act(tel, run, cost, fn) {
  const res = fn();
  tel.simTime += cost;
  run.state.time = tel.simTime;
  if (res && res.ok !== false) tel.actions += 1;
  if (tel.firstInputAt === null && tel.actions > 0) tel.firstInputAt = tel.simTime;
  drain(tel, run);
  return res;
}

function finish(tel, run) {
  const times = tel.eventTimes.slice().sort((a, b) => a - b);
  let maxGap = 0;
  let idleSec = 0;
  for (let i = 1; i < times.length; i += 1) {
    const gap = times[i] - times[i - 1];
    if (gap > maxGap) maxGap = gap;
    if (gap > 3) idleSec += gap - 3;
  }
  return {
    id: tel.id,
    policy: tel.policy,
    seed: tel.seed,
    durationSec: Number(tel.simTime.toFixed(2)),
    firstInputSec: Number((tel.firstInputAt ?? 0).toFixed(2)),
    inputLatencyMs: 0,
    firstSuccessSec: tel.firstSuccessAt === null ? null : Number(tel.firstSuccessAt.toFixed(2)),
    deaths: tel.deaths,
    actions: tel.actions,
    idleSec: Number(idleSec.toFixed(2)),
    maxEventGapSec: Number(maxGap.toFixed(2)),
    uniqueEvents: tel.seen.size,
    levelsReached: run.state.maxFloorReached + 1, // 含 0 层，1 基
    completed: run.state.phase === 'won',
  };
}

function allEntities(run, pred) {
  const out = [];
  for (const [key, e] of Object.entries(run.state.entities)) {
    if (pred(e)) {
      const [r, c] = key.split(',').map(Number);
      out.push({ r, c, e });
    }
  }
  return out;
}

function manhattan(a, b) { return Math.abs(a.r - b.r) + Math.abs(a.c - b.c); }

function nearest(run, cells) {
  let best = null;
  let bestD = Infinity;
  for (const cell of cells) {
    const d = manhattan(run.state.pos, cell);
    if (d < bestD) { bestD = d; best = cell; }
  }
  return best;
}

function walkOne(tel, run, r, c) {
  const pathOk = run.pathTo(r, c);
  if (!pathOk.ok || !run.state.path.length) return false;
  act(tel, run, 0.22, () => run.stepPath());
  return true;
}

// ---------------- greedy：先收道具再打安全怪再上楼 ----------------
function greedy(seed) {
  const run = createRun({ seed });
  const tel = makeTracker('greedy', seed);
  let guard = 0;
  while (run.state.phase === 'playing' && guard++ < 30000) {
    if (tel.simTime > 600) break;
    // 1) 最近可达道具
    const items = allEntities(run, (e) => e.kind === 'item');
    let target = nearest(run, items);
    if (target && run.pathTo(target.r, target.c).ok) {
      while (run.state.path.length && run.state.phase === 'playing') {
        act(tel, run, 0.22, () => run.stepPath());
      }
      continue;
    }
    // 2) 最近安全怪
    const monsters = allEntities(run, (e) => e.kind === 'monster')
      .filter((m) => predictBattle(run.state.player, run.state.combo, m.e).safe);
    target = nearest(run, monsters);
    if (target && run.pathTo(target.r, target.c).ok) {
      // 走到相邻再打
      while (run.state.path.length > 1 && run.state.phase === 'playing') {
        act(tel, run, 0.22, () => run.stepPath());
      }
      if (run.state.phase === 'playing') act(tel, run, 0.7, () => run.fightMonster(target.r, target.c));
      continue;
    }
    // 3) 有钥匙就开门
    const doors = allEntities(run, (e) => e.kind === 'door');
    const openable = doors.find((d) => (run.state.bag.items[`key_${d.e.color}`] || 0) > 0);
    if (openable && run.pathTo(openable.r, openable.c).ok) {
      while (run.state.path.length > 1 && run.state.phase === 'playing') {
        act(tel, run, 0.22, () => run.stepPath());
      }
      act(tel, run, 0.4, () => run.openDoor(openable.r, openable.c));
      continue;
    }
    // 4) 上楼
    const up = allEntities(run, (e) => e.kind === 'stairs' && e.dir === 'up')[0];
    if (up) {
      if (!run.pathTo(up.r, up.c).ok) break; // 卡死
      while (run.state.path.length && run.state.phase === 'playing') {
        act(tel, run, 0.22, () => run.stepPath());
      }
      continue;
    }
    break; // 50 层无上楼梯
  }
  return finish(tel, run);
}

// ---------------- random：狂暴乱走，见怪就打 ----------------
function random(seed) {
  const run = createRun({ seed });
  const tel = makeTracker('random', seed);
  const rng = mulberry32(seed * 7919 + 13);
  let guard = 0;
  while (run.state.phase === 'playing' && guard++ < 20000) {
    if (tel.simTime > 300) break;
    const p = run.state.player;
    // 低血喝药
    if (p.hp < p.maxHp * 0.35 && rng() < 0.4) {
      if ((run.state.bag.items.potion_large || 0) > 0) { act(tel, run, 0.3, () => run.usePotion('potion_large')); continue; }
      if ((run.state.bag.items.potion_small || 0) > 0) { act(tel, run, 0.3, () => run.usePotion('potion_small')); continue; }
    }
    const monsters = allEntities(run, (e) => e.kind === 'monster');
    const m = nearest(run, monsters);
    if (m) {
      const d = manhattan(run.state.pos, m);
      if (d <= 1) {
        act(tel, run, 0.7, () => run.fightMonster(m.r, m.c));
        continue;
      }
      if (!walkOne(tel, run, m.r, m.c)) { wander(run, tel, rng); }
      continue;
    }
    // 没怪就上楼找怪
    const up = allEntities(run, (e) => e.kind === 'stairs' && e.dir === 'up')[0];
    if (up) {
      if (!walkOne(tel, run, up.r, up.c)) wander(run, tel, rng);
      continue;
    }
    wander(run, tel, rng);
  }
  return finish(tel, run);
}

function wander(run, tel, rng) {
  const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  const d = dirs[Math.floor(rng() * 4)];
  const r = run.state.pos.r + d[0];
  const c = run.state.pos.c + d[1];
  const res = run.tapCell(r, c);
  if (!res.ok) { act(tel, run, 0.1, () => ({ ok: true })); return; }
  if (res.action === 'fight') { act(tel, run, 0.7, () => run.fightMonster(r, c)); return; }
  if (res.action === 'door') { act(tel, run, 0.4, () => run.openDoor(r, c)); return; }
  if (res.action === 'rock') { act(tel, run, 0.3, () => run.pushRock(r, c)); return; }
  if (res.action === 'move') { act(tel, run, 0.22, () => run.stepPath()); return; }
  act(tel, run, 0.1, () => ({ ok: true }));
}

// ---------------- noinput：只推进时间 ----------------
function noinput(seed) {
  const run = createRun({ seed });
  const tel = makeTracker('noinput', seed);
  tel.simTime = 60;
  run.state.time = 60;
  return finish(tel, run);
}

const runs = [greedy(3), random(2), noinput(3)];
const payload = {
  game: 'magic-tower-50f',
  genre: 'puzzle',
  source: 'bot',
  version: 'm1',
  runs,
};

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, `${JSON.stringify(payload, null, 2)}\n`);
console.log(`wrote ${OUT} (${runs.length} runs)`);
for (const r of runs) {
  console.log(
    `${r.id.padEnd(10)} policy=${r.policy.padEnd(8)} dur=${r.durationSec}s ` +
    `firstInput=${r.firstInputSec}s firstSuccess=${r.firstSuccessSec ?? '—'} ` +
    `actions=${r.actions} deaths=${r.deaths} floors=${r.levelsReached} completed=${r.completed}`,
  );
}
