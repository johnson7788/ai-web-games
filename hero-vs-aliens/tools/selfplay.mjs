// HERO VS ALIENS · 自对弈（无头，直接 import sim，无 DOM）
// 驱动 greedy / random / noinput 三策略各跑一局，写出 tools/fun/autoplay.json。
// 运行：node tools/selfplay.mjs
import { createRun, mulberry32 } from '../src/game/sim.js';
import { HERO, MAP } from '../config/game.config.js';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'tools', 'fun', 'autoplay.json');
const DT = 1 / 60;

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
    levelsReached: 1,
    completed: false,
    seen: new Set(),
    eventTimes: [0],
    tick(dt) {
      run.step(dt);
      this.simTime += dt;
      for (const e of run.drainEvents()) {
        this.seen.add(e.type);
        this.eventTimes.push(this.simTime);
        if ((e.type === 'smash' || e.type === 'collect' || e.type === 'levelClear') && this.firstSuccessAt === null) {
          this.firstSuccessAt = this.simTime;
        }
        if (e.type === 'die') this.deaths += 1;
        if (e.type === 'win') this.completed = true;
      }
      this.levelsReached = run.state.level;
    },
    act(fn) {
      const r = fn();
      if (r && r.ok) {
        this.actions += 1;
        if (this.firstInputAt === null) this.firstInputAt = this.simTime;
        this.tick(DT);
      }
      return r;
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

// ---------------- greedy：完美发射 + 贴中央安全航道 + 每跳下砸 ----------------
function greedy(seed) {
  const run = createRun(0, { seed });
  const tel = makeTracker(run, 'greedy', seed);
  tel.act(() => run.setAim(0));
  tel.act(() => run.launch());

  const MAX_STEPS = 60 * 60 * 2; // 模拟上限 2 分钟
  for (let i = 0; i < MAX_STEPS; i += 1) {
    if (run.state.phase !== 'flying') break;
    const hop = run.state.hop;
    if (hop && !hop.dropQueued) {
      // 先修正航向（贴中央），再下砸
      const dx = MAP.CENTER - run.state.hero.x;
      const lean = Math.max(-1, Math.min(1, dx / HERO.STEER_RANGE));
      tel.act(() => run.steer(lean));
      tel.act(() => run.drop());
    }
    tel.tick(DT);
  }
  return finish(tel, run);
}

// ---------------- random：随机角度/随机转向/随机下砸 ----------------
function random(seed) {
  const run = createRun(0, { seed });
  const tel = makeTracker(run, 'random', seed);
  const rng = mulberry32(seed * 7919 + 13);
  tel.act(() => run.setAim(rng() * 40 - 20));
  tel.act(() => run.launch());

  const MAX_STEPS = 60 * 60 * 2;
  for (let i = 0; i < MAX_STEPS; i += 1) {
    if (run.state.phase !== 'flying') break;
    const hop = run.state.hop;
    if (hop) {
      if (!hop.dropQueued && rng() < 0.5) tel.act(() => run.steer(rng() * 2 - 1));
      if (!hop.dropQueued && rng() < 0.4) tel.act(() => run.drop());
    }
    tel.tick(DT);
  }
  return finish(tel, run);
}

// ---------------- noinput：零操作，只推进时间（自动发射兜底） ----------------
function noinput(seed) {
  const run = createRun(0, { seed });
  const tel = makeTracker(run, 'noinput', seed);
  const MAX_STEPS = 60 * 60 * 2;
  for (let i = 0; i < MAX_STEPS; i += 1) {
    if (run.state.phase !== 'aim' && run.state.phase !== 'flying') break;
    tel.tick(DT);
  }
  return finish(tel, run);
}

const runs = [greedy(3), random(2), noinput(3)];
const payload = {
  game: 'hero-vs-aliens',
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
    `actions=${r.actions} deaths=${r.deaths} levels=${r.levelsReached} completed=${r.completed}`,
  );
}
