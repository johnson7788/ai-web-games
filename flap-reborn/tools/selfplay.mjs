// FLAP REBORN · 自对弈（M1 拥有）
// Node 无头，直接 import sim（无 DOM）。用固定 seed 驱动 greedy / random / noinput 三策略，
// 完成各自一局并写出 tools/fun/autoplay.json（schema 见 playbook references/playtest-protocol.md §3）。
// 运行：node tools/selfplay.mjs
import { createRun } from '../src/game/sim.js';
import { STEP, BIRD, PIPE, LEVELS } from '../config/game.config.js';
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
    tick(dt) {
      run.step(dt);
      this.simTime += dt;
      for (const e of run.drainEvents()) {
        this.seen.add(e.type);
        this.eventTimes.push(this.simTime);
        if ((e.type === 'score' || e.type === 'orb') && this.firstSuccessAt === null) {
          this.firstSuccessAt = this.simTime;
        }
        if (e.type === 'lose') this.deaths += 1;
      }
    },
    act(fn) {
      const res = fn();
      if (res && res.ok) {
        this.actions += 1;
        if (this.firstInputAt === null) this.firstInputAt = this.simTime;
        this.tick(STEP);
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
    completed: run.state.level >= LEVELS.length,
  };
}

// 下一个尚未完全越过小鸟的管道（用于决定目标高度）
function nextPipe(run) {
  return run.state.pipes.find((p) => p.x + PIPE.WIDTH / 2 >= BIRD.X - BIRD.R) || run.state.pipes[run.state.pipes.length - 1];
}

// ---------------- greedy：跟间隙中心飞（天然吃到光珠），到 80s 停止拍翼坠地，确定性收尾 ----------------
function greedy(seed) {
  const run = createRun({ seed, best: 0 });
  run.start();
  const tel = makeTracker(run, 'greedy', seed);
  const CAP = 80;
  while (run.state.phase === 'playing' && tel.simTime < CAP) {
    const p = nextPipe(run);
    const target = p ? p.gapY : run.state.bird.y;
    if (run.state.bird.y > target + 6) {
      if (tel.act(() => run.flap()).ok) continue;
    }
    tel.tick(STEP);
  }
  // 收尾：不再拍翼，让重力把它送到地面（产生 lose/best 事件，也保证死亡存在性）
  while (run.state.phase === 'playing' && tel.simTime < CAP + 10) tel.tick(STEP);
  return finish(tel, run);
}

// ---------------- random：随机拍翼，验证输入鲁棒与死亡基线 ----------------
function random(seed) {
  const run = createRun({ seed, best: 0 });
  run.start();
  const tel = makeTracker(run, 'random', seed);
  // 简单 LCG，避免依赖 sim 内部 rng
  let s = (seed * 7919 + 13) >>> 0;
  const rnd = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
  const CAP = 60;
  while (run.state.phase === 'playing' && tel.simTime < CAP) {
    if (rnd() < 0.28) {
      if (tel.act(() => run.flap()).ok) continue;
    }
    tel.tick(STEP);
  }
  return finish(tel, run);
}

// ---------------- noinput：只推进时间，测自动推进/死时间基线 ----------------
function noinput(seed) {
  const run = createRun({ seed, best: 0 });
  run.start();
  const tel = makeTracker(run, 'noinput', seed);
  while (run.state.phase === 'playing' && tel.simTime < 8) tel.tick(STEP);
  return finish(tel, run);
}

const runs = [greedy(7), random(2), noinput(5)];
const payload = {
  game: 'flap-reborn',
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
    `actions=${r.actions} deaths=${r.deaths} level=${r.levelsReached} events=${r.uniqueEvents}`,
  );
}
