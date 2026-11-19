// ANT FIRE SQUAD · 自对弈（M1 拥有）
// Node 无头直接 import sim（无 DOM）。用固定 seed 驱动 greedy / random / noinput 三策略，
// 写出 tools/fun/autoplay.json（schema 见 skills/webgame-playbook/references/playtest-protocol.md §3）。
// 运行：node tools/selfplay.mjs

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
    levelsReached: (carried && carried.levelsReached) ?? 1,
    seen: new Set((carried && [...carried.seen]) || []),
    eventTimes: [...((carried && carried.eventTimes) || [0])],
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
  return {
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
    levelsReached: tel.levelsReached,
    completed: run.state.phase === 'won',
  };
}

// ---------------- greedy：贴着熔炉持续投火种 + 有黄蜂就交火兵 ----------------
// 串行打 L1→L2→L3（推进率门槛要求到达第 3 关）
const TAP_XS = [420, 560, 720, 860, 640, 500, 800, 600, 460, 780];
const TAP_YS = [440, 500, 470, 520, 420, 480, 460, 440, 510, 430];

function greedyOnce(levelIndex, seed, tel0) {
  const run = createRun(levelIndex, { seed });
  const tel = makeTracker(run, 'greedy', seed, tel0);
  const MAX_SEC = 90;
  let tapTimer = 0;
  let soldierTimer = 0;
  let idx = 0;
  while (run.state.phase === 'playing' && run.state.time < MAX_SEC) {
    tapTimer -= 1 / 60;
    if (tapTimer <= 0) {
      tel.act(() => run.tap(TAP_XS[idx % TAP_XS.length], TAP_YS[idx % TAP_YS.length]));
      idx += 1;
      tapTimer = 0.15;
    }
    soldierTimer -= 1 / 60;
    const w = run.state.wasps[0];
    if (w && soldierTimer <= 0) {
      tel.act(() => run.dropSoldier(w.x, w.y));
      soldierTimer = 0.12;
    }
    tel.tick(1 / 60);
  }
  return { report: finish(tel, run), tel };
}

function greedy(seed) {
  let tel0 = null;
  let last = null;
  for (const lv of [0, 1, 2]) {
    const r = greedyOnce(lv, seed + lv, tel0);
    last = r.report;
    tel0 = r.tel;
    if (!last.completed) break;
    tel0.levelsReached = lv + 2; // 已开始下一关（1 基）
  }
  return last;
}

// ---------------- random：稀疏随机点按（不烧黄蜂），验证输入鲁棒 + 死亡基线 ----------------
function random(seed) {
  const run = createRun(0, { seed });
  const tel = makeTracker(run, 'random', seed);
  const rng = mulberry32(seed * 7919 + 13);
  const MAX_SEC = 60;
  let tapTimer = 0;
  while (run.state.phase === 'playing' && run.state.time < MAX_SEC) {
    tapTimer -= 1 / 60;
    if (tapTimer <= 0) {
      const x = 100 + rng() * 1080;
      const y = 130 + rng() * 410;
      tel.act(() => run.tap(x, y));
      tapTimer = 2.6;
    }
    tel.tick(1 / 60);
  }
  return finish(tel, run);
}

// ---------------- noinput：只推进时间，测自动推进/死时间基线 ----------------
function noinput(seed) {
  const run = createRun(0, { seed });
  const tel = makeTracker(run, 'noinput', seed);
  const MAX_SEC = 60;
  while (run.state.phase === 'playing' && run.state.time < MAX_SEC) tel.tick(1 / 60);
  return finish(tel, run);
}

const runs = [greedy(3), random(2), noinput(3)];
const payload = {
  game: 'ant-fire-squad',
  genre: 'action',
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
