// IDLE FORGE · 自对弈（M1 拥有）
// Node 无头，直接 import sim（无 DOM）。用固定 seed 驱动 greedy / random / noinput 三策略，
// 写出 tools/fun/autoplay.json（schema 见 skills/webgame-playbook/references/playtest-protocol.md §3）。
// greedy 必须推进到第 3 关；noinput 证明「自动锻造持续推进、无死时间」。
// 运行：node tools/selfplay.mjs

import { createRun, mulberry32 } from '../src/game/sim.js';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'tools', 'fun', 'autoplay.json');
const LINES = ['power', 'speed', 'temp', 'apprentice'];

function makeTracker(run, policy, seed) {
  return {
    id: `${policy}-1`,
    policy,
    seed,
    level: run.state.level,
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
        if ((e.type === 'upgrade' || e.type === 'masterpiece') && this.firstSuccessAt === null) this.firstSuccessAt = this.simTime;
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
    inputLatencyMs: 0, // 纯 sim 无渲染输入延迟
    firstSuccessSec: tel.firstSuccessAt === null ? null : Number(tel.firstSuccessAt.toFixed(2)),
    deaths: tel.deaths,
    actions: tel.actions,
    idleSec: Number(idleSec.toFixed(2)),
    maxEventGapSec: Number(maxGap.toFixed(2)),
    uniqueEvents: tel.seen.size,
    levelsReached: run.state.level,
    completed: run.state.phase === 'won',
  };
}

// ---------------- greedy：买得起就买最便宜的升级，否则点铁砧；抢炉候/安抚罢工；推进到第 6 关（覆盖炉候/矿脉事件） ----------------
function greedy(seed) {
  const run = createRun(0, { seed });
  const tel = makeTracker(run, 'greedy', seed);
  const MAX_STEPS = 40000;
  for (let step = 0; step < MAX_STEPS; step += 1) {
    if (run.state.phase !== 'active' || run.state.level >= 6) break;
    const s = run.state;
    let acted = false;
    if (s.strike.active) acted = tel.act(() => run.appease()).ok;
    if (!acted && s.furnaceWindow.active) acted = tel.act(() => run.stoke()).ok;
    if (!acted) {
      for (const line of LINES) {
        if (tel.act(() => run.buy(line)).ok) { acted = true; break; }
      }
    }
    if (!acted) acted = tel.act(() => run.tap()).ok;
    tel.tick(1 / 60);
  }
  return finish(tel, run);
}

// ---------------- random：随机升级/点铁砧/加温/安抚，验证输入鲁棒 ----------------
function random(seed) {
  const run = createRun(0, { seed });
  const tel = makeTracker(run, 'random', seed);
  const rng = mulberry32(seed * 7919 + 13);
  const MAX_SEC = 45;
  while (run.state.phase === 'active' && tel.simTime < MAX_SEC) {
    const roll = rng();
    if (roll < 0.35) tel.act(() => run.buy(LINES[Math.floor(rng() * 4)]));
    else if (roll < 0.7) tel.act(() => run.tap());
    else if (roll < 0.8) tel.act(() => run.stoke());
    else tel.act(() => run.appease());
    tel.tick(1 / 60);
  }
  return finish(tel, run);
}

// ---------------- noinput：什么都不做，测自动推进/死时间基线 ----------------
function noinput(seed) {
  const run = createRun(0, { seed });
  const tel = makeTracker(run, 'noinput', seed);
  const MAX_SEC = 45;
  while (run.state.phase === 'active' && tel.simTime < MAX_SEC) {
    tel.tick(1 / 60);
  }
  return finish(tel, run);
}

const runs = [greedy(3), random(2), noinput(3)];
const payload = {
  game: 'idle-forge',
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
    `actions=${r.actions} events=${r.uniqueEvents} level=${r.levelsReached} completed=${r.completed}`,
  );
}
