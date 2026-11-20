// STICKMAN ESCAPE ROOM · 自对弈（M1 拥有）
// Node 无头，直接 import sim（无 DOM）。用固定 seed 驱动 greedy / random / noinput 三策略，
// 玩到终局（通关 or 死亡）并写出 tools/fun/autoplay.json（schema 见 playtest-protocol §3）。
// 运行：node tools/selfplay.mjs
import { createRun, mulberry32 } from '../src/game/sim.js';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'tools', 'fun', 'autoplay.json');

function makeTracker(run, policy, seed) {
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
    record(events) {
      for (const e of events) {
        this.seen.add(e.type);
        this.eventTimes.push(this.simTime);
        if (e.type === 'survive' && this.firstSuccessAt === null) this.firstSuccessAt = this.simTime;
        if (e.type === 'lose') this.deaths += 1;
      }
    },
    step(dt) {
      run.step(dt);
      this.simTime += dt;
      this.record(run.drainEvents());
    },
    act(fn) {
      const res = fn();
      if (res && res.ok) {
        this.actions += 1;
        if (this.firstInputAt === null) this.firstInputAt = this.simTime;
      }
      this.record(run.drainEvents());
      return res;
    },
  };
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
    inputLatencyMs: 0, // 纯 sim 无渲染输入延迟
    firstSuccessSec: tel.firstSuccessAt === null ? null : Number(tel.firstSuccessAt.toFixed(2)),
    deaths: tel.deaths,
    actions: tel.actions,
    idleSec: Number(idleSec.toFixed(2)),
    maxEventGapSec: Number(maxGap.toFixed(2)),
    uniqueEvents: tel.seen.size,
    levelsReached: run.state.level,
    completed: run.state.phase === 'won' || run.state.phase === 'lost',
  };
}

function terminal(run) {
  return run.state.phase === 'won' || run.state.phase === 'lost';
}

function nearestSafe(s) {
  let best = -1;
  let bestD = Infinity;
  for (let i = 0; i < s.columns; i += 1) {
    if (s.safe[i] && !s.hazards[i]) {
      const d = Math.abs(i - s.playerIndex);
      if (d < bestD) { bestD = d; best = i; }
    }
  }
  return best;
}

// ---------------- greedy：走到最近的安全缺口就位，途中顺手捡道具 ----------------
function greedy(seed) {
  const run = createRun(0, { seed });
  const tel = makeTracker(run, 'greedy', seed);
  let guard = 4000;
  while (!terminal(run) && guard-- > 0) {
    const s = run.state;
    if (s.phase === 'countdown' || s.phase === 'descending') {
      const target = nearestSafe(s);
      if (target >= 0 && target !== s.playerIndex) {
        const dir = target > s.playerIndex ? 1 : -1;
        const gap = Math.abs(target - s.playerIndex);
        if (gap >= 2 && s.boost > 0 && s.rocks[s.playerIndex + dir]) {
          tel.act(() => run.boost(dir));
        } else {
          const r = tel.act(() => run.move(dir));
          if (!r.ok) tel.act(() => run.boost(dir));
        }
      }
    }
    tel.step(1 / 60);
  }
  return finish(tel, run);
}

// ---------------- random：乱走/乱冲，验证输入鲁棒与失败基线 ----------------
function random(seed) {
  const run = createRun(0, { seed });
  const tel = makeTracker(run, 'random', seed);
  const rng = mulberry32(seed * 7919 + 13);
  let guard = 60 * 60;
  while (!terminal(run) && guard-- > 0) {
    const s = run.state;
    if (s.phase === 'countdown' || s.phase === 'descending') {
      const roll = rng();
      const dir = rng() < 0.5 ? -1 : 1;
      if (roll < 0.3) tel.act(() => run.boost(dir));
      else if (roll < 0.8) tel.act(() => run.move(dir));
    }
    tel.step(1 / 60);
  }
  return finish(tel, run);
}

// ---------------- noinput：只推进时间，测死时间与失败基线 ----------------
function noinput(seed) {
  const run = createRun(0, { seed });
  const tel = makeTracker(run, 'noinput', seed);
  let guard = 30 * 60;
  while (!terminal(run) && guard-- > 0) {
    tel.step(1 / 60);
  }
  return finish(tel, run);
}

const runs = [greedy(3), random(2), noinput(7)];
const payload = {
  game: 'stickman-escape-room',
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
    `actions=${r.actions} deaths=${r.deaths} levels=${r.levelsReached} completed=${r.completed} ` +
    `events=${r.uniqueEvents} maxGap=${r.maxEventGapSec.toFixed(1)}s idle=${r.idleSec.toFixed(1)}s`,
  );
}
