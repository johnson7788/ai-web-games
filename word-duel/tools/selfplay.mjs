// WORD DUEL · 自对弈（M1 拥有）
// Node 无头，直接 import sim（无 DOM）。用固定 seed 驱动 greedy / random / noinput 三策略，
// 写出 tools/fun/autoplay.json（schema 见 skills/webgame-playbook/references/playtest-protocol.md §3）。
// 运行：node tools/selfplay.mjs
import { createRun, mulberry32, findBestWord, indicesForWord } from '../src/game/sim.js';
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
    level: (carried && carried.level) ?? run.state.level,
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
        if (e.type === 'win' && this.firstSuccessAt === null) this.firstSuccessAt = this.simTime;
        if (e.type === 'lose') this.deaths += 1;
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
  const out = {
    id: tel.id,
    policy: tel.policy,
    seed: tel.seed,
    level: tel.level,
    durationSec: Number(tel.simTime.toFixed(3)),
    firstInputSec: Number((tel.firstInputAt ?? 0).toFixed(3)),
    inputLatencyMs: 0, // 纯 sim 无渲染输入延迟
    firstSuccessSec: tel.firstSuccessAt === null ? null : Number(tel.firstSuccessAt.toFixed(3)),
    deaths: tel.deaths,
    actions: tel.actions,
    idleSec: Number(idleSec.toFixed(3)),
    maxEventGapSec: Number(maxGap.toFixed(3)),
    uniqueEvents: tel.seen.size,
    levelsReached: tel.level,
    completed: run.state.phase === 'won',
  };
  out._tel = tel;
  return out;
}

// ---------------- greedy：每回合拼最长词，串行打 L1→L2→L3 ----------------
function greedyOnce(levelIndex, seed, tel0) {
  const run = createRun(levelIndex, { seed });
  const tel = makeTracker(run, 'greedy', seed, tel0);
  let guard = 0;
  while (run.state.phase === 'playing' && guard++ < 300) {
    const letters = run.state.hand.map((h) => h.ch);
    const word = findBestWord(letters);
    if (!word) {
      tel.act(() => run.swap());
      tel.tick(1 / 60);
      continue;
    }
    const idx = indicesForWord(letters, word);
    tel.act(() => {
      for (const i of idx) run.selectLetter(i);
      return run.submitWord();
    });
    tel.tick(1 / 60);
  }
  return finish(tel, run);
}

function greedy(seed) {
  let carried = null;
  let last = null;
  for (const lv of [0, 1, 2]) {
    last = greedyOnce(lv, seed + lv, carried);
    carried = last._tel;
    if (!last.completed) break;
    carried.level = lv + 2; // 已开始下一关（1 基）
  }
  return last;
}

// ---------------- random：乱按，验证输入鲁棒 + 死亡存在性 ----------------
function random(seed) {
  const run = createRun(0, { seed });
  const tel = makeTracker(run, 'random', seed);
  const rng = mulberry32(seed * 7919 + 13);
  let guard = 0;
  while (run.state.phase === 'playing' && guard++ < 1200) {
    const roll = rng();
    if (roll < 0.4) {
      const i = Math.floor(rng() * run.state.hand.length);
      tel.act(() => run.selectLetter(i));
    } else if (roll < 0.55) {
      tel.act(() => run.deselectLast());
    } else if (roll < 0.8) {
      tel.act(() => run.submitWord());
    } else {
      tel.act(() => run.swap());
    }
    tel.tick(1 / 60);
  }
  // 兜底：还没结束就把时间推到超时输
  while (run.state.phase === 'playing' && tel.simTime < 600) tel.tick(1 / 60);
  return finish(tel, run);
}

// ---------------- noinput：只推进时间，验证自动推进基线 + 死亡存在性 ----------------
function noinput(seed) {
  const run = createRun(0, { seed });
  const tel = makeTracker(run, 'noinput', seed);
  let guard = 0;
  // 空转到回合超时 → 敌人每回合攻击 → 玩家最终死亡（自动推进基线）
  while (run.state.phase === 'playing' && guard++ < 900 * 60) {
    tel.tick(1 / 60);
  }
  return finish(tel, run);
}

const runs = [greedy(3), random(2), noinput(3)];
const payload = {
  game: 'word-duel',
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
    `actions=${r.actions} deaths=${r.deaths} events=${r.uniqueEvents} lvl=${r.levelsReached} completed=${r.completed}`,
  );
}
