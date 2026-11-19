// SPOT THE ODD · 自对弈（M1 拥有）
// Node 无头，直接 import sim（无 DOM）。用固定 seed 驱动 greedy / random / noinput 三策略，
// 完成一局并写出 tools/fun/autoplay.json（schema 见 skills/webgame-playbook/references/playtest-protocol.md §3）。
// 运行：node tools/selfplay.mjs

import { createRun, step, tap, hint, drainEvents, ROUNDS, ROUND_TIME } from '../src/game/sim.js';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'tools', 'fun', 'autoplay.json');

function makeTracker(run, policy, seed) {
  const t = {
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
      step(run, dt);
      t.simTime += dt;
      for (const e of drainEvents(run)) {
        t.seen.add(e.type);
        t.eventTimes.push(t.simTime);
        if (e.type === 'roundWin' && t.firstSuccessAt === null) t.firstSuccessAt = t.simTime;
        if (e.type === 'roundLose') t.deaths += 1; // 每输一回合记 1 次失败（deathPresence 证据）
      }
    },
    act(fn) {
      const res = fn();
      if (res && res.ok) {
        t.actions += 1;
        if (t.firstInputAt === null) t.firstInputAt = t.simTime;
      }
      t.tick(1 / 60);
      return res;
    },
  };
  return t;
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
  const r2 = (n) => Number(n.toFixed(2));
  return {
    id: tel.id,
    policy: tel.policy,
    seed: tel.seed,
    durationSec: r2(tel.simTime),
    firstInputSec: r2(tel.firstInputAt ?? 0),
    inputLatencyMs: 0, // 纯 sim 无渲染输入延迟
    firstSuccessSec: tel.firstSuccessAt === null ? null : r2(tel.firstSuccessAt),
    deaths: tel.deaths,
    actions: tel.actions,
    idleSec: r2(idleSec),
    maxEventGapSec: r2(maxGap),
    uniqueEvents: tel.seen.size,
    levelsReached: run.round,
    completed: run.finished,
  };
}

// ---------------- greedy：先点异类，再用一次提示，然后逐个点对任务类别 ----------------
function greedy(seed) {
  const run = createRun(seed);
  const tel = makeTracker(run, 'greedy', seed);
  const MAX = 5000;
  let guard = 0;
  let hinted = false;
  while (!run.finished && guard < MAX) {
    guard += 1;
    // 点异类（每回合 1 个，赚时间/分/事件）
    for (let i = 0; i < run.items.length; i += 1) {
      const it = run.items[i];
      if (it.odd && !it.oddResolved) { tel.act(() => tap(run, i)); break; }
    }
    // 开局用一次提示，丰富事件种类（hint）
    if (!hinted && run.hintLeft > 0) {
      hinted = true;
      tel.act(() => hint(run));
      if (run.hintIndex != null) tel.act(() => tap(run, run.hintIndex));
    }
    // 点一个任务类别物品
    let did = false;
    for (let i = 0; i < run.items.length; i += 1) {
      const it = run.items[i];
      if (!it.collected && it.cat === run.task.cat && !(it.odd && !it.oddResolved)) {
        tel.act(() => tap(run, i));
        did = true;
        break;
      }
    }
    if (!did) tel.tick(1 / 60);
  }
  return finish(tel, run);
}

// ---------------- random：随机点选，验证输入鲁棒与失败存在性 ----------------
function random(seed) {
  const run = createRun(seed);
  const tel = makeTracker(run, 'random', seed);
  const rng = (() => {
    let a = (seed * 7919 + 13) >>> 0;
    return () => {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t2 = Math.imul(a ^ (a >>> 15), 1 | a);
      t2 = (t2 + Math.imul(t2 ^ (t2 >>> 7), 61 | t2)) ^ t2;
      return ((t2 ^ (t2 >>> 14)) >>> 0) / 4294967296;
    };
  })();
  const MAX_SEC = (ROUND_TIME + 5) * ROUNDS;
  let guard = 0;
  while (!run.finished && guard < MAX_SEC * 60 * 2) {
    guard += 1;
    const idx = Math.floor(rng() * run.items.length);
    tel.act(() => tap(run, idx));
    if (run.finished) break;
  }
  return finish(tel, run);
}

// ---------------- noinput：只推进时间，测自动推进 / 死时间基线 / 必输 ----------------
function noinput(seed) {
  const run = createRun(seed);
  const tel = makeTracker(run, 'noinput', seed);
  const MAX_SEC = (ROUND_TIME + 5) * ROUNDS;
  let guard = 0;
  while (!run.finished && guard < MAX_SEC * 60 * 2) {
    tel.tick(1 / 60);
    guard += 1;
  }
  return finish(tel, run);
}

const runs = [greedy(3), random(2), noinput(3)];
const payload = {
  game: 'spot-the-odd',
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
    `actions=${r.actions} deaths=${r.deaths} events=${r.uniqueEvents} completed=${r.completed}`,
  );
}
