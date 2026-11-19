// Bunny Gold Digger · 自对弈（纯逻辑，无 DOM）
// 用固定 seed 驱动 greedy / random / noinput 三策略，写出 tools/fun/autoplay.json。
// greedy 串行打 L1→L2→L3（推进率门槛要求到达第 3 关）；random 乱按；noinput 只推时间。
// 遥测口径：deaths = 抓到石头的惩罚次数 + 关卡失败次数（本作无生命条，用惩罚/失败作“死亡”代理）。
import { createRun, mulberry32, STEP } from '../src/game/sim.js';
import { greedyPick } from '../src/game/bots.js';
import { CLAW } from '../config/game.config.js';
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
        if (e.type === 'grab' && this.firstSuccessAt === null) this.firstSuccessAt = this.simTime;
        if (e.type === 'lose' || e.type === 'rockHit') this.deaths += 1;
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

function finish(tel, run, policy, seed, levelsReached) {
  const times = tel.eventTimes.slice().sort((a, b) => a - b);
  let maxGap = 0;
  let idleSec = 0;
  for (let i = 1; i < times.length; i += 1) {
    const gap = times[i] - times[i - 1];
    if (gap > maxGap) maxGap = gap;
    if (gap > 3) idleSec += gap - 3;
  }
  return {
    id: `${policy}-1`,
    policy,
    seed,
    level: levelsReached,
    durationSec: Number(tel.simTime.toFixed(2)),
    firstInputSec: Number((tel.firstInputAt ?? 0).toFixed(2)),
    inputLatencyMs: 0,
    firstSuccessSec: tel.firstSuccessAt === null ? null : Number(tel.firstSuccessAt.toFixed(2)),
    deaths: tel.deaths,
    actions: tel.actions,
    idleSec: Number(idleSec.toFixed(2)),
    maxEventGapSec: Number(maxGap.toFixed(2)),
    uniqueEvents: tel.seen.size,
    levelsReached,
    completed: run.state.phase === 'won',
  };
}

// 精确摆到目标角度并下放（把钩角对齐到目标，模拟完美时机，保证可复现）
function aimDrop(run, angle, tel) {
  for (let i = 0; i < 400 && run.state.phase === 'playing'; i += 1) {
    const before = run.state.hook.angle;
    tel.tick(STEP);
    const after = run.state.hook.angle;
    if (run.state.phase !== 'playing') return false;
    const d = run.state.hook.dir;
    if (d === 1 && before < angle && after >= angle) {
      run.state.hook.angle = angle;
      tel.act(() => run.drop());
      tel.tick(STEP);
      return true;
    }
    if (d === -1 && before > angle && after <= angle) {
      run.state.hook.angle = angle;
      tel.act(() => run.drop());
      tel.tick(STEP);
      return true;
    }
  }
  return false;
}

function greedyLevel(levelIndex, seed, carried) {
  const run = createRun(levelIndex, { seed });
  const tel = makeTracker(run, 'greedy', seed, carried);
  const MAX = run.state.initialTime + 2;
  while (run.state.phase === 'playing' && tel.simTime < MAX) {
    const h = run.state.hook;
    if (h.phase !== 'swinging') { tel.tick(STEP); continue; }
    const pick = greedyPick(run);
    if (!pick) { tel.tick(STEP); continue; }
    if (pick.type === 'power') { tel.act(() => run.power()); tel.tick(STEP); continue; }
    if (pick.type === 'bank') { tel.act(() => run.bank()); tel.tick(STEP); continue; }
    if (pick.type === 'drop') {
      if (!aimDrop(run, pick.angle, tel) && run.state.phase === 'playing') {
        tel.act(() => run.drop());
        tel.tick(STEP);
      }
      continue;
    }
    tel.tick(STEP);
  }
  return { tel, run };
}

function greedy(seed) {
  let carried = null;
  let lastLevel = 0;
  let lastRun = null;
  for (const lv of [0, 1, 2]) {
    const { tel, run } = greedyLevel(lv, seed + lv, carried);
    lastLevel = lv + 1;
    carried = tel;
    lastRun = run;
    if (run.state.phase !== 'won') break;
  }
  return finish(carried, lastRun, 'greedy', seed, lastLevel);
}

function random(seed) {
  const run = createRun(0, { seed });
  const tel = makeTracker(run, 'random', seed);
  const rng = mulberry32(seed * 7919 + 13);
  const MAX = run.state.initialTime + 2;
  let nextDrop = tel.simTime + 0.4 + rng() * 0.8;
  while (run.state.phase === 'playing' && tel.simTime < MAX) {
    if (run.state.hook.phase === 'swinging' && tel.simTime >= nextDrop) {
      // 随机角度乱抓（直接对齐到随机摆角再下放，模拟随机时机落点）
      run.state.hook.angle = (rng() * 2 - 1) * CLAW.swingMax * 0.92;
      tel.act(() => run.drop());
      tel.tick(STEP);
      nextDrop = tel.simTime + 0.1 + rng() * 0.4;
    } else {
      tel.tick(STEP);
    }
  }
  return finish(tel, run, 'random', seed, 1);
}

function noinput(seed) {
  const run = createRun(0, { seed });
  const tel = makeTracker(run, 'noinput', seed);
  const MAX = run.state.initialTime + 2;
  while (run.state.phase === 'playing' && tel.simTime < MAX) {
    tel.tick(STEP);
  }
  return finish(tel, run, 'noinput', seed, 1);
}

const runs = [greedy(3), random(2), noinput(3)];
const payload = {
  game: 'bunny-gold-digger',
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
    `${r.id.padEnd(9)} policy=${r.policy.padEnd(8)} dur=${r.durationSec}s ` +
    `firstInput=${r.firstInputSec}s firstSuccess=${r.firstSuccessSec ?? '—'} ` +
    `actions=${r.actions} deaths=${r.deaths} levels=${r.levelsReached} completed=${r.completed}`,
  );
}
