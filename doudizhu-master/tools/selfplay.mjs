// DOUDIZHU MASTER · 自对弈（bot 遥测）
// Node 无头，直接 import sim（无 DOM）。greedy / random / noinput 三策略驱动完整牌局，
// 写出 tools/fun/autoplay.json（schema 见 skills/webgame-playbook/references/playtest-protocol.md §3）。
// 运行：node tools/selfplay.mjs

import { createRun, legalMoves, mulberry32 } from '../src/game/sim.js';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'tools', 'fun', 'autoplay.json');
const AI_THINK_MS = 400;

function newTracker(id, policy, seed) {
  return {
    id,
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
      this.simTime += dt;
    },
    drain(run) {
      for (const e of run.drainEvents()) {
        this.seen.add(e.type);
        this.eventTimes.push(this.simTime);
        if (e.type === 'win' && this.firstSuccessAt === null) this.firstSuccessAt = this.simTime;
        if (e.type === 'lose') this.deaths += 1;
      }
    },
    act(res) {
      if (res && res.ok) {
        this.actions += 1;
        if (this.firstInputAt === null) this.firstInputAt = this.simTime;
      }
    },
  };
}

function selectAndPlay(run, move) {
  run.deselectAll();
  for (const c of move.cards) run.selectCard(c.id);
  return run.playSelected();
}

// 打一整局（turn0 用策略函数），返回是否「你」赢；同时推进 tel。
function playRound(run, tel, policy) {
  let guard = 0;
  while (run.state.phase === 'playing' && guard < 200000) {
    guard += 1;
    if (run.state.turn === 0) {
      const res = policy(run);
      tel.act(res);
      tel.drain(run);
    } else {
      tel.tick(1 / 60);
      run.step(1 / 60);
      tel.drain(run);
    }
  }
  tel.drain(run);
  return run.state.winner === 'you';
}

function finish(tel, levelsReached, completed) {
  const times = tel.eventTimes.slice().sort((a, b) => a - b);
  let maxGap = 0;
  let idleSec = 0;
  for (let i = 1; i < times.length; i += 1) {
    const gap = times[i] - times[i - 1];
    if (gap > maxGap) maxGap = gap;
    if (gap > 3) idleSec += gap - 3;
  }
  const durationSec = Math.max(tel.simTime, 0.5);
  return {
    id: tel.id,
    policy: tel.policy,
    seed: tel.seed,
    durationSec: Number(durationSec.toFixed(2)),
    firstInputSec: Number((tel.firstInputAt ?? durationSec).toFixed(2)),
    inputLatencyMs: 0,
    firstSuccessSec: tel.firstSuccessAt === null ? null : Number(tel.firstSuccessAt.toFixed(2)),
    deaths: tel.deaths,
    actions: tel.actions,
    idleSec: Number(idleSec.toFixed(2)),
    maxEventGapSec: Number(maxGap.toFixed(2)),
    uniqueEvents: tel.seen.size,
    levelsReached,
    completed,
  };
}

// ---------------- greedy：地主贪婪，串行打到第 3 局（每局换 seed 重试直到赢） ----------------
function greedy(baseSeed) {
  const tel = newTracker('greedy-1', 'greedy', baseSeed);
  const greedyPolicy = (run) => run.autoPlay();
  let levelsReached = 1;
  let completed = false;
  for (let lv = 1; lv <= 3; lv += 1) {
    let won = false;
    for (let attempt = 0; attempt < 400 && !won; attempt += 1) {
      const seed = (baseSeed + lv * 7919 + attempt * 13) | 0;
      const run = createRun(lv, { seed, aiThinkMs: AI_THINK_MS });
      won = playRound(run, tel, greedyPolicy);
    }
    levelsReached = lv;
    completed = won;
    if (!won) break;
  }
  return finish(tel, levelsReached, completed);
}

// ---------------- random：随机合法出牌，验证输入鲁棒 ----------------
function random(seed) {
  const tel = newTracker('random-1', 'random', seed);
  const rng = mulberry32(seed * 7919 + 13);
  const randomPolicy = (run) => {
    const hand = run.state.players[0].hand;
    const moves = legalMoves(hand, run.state.lastMove);
    if (moves.length) {
      const m = moves[Math.floor(rng() * moves.length)];
      return selectAndPlay(run, m);
    }
    if (run.state.lastMove) return run.pass();
    return { ok: false };
  };
  const run = createRun(1, { seed, aiThinkMs: AI_THINK_MS });
  playRound(run, tel, randomPolicy);
  return finish(tel, 1, run.state.winner === 'you');
}

// ---------------- noinput：只推进时间，测死时间基线（玩家不输入会卡住） ----------------
function noinput(seed) {
  const tel = newTracker('noinput-1', 'noinput', seed);
  const run = createRun(1, { seed, aiThinkMs: AI_THINK_MS });
  const CAP_SEC = 12;
  while (run.state.phase === 'playing' && tel.simTime < CAP_SEC) {
    tel.tick(1 / 60);
    run.step(1 / 60);
    tel.drain(run);
  }
  return finish(tel, 1, false);
}

const runs = [greedy(7), random(2), noinput(3)];
const payload = {
  game: 'doudizhu-master',
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
    `actions=${r.actions} levels=${r.levelsReached} completed=${r.completed}`,
  );
}
