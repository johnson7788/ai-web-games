// Happy Glass Pour · 自对弈（M1 拥有）
// Node 无头，直接 import sim（无 DOM）。固定 seed 驱动 greedy / random / noinput 三策略，
// 完成关卡并写出 tools/fun/autoplay.json（schema 见 skills/webgame-playbook/references/playtest-protocol.md §3）。
// 运行：node tools/selfplay.mjs
import { createRun } from '../src/game/sim.js';
import { LEVELS } from '../config/levels.js';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'tools', 'fun', 'autoplay.json');

function makeTracker(run, id, policy, seed, carried) {
  return {
    id,
    policy,
    seed,
    simTime: (carried && carried.simTime) ?? 0,
    firstInputAt: (carried && carried.firstInputAt) ?? null,
    firstSuccessAt: (carried && carried.firstSuccessAt) ?? null,
    deaths: (carried && carried.deaths) ?? 0,
    seen: new Set((carried && [...carried.seen]) || []),
    eventTimes: (carried && [...carried.eventTimes]) || [0],
    markAction() {
      if (this.firstInputAt === null) this.firstInputAt = this.simTime;
    },
    tick(dt) {
      this.simTime += dt;
      for (const e of run.drainEvents()) {
        this.seen.add(e.type);
        this.eventTimes.push(this.simTime);
        if (e.type === 'win' && this.firstSuccessAt === null) this.firstSuccessAt = this.simTime;
        if (e.type === 'lose') this.deaths += 1;
      }
    },
  };
}

function finish(tel, run, levelReached) {
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
    level: levelReached,
    durationSec: Number(tel.simTime.toFixed(2)),
    firstInputSec: Number((tel.firstInputAt ?? 0).toFixed(2)),
    inputLatencyMs: 0, // 纯 sim 无渲染输入延迟
    firstSuccessSec: tel.firstSuccessAt === null ? null : Number(tel.firstSuccessAt.toFixed(2)),
    deaths: tel.deaths,
    actions: run.state.actions,
    idleSec: Number(idleSec.toFixed(2)),
    maxEventGapSec: Number(maxGap.toFixed(2)),
    uniqueEvents: tel.seen.size,
    levelsReached: levelReached,
    completed: run.state.phase === 'won',
  };
}

function runToEnd(run, tel, maxSec) {
  const steps = Math.ceil(maxSec * 60);
  for (let i = 0; i < steps; i += 1) {
    if (run.state.phase === 'won' || run.state.phase === 'lost') break;
    run.step(1 / 60);
    tel.tick(1 / 60);
  }
  // 兜底：把仍在进行的一局走完（时间到判负）
  while (run.state.phase === 'pour' && tel.simTime < maxSec + 2) {
    run.step(1 / 60);
    tel.tick(1 / 60);
  }
}

// ---------------- greedy：按提示线画轨道，串行打 L1→L3（推进率门槛要求到达第 3 关） ----------------
function greedy(seed) {
  let carried = null;
  let last = null;
  let totalActions = 0;
  const targets = [0, 1, 2];
  for (const lv of targets) {
    const run = createRun(lv, { seed: seed + lv });
    const tel = makeTracker(run, `greedy-${lv + 1}`, 'greedy', seed + lv, carried);
    for (const poly of run._level.answer) {
      run.drawLine(poly);
      tel.markAction();
      tel.tick(0);
    }
    run.pour();
    tel.markAction();
    runToEnd(run, tel, LEVELS[lv].timeLimit + 6);
    totalActions += run.state.actions;
    last = finish(tel, run, lv + 1);
    last.actions = totalActions;
    if (!last.completed) break;
    carried = tel;
  }
  return last;
}

// ---------------- random：随机乱画多笔后放水，验证输入鲁棒 ----------------
function randomOnce(seed) {
  const lv = 0;
  const run = createRun(lv, { seed });
  const tel = makeTracker(run, 'random-1', 'random', seed);
  let s = seed * 7919 + 13;
  const rng = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  const pts = [];
  let px = 400 + rng() * 300;
  let py = 200;
  for (let i = 0; i < 12; i += 1) {
    px += (rng() - 0.5) * 160;
    py += rng() * 46;
    pts.push([Math.max(80, Math.min(1200, px)), Math.max(140, Math.min(660, py))]);
  }
  run.drawLine(pts);
  tel.markAction();
  run.pour();
  tel.markAction();
  runToEnd(run, tel, LEVELS[lv].timeLimit + 6);
  return finish(tel, run, 1);
}

// ---------------- noinput：完全不操作，只推进时间（基线） ----------------
function noinput(seed) {
  const lv = 0;
  const run = createRun(lv, { seed });
  const tel = makeTracker(run, 'noinput-1', 'noinput', seed);
  runToEnd(run, tel, 20);
  return finish(tel, run, 1);
}

const runs = [greedy(3), randomOnce(2), noinput(3)];
const payload = {
  game: 'happy-glass-pour',
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
    `actions=${r.actions} deaths=${r.deaths} completed=${r.completed} level=${r.levelsReached}`,
  );
}
