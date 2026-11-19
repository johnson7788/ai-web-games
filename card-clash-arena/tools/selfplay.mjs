// Card Clash Arena · 自对弈（无头，直接 import sim，无 DOM）。
// 用固定 seed 驱动 greedy / random / noinput 三策略，写 tools/fun/autoplay.json。
// 遥测口径（回合制卡牌）：deaths = 输掉的回合数；firstSuccess = 首次赢下一回合；
// idle 按「死时间」计：相邻事件/有效操作间隔超过 IDLE_GAP(1.0s) 的部分才累计。
// 运行：node tools/selfplay.mjs
import { createRun, mulberry32 } from '../src/game/sim.js';
import { CARDS } from '../config/cards.js';
import { GAME } from '../config/game.config.js';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'tools', 'fun', 'autoplay.json');
const IDLE_GAP = 1.0;
const r2 = (v) => Number(v.toFixed(2));

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
        if (e.type === 'roundWin' && this.firstSuccessAt === null) this.firstSuccessAt = this.simTime;
        if (e.type === 'roundLose') this.deaths += 1;
      }
    },
    act(fn) {
      const res = fn();
      if (res && res.ok) {
        this.actions += 1;
        if (this.firstInputAt === null) this.firstInputAt = this.simTime;
        this.eventTimes.push(this.simTime);
        this.tick(1 / 60);
      }
      return res;
    },
  };
}

function finish(tel, run) {
  const times = tel.eventTimes.slice().sort((a, b) => a - b);
  let maxGap = 0;
  let idle = 0;
  for (let i = 1; i < times.length; i += 1) {
    const gap = times[i] - times[i - 1];
    if (gap > maxGap) maxGap = gap;
    if (gap > IDLE_GAP) idle += gap - IDLE_GAP;
  }
  return {
    id: tel.id,
    policy: tel.policy,
    seed: tel.seed,
    durationSec: r2(tel.simTime),
    firstInputSec: r2(tel.firstInputAt ?? 0),
    inputLatencyMs: 0,
    firstSuccessSec: tel.firstSuccessAt === null ? null : r2(tel.firstSuccessAt),
    deaths: tel.deaths,
    actions: tel.actions,
    idleSec: r2(idle),
    maxEventGapSec: r2(maxGap),
    uniqueEvents: tel.seen.size,
    levelsReached: run.state.round,
    completed: run.state.phase === 'won',
  };
}

function bestCardInHand(run) {
  let best = run.state.hand[0];
  let bestV = -1;
  for (const id of run.state.hand) {
    const v = CARDS[id].stats[run.state.roundAttribute];
    if (v > bestV) { bestV = v; best = id; }
  }
  return best;
}

// greedy：每回合出当前属性最高的卡；金币够就超频、否则强化（真实可利用的贪心）
function greedy(seed) {
  const run = createRun(seed);
  const tel = makeTracker(run, 'greedy', seed);
  let guard = 0;
  while (run.state.phase !== 'won' && run.state.phase !== 'lost' && guard < 20000) {
    guard += 1;
    if (run.state.phase === 'playerTurn') {
      if (run.state.coins >= GAME.OVERDRIVE_COST) tel.act(() => run.useAbility('overdrive'));
      else if (run.state.coins >= GAME.BUFF_COST) tel.act(() => run.useAbility('buff'));
      tel.act(() => run.playCard(bestCardInHand(run)));
    } else {
      tel.tick(1 / 60);
    }
  }
  return finish(tel, run);
}

// random：随机出牌 + 随机尝试技能（验证输入鲁棒）
function random(seed) {
  const run = createRun(seed);
  const tel = makeTracker(run, 'random', seed);
  const rng = mulberry32(seed * 7919 + 13);
  let guard = 0;
  while (run.state.phase !== 'won' && run.state.phase !== 'lost' && guard < 20000) {
    guard += 1;
    if (run.state.phase === 'playerTurn') {
      if (rng() < 0.35) {
        const kinds = ['buff', 'debuff', 'overdrive', 'cancel'];
        tel.act(() => run.useAbility(kinds[Math.floor(rng() * kinds.length)]));
      }
      const pick = run.state.hand[Math.floor(rng() * run.state.hand.length)];
      tel.act(() => run.playCard(pick));
    } else {
      tel.tick(1 / 60);
    }
  }
  return finish(tel, run);
}

// noinput：不操作，只推进时间，测自动推进/死时间基线与失败存在性
function noinput(seed) {
  const run = createRun(seed);
  const tel = makeTracker(run, 'noinput', seed);
  let guard = 0;
  while (run.state.phase !== 'won' && run.state.phase !== 'lost' && guard < 40000) {
    guard += 1;
    tel.tick(1 / 60);
  }
  return finish(tel, run);
}

const runs = [greedy(11), random(7), noinput(3)];
const payload = {
  game: 'card-clash-arena',
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
    `actions=${r.actions} deaths=${r.deaths} rounds=${r.levelsReached} completed=${r.completed} ` +
    `idle=${r.idleSec}s maxGap=${r.maxEventGapSec}s events=${r.uniqueEvents}`,
  );
}
