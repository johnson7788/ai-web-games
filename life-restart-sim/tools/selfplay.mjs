// 人生重开模拟器 · 自对弈（bot 遥测）
// Node 无头，直接 import sim（无 DOM）。用固定 seed 驱动 greedy / random / noinput 三策略，
// 完成后写出 tools/fun/autoplay.json（schema 见 skills/webgame-playbook/references/playtest-protocol.md §3）。
// 运行：node tools/selfplay.mjs

import { createRun } from '../src/game/sim.js';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'tools', 'fun', 'autoplay.json');
const DT = 0.25; // 每步逻辑时间（秒），模拟自动播放节奏

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
    tick() { this.simTime += DT; },
    act(fn) {
      const res = fn();
      if (res && res.ok) {
        this.actions += 1;
        if (this.firstInputAt === null) this.firstInputAt = this.simTime;
      }
      this.drain();
      this.tick();
      return res;
    },
    drain() {
      for (const e of run.drainEvents()) {
        this.seen.add(e.type);
        this.eventTimes.push(this.simTime);
        if (e.type === 'summary' && this.firstSuccessAt === null) this.firstSuccessAt = this.simTime;
        if (e.type === 'death') this.deaths += 1;
      }
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
    levelsReached: run.state.stages,
    completed: run.state.completed,
  };
}

function pickThreeGreedy(run, tel) {
  const pool = run.state.talentPool.map((t, i) => ({ t, i }));
  pool.sort((a, b) => b.t.grade - a.t.grade || (b.t.status || 0) - (a.t.status || 0));
  for (const { i } of pool.slice(0, 3)) tel.act(() => run.pickTalent(i));
}

// ---------------- greedy：高稀有度天赋 + 体能优先分配，逐年推进到终局 ----------------
function greedy(seed) {
  const run = createRun({ seed, times: 0, achievements: 0 });
  const tel = makeTracker(run, 'greedy', seed);
  pickThreeGreedy(run, tel);
  tel.act(() => run.confirmTalents());
  tel.act(() => run.autoAllocate());
  tel.act(() => run.startLife(run.state.alloc));
  let guard = 400;
  while (guard-- > 0 && run.state.phase === 'life') {
    if (run.state.pendingChoice) tel.act(() => run.resolveChoice('a'));
    else tel.act(() => run.nextYear());
  }
  return finish(tel, run);
}

// ---------------- random：随机天赋/分配/抉择，验证输入鲁棒 ----------------
function random(seed) {
  const run = createRun({ seed, times: 0, achievements: 0 });
  const tel = makeTracker(run, 'random', seed);
  const rng = (() => {
    let a = (seed * 7919 + 13) >>> 0;
    return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  })();
  // 随机选 3 个不同天赋
  const idx = new Set();
  while (idx.size < 3) idx.add(Math.floor(rng() * run.state.talentPool.length));
  for (const i of idx) tel.act(() => run.pickTalent(i));
  tel.act(() => run.confirmTalents());
  // 随机分配
  let left = run.state.allocPoints;
  const keys = ['CHR', 'INT', 'STR', 'MNY'];
  keys.forEach((k) => { run.state.alloc[k] = 0; });
  while (left > 0) {
    const k = keys[Math.floor(rng() * 4)];
    const sub = Math.min(left, 1 + Math.floor(rng() * 3));
    run.state.alloc[k] += sub;
    left -= sub;
  }
  tel.act(() => run.startLife(run.state.alloc));
  let guard = 400;
  while (guard-- > 0 && run.state.phase === 'life') {
    if (run.state.pendingChoice) tel.act(() => run.resolveChoice(rng() < 0.5 ? 'a' : 'b'));
    else tel.act(() => run.nextYear());
  }
  return finish(tel, run);
}

// ---------------- noinput：零输入，只推进时间，测死时间基线 ----------------
function noinput(seed) {
  const run = createRun({ seed, times: 0, achievements: 0 });
  const tel = makeTracker(run, 'noinput', seed);
  const SECONDS = 10;
  let n = Math.round(SECONDS / DT);
  while (n-- > 0) { tel.drain(); tel.tick(); }
  return finish(tel, run);
}

const runs = [greedy(3), random(2), noinput(3)];
const payload = {
  game: 'life-restart-sim',
  genre: 'sim',
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
    `actions=${r.actions} deaths=${r.deaths} levels=${r.levelsReached} completed=${r.completed} uniq=${r.uniqueEvents}`,
  );
}
