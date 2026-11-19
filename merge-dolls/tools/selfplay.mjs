// MERGE DOLLS · 自对弈（无头 Node，纯 sim）。
// 三策略 greedy / random / noinput → tools/fun/autoplay.json（schema 见 playtest-protocol §3）。
// 运行：node tools/selfplay.mjs
import { createSim } from '../src/game/sim.js';
import { dollByLevel, MAX_LEVEL } from '../config/levels.js';
import { GAME } from '../config/game.config.js';
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
        if (e.type === 'merge' && this.firstSuccessAt === null) this.firstSuccessAt = this.simTime;
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
    levelsReached: run.state.stage,
    completed: run.state.stage >= 3,
  };
}

const slots = (run) => run.state.tabs[run.state.tab].slots;
const cur = (run) => run.state.tabs[run.state.tab];

function mergePairs(run) {
  const out = [];
  const s = slots(run);
  for (let lv = 1; lv < MAX_LEVEL; lv += 1) {
    const idx = [];
    s.forEach((sl, i) => { if (sl.doll === lv) idx.push(i); });
    for (let i = 0; i + 1 < idx.length; i += 1) out.push([idx[i], idx[i + 1]]);
  }
  return out;
}

function canBuy(run) {
  if (run.state.gold < dollByLevel(1).cost) return false;
  return slots(run).some((sl) => !sl.doll && !sl.rock);
}

// ---------------- greedy：优先合成高阶同款 → 买 → 清岩 → 一次回收/交换 ----------------
function greedy(seed) {
  const run = createSim({ seed });
  const tel = makeTracker(run, 'greedy', seed);
  const MAX_SEC = 100;
  let didSell = false;
  let didSwap = false;
  let holdBuyUntil = -Infinity;

  while (tel.simTime < MAX_SEC) {
    const s = slots(run);

    // 一次性回收：腾出空位让岩块有时间生成（并覆盖 sell 事件）
    if (!didSell && tel.simTime > 4) {
      const i = s.findIndex((sl) => sl.doll > 0);
      if (i >= 0) { tel.act(() => run.sell(i)); didSell = true; holdBuyUntil = tel.simTime + 18; continue; }
    }
    // 一次性交换（覆盖 swap 事件）
    if (!didSwap && tel.simTime > 6) {
      const a = s.findIndex((sl) => sl.doll > 0);
      const b = s.findIndex((sl, i) => sl.doll > 0 && sl.doll !== s[a]?.doll && i !== a);
      if (a >= 0 && b >= 0) { tel.act(() => run.drag(a, b)); didSwap = true; continue; }
    }

    const rock = s.findIndex((sl) => sl.rock);
    if (rock >= 0) { tel.act(() => run.tapRock(rock)); continue; }

    const pairs = mergePairs(run);
    if (pairs.length) {
      pairs.sort((a, b) => s[b[0]].doll - s[a[0]].doll);
      const r = tel.act(() => run.drag(pairs[0][0], pairs[0][1]));
      if (r && r.ok) continue;
    }

    if (tel.simTime >= holdBuyUntil && canBuy(run)) { tel.act(() => run.buy()); continue; }

    tel.tick(1 / 60);
  }
  return finish(tel, run);
}

// ---------------- random：随机拖拽/购买/清岩（输入鲁棒基线） ----------------
function random(seed) {
  const run = createSim({ seed });
  const tel = makeTracker(run, 'random', seed);
  const MAX_SEC = 90;
  let a = (seed * 7919 + 13) >>> 0;
  const rng = () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  while (tel.simTime < MAX_SEC) {
    const s = slots(run);
    const roll = rng();
    const rock = s.findIndex((sl) => sl.rock);
    const pairs = mergePairs(run);
    const dollIdx = [];
    s.forEach((sl, i) => { if (sl.doll > 0) dollIdx.push(i); });

    if (roll < 0.12 && rock >= 0) { tel.act(() => run.tapRock(rock)); continue; }
    if (roll < 0.4 && pairs.length) {
      const p = pairs[Math.floor(rng() * pairs.length)];
      const r = tel.act(() => run.drag(p[0], p[1]));
      if (r && r.ok) continue;
    }
    if (roll < 0.62) {
      if (canBuy(run)) { tel.act(() => run.buy()); continue; }
    }
    if (dollIdx.length >= 1) {
      const aIdx = dollIdx[Math.floor(rng() * dollIdx.length)];
      // 目标：非岩块、非同源格（空格或玩偶均可）
      const targets = [];
      s.forEach((sl, i) => { if (i !== aIdx && !sl.rock) targets.push(i); });
      if (targets.length) {
        const b = targets[Math.floor(rng() * targets.length)];
        const r = tel.act(() => run.drag(aIdx, b));
        if (r && r.ok) continue;
      }
    }
    tel.tick(1 / 60);
  }
  return finish(tel, run);
}

// ---------------- noinput：只推进时间（死时间基线） ----------------
function noinput(seed) {
  const run = createSim({ seed });
  const tel = makeTracker(run, 'noinput', seed);
  const MAX_SEC = 60;
  while (tel.simTime < MAX_SEC) tel.tick(1 / 60);
  return finish(tel, run);
}

const runs = [greedy(3), random(2), noinput(3)];
const payload = { game: 'merge-dolls', genre: 'sim', source: 'bot', version: 'm1', runs };

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, `${JSON.stringify(payload, null, 2)}\n`);
console.log(`wrote ${OUT} (${runs.length} runs)`);
for (const r of runs) {
  console.log(
    `${r.id.padEnd(10)} policy=${r.policy.padEnd(8)} dur=${r.durationSec}s ` +
    `firstInput=${r.firstInputSec}s firstSuccess=${r.firstSuccessSec ?? '—'} ` +
    `actions=${r.actions} levels=${r.levelsReached} events=${r.uniqueEvents} ` +
    `maxGap=${r.maxEventGapSec}s idle=${r.idleSec}s completed=${r.completed}`,
  );
}
