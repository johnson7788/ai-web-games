// BEACH SOCCER 2V2 · 自对弈（无头，直接 import sim）
// greedy / random / noinput 三策略 → tools/fun/autoplay.json。
// greedy 用同一套物理做网格搜索解算，从当前球位求「吃目标」或「进球」的发射速度，
// 通过 run.aim()/run.flick() 真实输入驱动，绝不直改状态。
import { createRun, simulateShot, LEVELS, LEVEL_COUNT } from '../src/game/sim.js';
import { PHYS } from '../config/game.config.js';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'tools', 'fun', 'autoplay.json');

// ---- 发射解算：网格搜索（速度 × 角度），返回命中的发射向量 ----
const SPEEDS = [480, 640, 800, 960, 1120, 1280, 1440, 1580];
const ANGLE_STEP = 5;

function findShot(level, x0, y0, { watch = null, avoidGoal = false } = {}) {
  let fallback = null;
  for (const sp of SPEEDS) {
    for (let a = 0; a < 360; a += ANGLE_STEP) {
      const rad = (a * Math.PI) / 180;
      const vx = Math.cos(rad) * sp;
      const vy = Math.sin(rad) * sp;
      const res = simulateShot(level, x0, y0, vx, vy, watch ? { watch } : {});
      if (watch) {
        // 命中目标；优先不进球（避免提前结束本关）
        if (res.watchHit && (!avoidGoal || !res.reachedGoal)) return { vx, vy, res, ok: true };
        if (res.watchHit) fallback = fallback || { vx, vy, res, ok: true };
      } else {
        if (res.reachedGoal) return { vx, vy, res, ok: true };
      }
    }
  }
  return fallback || { vx: 0, vy: 0, res: null, ok: false };
}

// ---- 遥测 tracker（与 playtest-protocol 对齐）----
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
        this.tick(1 / 60);
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
  const out = {
    id: tel.id,
    policy: tel.policy,
    seed: tel.seed,
    level: tel.level,
    durationSec: Number(tel.simTime.toFixed(2)),
    firstInputSec: Number((tel.firstInputAt ?? 0).toFixed(2)),
    inputLatencyMs: 0,
    firstSuccessSec: tel.firstSuccessAt === null ? null : Number(tel.firstSuccessAt.toFixed(2)),
    deaths: tel.deaths,
    actions: tel.actions,
    idleSec: Number(idleSec.toFixed(2)),
    maxEventGapSec: Number(maxGap.toFixed(2)),
    uniqueEvents: tel.seen.size,
    levelsReached: tel.level,
    completed: run.state.phase === 'won',
  };
  out._tel = tel;
  return out;
}

// 踢一记球：aim 3 步（真实拖拽手势）+ 松手发射 + 推进到停球/胜负
function shoot(run, tel, vx, vy) {
  tel.act(() => run.aim(vx * 0.33, vy * 0.33));
  tel.act(() => run.aim(vx * 0.66, vy * 0.66));
  tel.act(() => run.aim(vx, vy));
  const f = tel.act(() => run.flick(vx, vy));
  if (!f.ok) return false;
  let guard = Math.ceil(PHYS.MAX_FLIGHT * 60) + 60;
  while (run.state.phase === 'playing' && run.state.ball.active && guard-- > 0) {
    tel.tick(1 / 60);
  }
  return run.state.phase === 'won';
}

// greedy：每关先吃一个指定收集物（星/能量球/弹力垫各一），再进球；串行 3 关
function greedyOnce(levelIndex, seed, tel0, pickupKind) {
  const run = createRun(levelIndex, { seed });
  const level = LEVELS[levelIndex];
  const tel = makeTracker(run, 'greedy', seed, tel0);

  // 1) 收集物（命中即可触发对应事件；若不慎进球也接受，直接进下一关）
  if (pickupKind === 'star' && level.stars.length) {
    const t = level.stars[0];
    const s = findShot(level, run.state.ball.x, run.state.ball.y, { watch: { x: t.x, y: t.y, r: t.r }, avoidGoal: true });
    if (s.ok && run.state.phase === 'playing') shoot(run, tel, s.vx, s.vy);
  } else if (pickupKind === 'mega' && level.mega.length) {
    const t = level.mega[0];
    const s = findShot(level, run.state.ball.x, run.state.ball.y, { watch: { x: t.x, y: t.y, r: t.r }, avoidGoal: true });
    if (s.ok && run.state.phase === 'playing') shoot(run, tel, s.vx, s.vy);
  } else if (pickupKind === 'bumper' && level.bumpers.length) {
    const t = level.bumpers[0];
    const s = findShot(level, run.state.ball.x, run.state.ball.y, { watch: { x: t.x, y: t.y, r: t.r }, avoidGoal: true });
    if (s.ok && run.state.phase === 'playing') shoot(run, tel, s.vx, s.vy);
  }

  // 2) 进球（从当前球位求进发射）
  let guard = 3;
  while (run.state.phase === 'playing' && guard-- > 0) {
    const s = findShot(level, run.state.ball.x, run.state.ball.y, {});
    if (!s.ok) break;
    shoot(run, tel, s.vx, s.vy);
  }

  return finish(tel, run);
}

function greedy(seed) {
  let carried = null;
  let last = null;
  const pickups = ['star', 'mega', 'bumper'];
  for (let lv = 0; lv < LEVEL_COUNT; lv += 1) {
    last = greedyOnce(lv, seed + lv, carried, pickups[lv]);
    carried = last._tel ?? last;
    if (!last.completed) break;
    carried.level = lv + 2; // 已开始下一关（1 基）
  }
  return last;
}

// random：随机弱踢，必在远处球门前耗尽次数 → 触发失败
function random(seed) {
  const run = createRun(0, { seed });
  const tel = makeTracker(run, 'random', seed);
  let guard = 0;
  while (run.state.phase === 'playing' && guard < 300) {
    const a = Math.random() * Math.PI * 2;
    const sp = 280 + Math.random() * 260; // 刻意射不到球门
    const vx = Math.cos(a) * sp;
    const vy = Math.sin(a) * sp;
    if (!shoot(run, tel, vx, vy)) { tel.tick(1 / 60); }
    guard += 1;
  }
  // 兜底：若仍 playing（极端情况）直接耗尽机会判负
  if (run.state.phase === 'playing') { tel.act(() => run.exhaust()); }
  return finish(tel, run);
}

// noinput：只推进时间，验证死时间基线（不失败、不进球）
function noinput(seed) {
  const run = createRun(0, { seed });
  const tel = makeTracker(run, 'noinput', seed);
  const MAX_SEC = 24;
  while (run.state.phase === 'playing' && tel.simTime < MAX_SEC) {
    tel.tick(1 / 60);
  }
  return finish(tel, run);
}

const runs = [greedy(3), random(2), noinput(3)].map((r) => {
  const { _tel, ...clean } = r;
  return clean;
});
const payload = {
  game: 'beach-soccer-2v2',
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
    `actions=${r.actions} deaths=${r.deaths} events=${r.uniqueEvents} lvl=${r.levelsReached} completed=${r.completed}`,
  );
}
