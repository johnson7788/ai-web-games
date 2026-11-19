// GRUMPY BIRDS SIEGE · 自对弈（无头 Node，直接驱动 sim，无 DOM）
// 三策略 greedy / random / noinput → tools/fun/autoplay.json（schema 见 playtest-protocol §3）。
// greedy 用简单跟踪控制器：追下一道墙缺口中心 + 回避投石，串行 L1→L2→L3（满足推进率）。
// 运行：node tools/selfplay.mjs
import { createRun } from '../src/game/sim.js';
import { WORLD, BIRD, WALL, ROCK, STEP } from '../config/game.config.js';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'tools', 'fun', 'autoplay.json');
const TAU = Math.PI * 2;

function wallGapY(st, w) {
  return w.baseY + Math.sin(st.time * TAU / WALL.OSC_PERIOD) * WALL.OSC_AMP;
}

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
    inputLatencyMs: 0, // 纯 sim 无渲染输入延迟
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

// greedy：追缺口中心 + 回避投石，返回是否该拍翅
function shouldFlap(run) {
  const st = run.state;
  const bird = st.bird;
  const unpassed = st.walls.filter((w) => !w.passed);
  let targetY = WORLD.HEIGHT / 2;
  if (unpassed.length) {
    const next = unpassed.reduce((a, b) => (b.x < a.x ? b : a));
    targetY = wallGapY(st, next) + st.gapH / 2;
  }
  // 投石回避：接近且有威胁时压目标
  if (st.hasRocks) {
    for (const rock of st.rocks) {
      if (rock.x <= BIRD.X - 24 || rock.x > BIRD.X + 260) continue;
      const tHit = Math.max(1, (rock.x - BIRD.X) / Math.max(0.5, -rock.vx));
      const yAt = rock.y + rock.vy * tHit + 0.5 * ROCK.GRAVITY * tHit * tHit;
      if (Math.abs(yAt - bird.y) < 70) {
        targetY = yAt > bird.y ? bird.y - 105 : bird.y + 105;
      }
    }
  }
  targetY = Math.max(BIRD.R + 34, Math.min(WORLD.GROUND_Y - BIRD.R - 34, targetY));
  return bird.y > targetY + 10;
}

function greedyOnce(levelIndex, seed, tel0) {
  const run = createRun(levelIndex, { seed });
  const tel = makeTracker(run, 'greedy', seed, tel0);
  tel.act(() => run.flap());
  let cap = 60 * 90; // 最多 90s（远超 10 墙所需）
  while ((run.state.phase === 'ready' || run.state.phase === 'playing') && cap-- > 0) {
    if (shouldFlap(run)) tel.act(() => run.flap());
    tel.tick(STEP);
  }
  return finish(tel, run);
}

function greedy(seed) {
  let carried = null;
  let last = null;
  for (const lv of [0, 1, 2]) {
    last = greedyOnce(lv, seed + lv, carried);
    carried = last._tel;
    if (!last.completed) break;
    carried.level = lv + 2; // 已开始下一关（1 基）
  }
  return last;
}

// random：乱按，验证输入鲁棒 + 拉高操作频率基线
function random(seed) {
  const run = createRun(0, { seed });
  const tel = makeTracker(run, 'random', seed);
  let s = seed >>> 0;
  const rnd = () => { s = (s + 0x6D2B79F5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  tel.act(() => run.flap());
  let cap = 60 * 30;
  while ((run.state.phase === 'ready' || run.state.phase === 'playing') && cap-- > 0) {
    if (rnd() < 0.45) tel.act(() => run.flap());
    tel.tick(STEP);
  }
  return finish(tel, run);
}

// noinput：只推进时间（自动起飞后坠落死亡，作死亡基线 / 死时间证据）
function noinput(seed) {
  const run = createRun(0, { seed });
  const tel = makeTracker(run, 'noinput', seed);
  let cap = 60 * 20;
  while ((run.state.phase === 'ready' || run.state.phase === 'playing') && cap-- > 0) {
    tel.tick(STEP);
  }
  return finish(tel, run);
}

const runs = [greedy(3), random(2), noinput(3)];
const payload = {
  game: 'grumpy-birds-siege',
  genre: 'arcade',
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
    `unique=${r.uniqueEvents} maxGap=${r.maxEventGapSec}s idle=${r.idleSec}s`,
  );
}
