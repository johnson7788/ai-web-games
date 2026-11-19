// Carrier Pigeon Dash · 自对弈（M1）
// Node 无头，直接 import sim（无 DOM）。用固定 seed 驱动 greedy / random / noinput 三策略，
// 写出 tools/fun/autoplay.json（schema 见 skills/webgame-playbook/references/playtest-protocol.md §3）。
// 运行：node tools/selfplay.mjs
import { createRun } from '../src/game/sim.js';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'tools', 'fun', 'autoplay.json');
const STEP = 1 / 60;

function makeTracker(run, policy, seed) {
  return {
    id: `${policy}-${seed}`,
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
        if (e.type === 'score' && this.firstSuccessAt === null) this.firstSuccessAt = this.simTime;
        if (e.type === 'death') this.deaths += 1;
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
    completed: false,
  };
}

// ---------------- greedy：瞄准最近塔缺口中心，低于中心 12px 即振翅；跑满 18 分（区域 3）即收 ----------------
function greedy(seed) {
  const run = createRun({ seed, best: 0 });
  const tel = makeTracker(run, 'greedy', seed);
  tel.act(() => run.start());
  const MAX_STEPS = 60 * 40;
  for (let step = 0; step < MAX_STEPS; step += 1) {
    if (run.state.phase !== 'playing' || run.state.score >= 18) break;
    const next = run.towers.find((t) => !t.passed);
    if (next) {
      const targetY = next.gapY;
      if (run.bird.y > targetY + 12 && run.bird.vy > -120) {
        tel.act(() => run.flap());
        continue;
      }
    }
    tel.tick(STEP);
  }
  return finish(tel, run);
}

// ---------------- random：低频乱拍，验证输入鲁棒，最终坠地 ----------------
function random(seed) {
  const run = createRun({ seed, best: 0 });
  const tel = makeTracker(run, 'random', seed);
  const rng = mulberry32(seed * 7919 + 13);
  const MAX_STEPS = 60 * 25;
  for (let step = 0; step < MAX_STEPS; step += 1) {
    if (run.state.phase !== 'playing' && run.state.phase !== 'ready') break;
    if (run.state.phase === 'ready' || run.state.phase === 'playing') {
      if (rng() < 0.05) {
        tel.act(() => run.flap());
        continue;
      }
    }
    tel.tick(STEP);
  }
  return finish(tel, run);
}

// ---------------- noinput：零输入，靠 3s 自动起飞兜底坠地 ----------------
function noinput(seed) {
  const run = createRun({ seed, best: 0 });
  const tel = makeTracker(run, 'noinput', seed);
  const MAX_STEPS = 60 * 8;
  for (let step = 0; step < MAX_STEPS; step += 1) {
    if (run.state.phase === 'dead') break;
    tel.tick(STEP);
  }
  return finish(tel, run);
}

function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const runs = [
  greedy(1),
  greedy(2),
  random(3),
  random(4),
  noinput(5),
  noinput(6),
];

const report = {
  game: 'carrier-pigeon-dash',
  genre: 'arcade',
  source: 'bot',
  runs,
};

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, `${JSON.stringify(report, null, 2)}\n`);
console.log(`✓ selfplay 写出 ${OUT}`);
for (const r of runs) {
  console.log(
    `  ${r.id.padEnd(10)} policy=${r.policy.padEnd(7)} dur=${r.durationSec}s ` +
    `score-first=${r.firstSuccessSec === null ? '—' : r.firstSuccessSec + 's'} ` +
    `actions=${r.actions} deaths=${r.deaths} events=${r.uniqueEvents} level=${r.levelsReached}`,
  );
}
