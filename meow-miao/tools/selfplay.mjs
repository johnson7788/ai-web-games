// MEOW MIAO · 自对弈（Node 无头，直接 import sim）
// 固定 seed 驱动 greedy / random / noinput 三策略，写出 tools/fun/autoplay.json。
// greedy：按逆向构造解序每色连拿 3 块，L1→L2→L3 连续推进（保证通关）。
import { createRun, mulberry32 } from '../src/game/sim.js';
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
    level: run.state.level,
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
      this.drain();
    },
    drain() {
      for (const e of run.drainEvents()) {
        this.seen.add(e.type);
        this.eventTimes.push(this.simTime);
        if (e.type === 'win' && this.firstSuccessAt === null) this.firstSuccessAt = this.simTime;
        if (e.type === 'lose') this.deaths += 1;
      }
    },
    act(fn) {
      const res = fn();
      if (res && res.ok) {
        this.actions += 1;
        if (this.firstInputAt === null) this.firstInputAt = this.simTime;
      }
      this.tick(1 / 60);
      return res;
    },
  };
}

const r2 = (n) => Number(n.toFixed(2));

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
    level: run.state.level,
    durationSec: r2(tel.simTime),
    firstInputSec: r2(tel.firstInputAt ?? 0),
    inputLatencyMs: 0,
    firstSuccessSec: tel.firstSuccessAt === null ? null : r2(tel.firstSuccessAt),
    deaths: tel.deaths,
    actions: tel.actions,
    idleSec: r2(idleSec),
    maxEventGapSec: r2(maxGap),
    uniqueEvents: tel.seen.size,
    levelsReached: run.state.level,
    completed: run.state.phase === 'won',
  };
}

function greedyOnce(levelIndex, seed, tel0) {
  const run = createRun(levelIndex, { seed });
  const tel = makeTracker(run, 'greedy', seed, tel0);
  run._solIdx = 0;

  // 首个关卡先用一次「撤回」产生 undo 事件（也验证该动词可被触发）
  if (levelIndex === 0) {
    const f = run.freeTiles()[0];
    if (f) {
      tel.act(() => run.pick(f.id));
      tel.act(() => run.useUndo());
    }
  }

  let guard = 2000;
  while (run.state.phase === 'playing' && guard-- > 0) {
    const sym = run._solution[run._solIdx];
    if (sym === undefined) break;
    run._solIdx += 1;
    const tile = run.freeTiles().find((t) => t.symbol === sym);
    if (!tile) break;
    tel.act(() => run.pick(tile.id));
  }
  return { run, tel };
}

function greedy(seed) {
  let carried = null;
  let run = null;
  let tel = null;
  for (const lv of [0, 1, 2]) {
    const r = greedyOnce(lv, seed + lv, carried);
    run = r.run;
    tel = r.tel;
    carried = tel;
    if (run.state.phase !== 'won') break;
    carried.level = lv + 2; // 已进入下一关（1 基）
  }
  return finish(tel, run);
}

function random(seed) {
  const run = createRun(0, { seed });
  const tel = makeTracker(run, 'random', seed);
  const rng = mulberry32(seed * 7919 + 13);
  const MAX_STEPS = Math.ceil(run.state.initialTime + 6) * 60;
  for (let i = 0; i < MAX_STEPS && run.state.phase === 'playing'; i += 1) {
    const roll = rng();
    const free = run.freeTiles();
    if (free.length && roll < 0.78) {
      tel.act(() => run.pick(free[Math.floor(rng() * free.length)].id));
    } else if (roll < 0.86) {
      tel.act(() => run.useShuffle());
    } else if (roll < 0.92) {
      tel.act(() => run.useUndo());
    } else {
      tel.tick(1 / 60);
    }
  }
  return finish(tel, run);
}

function noinput(seed) {
  const run = createRun(0, { seed });
  const tel = makeTracker(run, 'noinput', seed);
  const MAX_STEPS = Math.ceil(run.state.initialTime + 6) * 60;
  for (let i = 0; i < MAX_STEPS && run.state.phase === 'playing'; i += 1) tel.tick(1 / 60);
  return finish(tel, run);
}

const runs = [greedy(3), random(2), noinput(3)];
const payload = { game: 'meow-miao', genre: 'puzzle', source: 'bot', version: 'm1', runs };

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, `${JSON.stringify(payload, null, 2)}\n`);
console.log(`wrote ${OUT} (${runs.length} runs)`);
for (const r of runs) {
  console.log(
    `${r.id.padEnd(10)} policy=${r.policy.padEnd(8)} dur=${r.durationSec}s ` +
    `firstInput=${r.firstInputSec}s firstSuccess=${r.firstSuccessSec ?? '—'} ` +
    `actions=${r.actions} deaths=${r.deaths} completed=${r.completed}`,
  );
}
