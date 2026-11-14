// 纯逻辑：看图猜品牌（原创虚构品牌）+ 选项 + 计分。
// 不碰 DOM / window / localStorage / Date.now；随机用可注入 seed。
import { BRANDS } from '../../config/brands.js';
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

function shuffle(arr, rng) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function makeQuestion(run, brandIdx) {
  const brand = BRANDS[brandIdx];
  const others = shuffle(BRANDS.filter((b) => b.name !== brand.name), run.rng)
    .slice(0, RULES.options - 1)
    .map((b) => b.name);
  const options = shuffle([brand.name, ...others], run.rng);
  return { brand, options, correct: options.indexOf(brand.name) };
}

export function createRun({ seed = 1, rounds = RULES.rounds } = {}) {
  const rng = makeRng(seed);
  const order = shuffle(BRANDS.map((_, i) => i), rng).slice(0, rounds);
  const run = {
    seed,
    rounds,
    order,
    round: 0,
    score: 0,
    phase: 'question',
    current: null,
    lastResult: null,
    events: [],
    rng,
  };
  run.current = makeQuestion(run, order[0]);
  return run;
}

export function answer(run, idx) {
  if (run.phase !== 'question') return { ok: false };
  if (idx < 0 || idx >= run.current.options.length) return { ok: false };
  const correct = idx === run.current.correct;
  if (correct) run.score += RULES.scorePerCorrect;
  run.lastResult = { chosen: idx, correct: run.current.correct, isCorrect: correct };
  run.phase = 'reveal';
  run.events.push({ type: 'answer', correct, score: run.score });
  return { ok: true, correct };
}

export function next(run) {
  if (run.phase !== 'reveal') return;
  run.round += 1;
  if (run.round >= run.rounds) {
    run.phase = 'done';
    run.events.push({ type: 'done', score: run.score });
    return;
  }
  run.current = makeQuestion(run, run.order[run.round]);
  run.lastResult = null;
  run.phase = 'question';
}

export function getHud(run) {
  return {
    round: run.round + 1,
    rounds: run.rounds,
    score: run.score,
    phase: run.phase,
    brand: run.current ? run.current.brand : null,
    options: run.current ? run.current.options : [],
    correct: run.current ? run.current.correct : -1,
    lastResult: run.lastResult,
  };
}

export function drainEvents(run) {
  const out = run.events;
  run.events = [];
  return out;
}

export const ROUND_COUNT = RULES.rounds;