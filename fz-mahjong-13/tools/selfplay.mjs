// FZ MAHJONG 13 · 自对弈（纯 sim，无 DOM）
// 固定 seed 驱动 greedy / random / noinput 三策略，写出 tools/fun/autoplay.json。
// 运行：node tools/selfplay.mjs
import { createRun, mulberry32 } from '../src/game/sim.js';
import { bestDiscard } from '../src/game/ai.js';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'tools', 'fun', 'autoplay.json');
const PLAYER = 0;

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
    record(e) {
      this.seen.add(e.type);
      this.eventTimes.push(this.simTime);
      if (e.type === 'win' && this.firstSuccessAt === null) this.firstSuccessAt = this.simTime;
      if (e.type === 'lose') this.deaths += 1;
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
    levelsReached: run.roundNum,
    completed: run.state.phase === 'won',
  };
}

function bestEatIndex(eatOptions, hand, joker) {
  let best = 0;
  let bestScore = -1;
  eatOptions.forEach((seq, i) => {
    const hand2 = hand.filter((t) => !seq.includes(t) || t === joker);
    const score = seq.filter((t) => t !== joker).length;
    void hand2;
    if (score > bestScore) { bestScore = score; best = i; }
  });
  return best;
}

function applyDecision(run, d) {
  if (!d) return { ok: false };
  if (d.type === 'discard') return run.discard(d.tileId);
  return run.act(d.act, d.eatIndex || 0);
}

function greedyDecision(run) {
  const s = run.state;
  const hand = s.seats[PLAYER].hand;
  if (s.stage === 'awaitSelf') {
    if (s.selfActions.canHu) return { type: 'act', act: 'hu' };
    const k = s.selfActions.kongOptions[0];
    if (s.selfActions.kongOptions.length && k.options[0] !== s.joker) return { type: 'act', act: 'kong' };
    return { type: 'act', act: 'pass' };
  }
  if (s.stage === 'awaitClaim') {
    if (s.claims.canHu) return { type: 'act', act: 'hu' };
    if (s.claims.canKong && s.claims.tileId !== s.joker) return { type: 'act', act: 'kong' };
    if (s.claims.canPong) return { type: 'act', act: 'pong' };
    if (s.claims.canEat) return { type: 'act', act: 'eat', eatIndex: bestEatIndex(s.claims.eatOptions, hand, s.joker) };
    return { type: 'act', act: 'pass' };
  }
  if (s.stage === 'awaitDiscard') {
    return { type: 'discard', tileId: bestDiscard(hand, s.joker) };
  }
  return null;
}

function randomDecision(run, rng) {
  const s = run.state;
  const hand = s.seats[PLAYER].hand;
  if (s.stage === 'awaitSelf') return { type: 'act', act: 'pass' };
  if (s.stage === 'awaitClaim') {
    const opts = [{ type: 'act', act: 'pass' }];
    if (s.claims.canPong) opts.push({ type: 'act', act: 'pong' });
    if (s.claims.canEat) opts.push({ type: 'act', act: 'eat', eatIndex: 0 });
    if (s.claims.canHu) opts.push({ type: 'act', act: 'hu' });
    return opts[Math.floor(rng() * opts.length)];
  }
  if (s.stage === 'awaitDiscard') {
    const nonJoker = hand.filter((t) => t !== s.joker);
    const pool = nonJoker.length ? nonJoker : hand;
    return { type: 'discard', tileId: pool[Math.floor(rng() * pool.length)] };
  }
  return null;
}

// 驱动一局（或直到超时/结束）
function drive(run, tel, maxSimSec, decisionFn) {
  const maxTicks = Math.ceil(maxSimSec * 60);
  for (let i = 0; i < maxTicks && run.state.phase === 'playing'; i += 1) {
    for (const e of run.drainEvents()) tel.record(e);
    if (run.state.actor === PLAYER) {
      const d = decisionFn();
      const res = applyDecision(run, d);
      if (res && res.ok) {
        tel.actions += 1;
        if (tel.firstInputAt === null) tel.firstInputAt = tel.simTime;
      }
    }
    run.step(1 / 60);
    tel.simTime += 1 / 60;
  }
  for (const e of run.drainEvents()) tel.record(e);
}

// greedy：串行打 3 轮（推进率要求到第 3 局）
function greedy(seed) {
  const run = createRun(seed);
  const tel = makeTracker(run, 'greedy', seed);
  for (let r = 0; r < 3; r += 1) {
    drive(run, tel, 120, () => greedyDecision(run));
    if (run.state.phase !== 'playing' && r < 2) run.nextRound();
  }
  return finish(tel, run);
}

function random(seed) {
  const run = createRun(seed);
  const tel = makeTracker(run, 'random', seed);
  const rng = mulberry32((seed * 7919 + 13) >>> 0);
  for (let r = 0; r < 3; r += 1) {
    drive(run, tel, 100, () => randomDecision(run, rng));
    if (run.state.phase !== 'playing' && r < 2) run.nextRound();
  }
  return finish(tel, run);
}

function noinput(seed) {
  const run = createRun(seed);
  const tel = makeTracker(run, 'noinput', seed);
  drive(run, tel, 60, () => null);
  return finish(tel, run);
}

const GREEDY_SEED = 1;
const runs = [greedy(GREEDY_SEED), random(2), noinput(3)];
const payload = {
  game: 'fz-mahjong-13',
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
    `actions=${r.actions} deaths=${r.deaths} lvl=${r.levelsReached} completed=${r.completed}`,
  );
}
