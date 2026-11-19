// Mystic Tower Rise · 自对弈（无头 Node，直接 import sim/bot，无 DOM）
// 三策略 greedy / random / noinput → tools/fun/autoplay.json
import { createRun, mulberry32 } from '../src/game/sim.js';
import { greedyStep } from '../src/game/bot.js';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'tools', 'fun', 'autoplay.json');

function makeTracker(run, policy, seed, carried) {
  return {
    id: `${policy}-1`,
    policy,
    seed,
    level: run.state.floor,
    simTime: (carried && carried.simTime) ?? 0,
    firstInputAt: (carried && carried.firstInputAt) ?? null,
    firstSuccessAt: (carried && carried.firstSuccessAt) ?? null,
    deaths: (carried && carried.deaths) ?? 0,
    actions: (carried && carried.actions) ?? 0,
    seen: new Set((carried && [...carried.seen]) || []),
    eventTimes: (carried && [...carried.eventTimes]) || [0],
    tick(dt) {
      run.step(dt);
      this.simTime += dt;
      for (const e of run.drainEvents()) {
        this.seen.add(e.type);
        this.eventTimes.push(this.simTime);
        if (e.type === 'win' && this.firstSuccessAt === null) this.firstSuccessAt = this.simTime;
        if (e.type === 'lose') this.deaths += 1;
      }
    },
  };
}

function finish(tel, run) {
  const times = tel.eventTimes.slice().sort((a, b) => a - b);
  let maxGap = 0;
  let idleSec = 0;
  for (let i = 1; i < times.length; i++) {
    const gap = times[i] - times[i - 1];
    if (gap > maxGap) maxGap = gap;
    if (gap > 3) idleSec += gap - 3;
  }
  return {
    id: tel.id,
    policy: tel.policy,
    seed: tel.seed,
    level: run.state.floor,
    durationSec: Number(tel.simTime.toFixed(2)),
    firstInputSec: Number((tel.firstInputAt ?? 0).toFixed(2)),
    inputLatencyMs: 0,
    firstSuccessSec: tel.firstSuccessAt === null ? null : Number(tel.firstSuccessAt.toFixed(2)),
    deaths: tel.deaths,
    actions: tel.actions,
    idleSec: Number(idleSec.toFixed(2)),
    maxEventGapSec: Number(maxGap.toFixed(2)),
    uniqueEvents: tel.seen.size,
    levelsReached: run.state.floor,
    completed: run.state.phase === 'won',
  };
}

function greedy(seed) {
  const run = createRun({ seed });
  const tel = makeTracker(run, 'greedy', seed);
  let guard = 3000;
  while (run.state.phase === 'playing' && guard-- > 0) {
    const did = greedyStep(run);
    if (did) {
      tel.actions += 1;
      if (tel.firstInputAt === null) tel.firstInputAt = tel.simTime;
    } else {
      break;
    }
    tel.tick(1 / 60);
  }
  // 结算前再收一次事件（win/lose 可能在最后一次 moveTo 内已入队）
  tel.tick(0);
  return finish(tel, run);
}

function random(seed) {
  const run = createRun({ seed });
  const tel = makeTracker(run, 'random', seed);
  const rng = mulberry32(seed * 7919 + 13);
  for (let i = 0; i < 900 && run.state.phase === 'playing'; i++) {
    const st = run.state;
    const f = st.floors[st.floor - 1];
    const spikes = [];
    const monsters = [];
    const walkable = [];
    for (let y = 0; y < f.rows; y++) {
      for (let x = 0; x < f.cols; x++) {
        const t = f.grid[y][x];
        if (t.kind === 'spike') spikes.push({ x, y });
        else if (t.kind === 'monster') monsters.push({ x, y });
        else if (t.kind === 'floor' || t.kind === 'prop' || t.kind === 'shop' || t.kind === 'crystal' || t.kind === 'stair' || t.kind === 'npc' || t.kind === 'tele') walkable.push({ x, y });
      }
    }
    let tx, ty;
    const roll = rng();
    if (roll < 0.45 && spikes.length) {
      const s = spikes.reduce((a, b) => (Math.abs(a.x - st.pos.x) + Math.abs(a.y - st.pos.y)) < (Math.abs(b.x - st.pos.x) + Math.abs(b.y - st.pos.y)) ? a : b);
      tx = s.x; ty = s.y;
    } else if (roll < 0.7 && monsters.length) {
      const m = monsters[Math.floor(rng() * monsters.length)];
      tx = m.x; ty = m.y;
    } else if (walkable.length) {
      const w = walkable[Math.floor(rng() * walkable.length)];
      tx = w.x; ty = w.y;
    } else {
      continue;
    }
    const res = run.moveTo(tx, ty);
    if (res.ok) {
      tel.actions += 1;
      if (tel.firstInputAt === null) tel.firstInputAt = tel.simTime;
    }
    tel.tick(1 / 60);
  }
  tel.tick(0);
  return finish(tel, run);
}

function noinput(seed) {
  const run = createRun({ seed });
  const tel = makeTracker(run, 'noinput', seed);
  const MAX_SEC = 30;
  while (run.state.phase === 'playing' && tel.simTime < MAX_SEC) {
    tel.tick(1 / 60);
  }
  tel.tick(0);
  return finish(tel, run);
}

const runs = [greedy(3), random(2), noinput(3)];
const payload = {
  game: 'mystic-tower-rise',
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
    `actions=${r.actions} deaths=${r.deaths} events=${r.uniqueEvents} floor=${r.levelsReached} completed=${r.completed}`,
  );
}
