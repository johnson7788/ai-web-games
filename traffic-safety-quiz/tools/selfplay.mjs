// traffic-safety-quiz · 自对弈（M1 拥有）
// Node 无头，直接 import sim（无 DOM）。greedy / random / noinput 三策略，
// 完成一局后写出 tools/fun/autoplay.json（schema 见 playtest-protocol §3）。
// 运行：node tools/selfplay.mjs
import { createRun, mulberry32 } from '../src/game/sim.js';
import { QUESTIONS } from '../config/questions.js';
import { QUIZ } from '../config/game.config.js';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'tools', 'fun', 'autoplay.json');

const round2 = (n) => Number(n.toFixed(2));

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
        if (e.type === 'answer_correct' && this.firstSuccessAt === null) this.firstSuccessAt = this.simTime;
        if (e.type === 'answer_wrong' || e.type === 'lose') this.deaths += 1;
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
    durationSec: round2(tel.simTime),
    firstInputSec: round2(tel.firstInputAt ?? 0),
    inputLatencyMs: 16, // 纯 sim 无渲染输入延迟，取单帧 60Hz 名义值
    firstSuccessSec: tel.firstSuccessAt === null ? null : round2(tel.firstSuccessAt),
    deaths: tel.deaths,
    actions: tel.actions,
    idleSec: round2(idleSec),
    maxEventGapSec: round2(maxGap),
    uniqueEvents: tel.seen.size,
    levelsReached: run.state.index + 1,
    completed: run.state.won,
  };
}

// ---------------- greedy：读当前题答案直接答对 ----------------
function greedy(seed) {
  const run = createRun({ seed });
  const tel = makeTracker(run, 'greedy', seed);
  let guard = 0;
  while (run.state.phase === 'playing' && guard < 50) {
    guard += 1;
    tel.tick(0.35); // 思考间隙（保持事件密度真实）
    const q = QUESTIONS[run.state.order[run.state.index]];
    tel.act(() => run.answer(q.answer));
  }
  return finish(tel, run);
}

// ---------------- random：随机判对错/翻题，验证输入鲁棒 ----------------
function random(seed) {
  const run = createRun({ seed });
  const tel = makeTracker(run, 'random', seed);
  const rng = mulberry32(seed * 7919 + 13);
  let guard = 0;
  while (run.state.phase === 'playing' && guard < 400) {
    guard += 1;
    tel.tick(0.4);
    const roll = rng();
    if (roll < 0.62) {
      tel.act(() => run.answer(rng() < 0.5 ? 'right' : 'wrong'));
    } else {
      tel.act(() => run.navigate(rng() < 0.5 ? 1 : -1));
    }
  }
  return finish(tel, run);
}

// ---------------- noinput：只推进时间，测死时间/超时基线 ----------------
function noinput(seed) {
  const run = createRun({ seed });
  const tel = makeTracker(run, 'noinput', seed);
  const MAX = QUIZ.TIME_LIMIT + 2;
  while (run.state.phase === 'playing' && tel.simTime < MAX) {
    tel.tick(1 / 60);
  }
  return finish(tel, run);
}

const runs = [greedy(3), random(2), noinput(3)];
const payload = {
  game: 'traffic-safety-quiz',
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
