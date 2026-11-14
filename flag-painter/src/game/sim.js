// 纯逻辑：按国家涂国旗色带 + 校验 + 计分。
// 不碰 DOM / window / localStorage / Date.now；随机用可注入 seed。
import { FLAGS } from '../../config/flags.js';
import { RULES, COLOR_KEYS } from '../../config/game.config.js';

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

export function createRun({ seed = 1 } = {}) {
  const rng = makeRng(seed);
  const order = shuffledOrder(FLAGS.length, rng);
  const run = {
    seed,
    order,
    orderPos: 0,
    painted: [],
    selectedColor: COLOR_KEYS[0],
    wrongBands: new Set(),
    phase: 'playing', // playing | correct | done
    score: 0,
    solved: 0,
    attempts: 0,
    events: [],
    rng,
  };
  loadFlag(run);
  return run;
}

export function currentFlag(run) {
  return FLAGS[run.order[run.orderPos]];
}

function loadFlag(run) {
  const flag = currentFlag(run);
  run.painted = flag.colors.map(() => null);
  run.wrongBands = new Set();
  run.phase = 'playing';
}

export function selectColor(run, color) {
  if (COLOR_KEYS.includes(color)) run.selectedColor = color;
}

export function paintBand(run, index) {
  if (run.phase !== 'playing') return { ok: false };
  if (index < 0 || index >= run.painted.length) return { ok: false };
  run.painted[index] = run.selectedColor;
  run.wrongBands.delete(index);
  run.events.push({ type: 'paint', index, color: run.selectedColor });
  return { ok: true };
}

export function check(run) {
  if (run.phase !== 'playing') return { ok: false };
  const flag = currentFlag(run);
  run.attempts += 1;
  const wrong = new Set();
  for (let i = 0; i < flag.colors.length; i += 1) {
    if (run.painted[i] !== flag.colors[i]) wrong.add(i);
  }
  if (wrong.size === 0) {
    run.phase = 'correct';
    run.score += RULES.scorePerFlag;
    run.solved += 1;
    run.events.push({ type: 'correct', score: run.score });
    return { ok: true, correct: true };
  }
  run.wrongBands = wrong;
  run.events.push({ type: 'wrong', wrong: [...wrong] });
  return { ok: true, correct: false, wrong: [...wrong] };
}

export function clearFlag(run) {
  if (run.phase === 'done') return;
  run.painted = run.painted.map(() => null);
  run.wrongBands = new Set();
  run.phase = 'playing';
}

export function nextFlag(run) {
  if (run.orderPos + 1 >= run.order.length) {
    run.phase = 'done';
    run.events.push({ type: 'done', score: run.score });
    return;
  }
  run.orderPos += 1;
  loadFlag(run);
}

export function getHud(run) {
  return {
    flagIndex: run.order[run.orderPos],
    country: currentFlag(run).country,
    orient: currentFlag(run).orient,
    bands: currentFlag(run).colors.length,
    painted: [...run.painted],
    selectedColor: run.selectedColor,
    wrongBands: [...run.wrongBands],
    phase: run.phase,
    score: run.score,
    solved: run.solved,
    total: run.order.length,
    progress: run.orderPos,
  };
}

export function drainEvents(run) {
  const out = run.events;
  run.events = [];
  return out;
}

export const FLAG_COUNT = FLAGS.length;