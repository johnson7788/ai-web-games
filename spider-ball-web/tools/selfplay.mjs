// Spider Ball Web · 自对弈（纯逻辑，无 DOM）
// 策略：greedy（瞄准存活砖，逐关推进）/ random（随机角度乱发）/ noinput（仅靠自动发射兜底）。
// 输出 tools/fun/autoplay.json（schema 见 skills/webgame-playbook/references/playtest-protocol.md §3）。
// 运行：node tools/selfplay.mjs
import { createRun, aimAt, mulberry32 } from '../src/game/sim.js';
import { WORLD, STEP } from '../config/game.config.js';
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
    levelsReached: run.state.level,
    tick(dt) {
      run.step(dt);
      this.simTime += dt;
      this.levelsReached = Math.max(this.levelsReached, run.state.level);
      for (const e of run.drainEvents()) {
        this.seen.add(e.type);
        this.eventTimes.push(this.simTime);
        if ((e.type === 'levelWin' || e.type === 'win') && this.firstSuccessAt === null) this.firstSuccessAt = this.simTime;
        if (e.type === 'lose') this.deaths += 1;
      }
    },
    act(fn) {
      const res = fn();
      if (res && res.ok) {
        this.actions += 1;
        if (this.firstInputAt === null) this.firstInputAt = this.simTime;
      }
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
    level: tel.levelsReached,
    durationSec: Number(tel.simTime.toFixed(2)),
    firstInputSec: Number((tel.firstInputAt ?? 0).toFixed(2)),
    inputLatencyMs: 0,
    firstSuccessSec: tel.firstSuccessAt === null ? null : Number(tel.firstSuccessAt.toFixed(2)),
    deaths: tel.deaths,
    actions: tel.actions,
    idleSec: Number(idleSec.toFixed(2)),
    maxEventGapSec: Number(maxGap.toFixed(2)),
    uniqueEvents: tel.seen.size,
    levelsReached: tel.levelsReached,
    completed: run.state.phase === 'won',
  };
}

// 选择下一个瞄准目标：优先道具（激光/紫爆/加球）→ 否则距发射口最近的普通砖。
function pickTarget(s) {
  let best = null;
  let bestScore = -Infinity;
  for (const b of s.bricks) {
    if (!b.alive || b.indestructible) continue;
    let score;
    if (b.isPower) score = 10000 - (b.row * 100 + b.col);
    else {
      const dx = b.x - WORLD.LAUNCH_X;
      const dy = WORLD.LAUNCH_Y - b.y;
      score = 2000 - Math.hypot(dx, dy); // 越近越优先
    }
    if (score > bestScore) {
      bestScore = score;
      best = b;
    }
  }
  return best;
}

// 扫射角覆盖左/中/右全场：周期穿插扫射能清掉「瞄不准的远角砖」（借墙面反弹）
const SWEEP_ANGLES = [-1.05, -0.7, -0.35, 0, 0.35, 0.7, 1.05];

function greedy(seed) {
  const run = createRun(0, { seed });
  const tel = makeTracker(run, 'greedy', seed);
  let shots = 0;
  let sweepI = 0;
  let guard = 400000;
  while (guard-- > 0) {
    const s = run.state;
    if (s.phase === 'aiming') {
      const target = pickTarget(s);
      if (!target) break;
      // 每 3 发穿插一次扫射：普通瞄准清近处，扫射借墙反弹清远角
      let angle;
      if (shots % 3 === 2) {
        angle = SWEEP_ANGLES[sweepI % SWEEP_ANGLES.length];
        sweepI += 1;
      } else {
        angle = aimAt(WORLD.LAUNCH_X, WORLD.LAUNCH_Y, target.x, target.y);
      }
      tel.act(() => run.shoot(angle));
      shots += 1;
      // 推进到本球回收
      let steps = 0;
      while (run.state.phase === 'flying' && steps < 12000) {
        tel.tick(STEP);
        steps += 1;
      }
      continue;
    }
    tel.tick(STEP);
    if (s.phase === 'won' || s.phase === 'lost') break;
  }
  return finish(tel, run);
}

function random(seed) {
  const run = createRun(0, { seed });
  const tel = makeTracker(run, 'random', seed);
  const rng = mulberry32(seed * 7919 + 13);
  let guard = 200000;
  while (guard-- > 0) {
    const s = run.state;
    if (s.phase === 'aiming') {
      const a = (rng() * 2 - 1) * 1.3;
      tel.act(() => run.shoot(a));
    }
    tel.tick(STEP);
    if (s.phase === 'won' || s.phase === 'lost') break;
  }
  return finish(tel, run);
}

function noinput(seed) {
  const run = createRun(0, { seed });
  const tel = makeTracker(run, 'noinput', seed);
  let guard = 400000;
  while (guard-- > 0) {
    tel.tick(STEP);
    if (run.state.phase === 'won' || run.state.phase === 'lost') break;
  }
  return finish(tel, run);
}

const runs = [greedy(3), random(2), noinput(3)];
const payload = {
  game: 'spider-ball-web',
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
    `${r.id.padEnd(11)} policy=${r.policy.padEnd(8)} dur=${r.durationSec}s ` +
    `firstInput=${r.firstInputSec}s firstSuccess=${r.firstSuccessSec ?? '—'} ` +
    `actions=${r.actions} deaths=${r.deaths} levels=${r.levelsReached} completed=${r.completed} ` +
    `unique=${r.uniqueEvents} idle=${r.idleSec}s`,
  );
}
