// 纯逻辑：双人同屏问答（计时 + 速度加分 + 回合胜负）。
// 不碰 DOM / window / localStorage / Date.now；随机用可注入 seed。
import { QUESTIONS } from '../../config/questions.js';
import { RULES } from '../../config/game.config.js';

function makeRng(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffledOrder(n, rng) {
  const a = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function createRun({ seed = 1, rounds = RULES.rounds } = {}) {
  const rng = makeRng(seed);
  const order = shuffledOrder(QUESTIONS.length, rng).slice(0, rounds);
  return {
    seed,
    rounds,
    order,
    round: 0,
    scores: [0, 0],
    answers: [null, null],
    timer: RULES.roundTime,
    phase: 'question', // question | reveal | done
    lastResult: null,
    events: [],
    rng,
  };
}

export function currentQuestion(run) {
  return QUESTIONS[run.order[run.round]];
}

function reveal(run) {
  const q = currentQuestion(run);
  const correct = [run.answers[0] === q.correct, run.answers[1] === q.correct];
  const speedBonus = Math.floor((Math.max(0, run.timer) / RULES.roundTime) * RULES.speedBonusMax);
  const points = correct.map((c) => (c ? RULES.baseScore + speedBonus : 0));
  run.scores[0] += points[0];
  run.scores[1] += points[1];
  run.lastResult = { correct, points, correctIndex: q.correct };
  run.phase = 'reveal';
  run.events.push({ type: 'reveal', correct, points, correctIndex: q.correct });
}

export function answer(run, player, idx) {
  if (run.phase !== 'question') return { ok: false };
  if (player !== 0 && player !== 1) return { ok: false };
  if (run.answers[player] !== null) return { ok: false };
  if (idx < 0 || idx > 3) return { ok: false };
  run.answers[player] = idx;
  run.events.push({ type: 'answer', player, idx });
  if (run.answers[0] !== null && run.answers[1] !== null) reveal(run);
  return { ok: true };
}

export function tick(run, dt) {
  if (run.phase !== 'question') return;
  run.timer -= dt;
  if (run.timer <= 0) {
    run.timer = 0;
    reveal(run);
  }
}

export function next(run) {
  if (run.phase !== 'reveal') return;
  run.round += 1;
  if (run.round >= run.rounds) {
    run.phase = 'done';
    const winner = run.scores[0] === run.scores[1] ? -1 : (run.scores[0] > run.scores[1] ? 0 : 1);
    run.events.push({ type: 'done', winner, scores: [...run.scores] });
    return;
  }
  run.answers = [null, null];
  run.timer = RULES.roundTime;
  run.lastResult = null;
  run.phase = 'question';
}

export function getHud(run) {
  return {
    round: run.round + 1,
    rounds: run.rounds,
    scores: [...run.scores],
    answers: [...run.answers],
    timer: Math.max(0, run.timer),
    phase: run.phase,
    lastResult: run.lastResult,
    question: currentQuestion(run),
  };
}

export function drainEvents(run) {
  const out = run.events;
  run.events = [];
  return out;
}

export const ROUND_COUNT = RULES.rounds;