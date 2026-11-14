// 纯逻辑：旅客生成（姓名/过期/违禁三类违规）+ 放行/拒绝判定 + 班次/失误。
// 不碰 DOM / window / localStorage / Date.now；随机用可注入 seed。
import { RULES, TODAY } from '../../config/game.config.js';
import { NAMES, COUNTRIES, DESTINATIONS, NORMAL_ITEMS, CONTRABAND_ITEMS } from '../../config/data.js';

function makeRng(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pick = (rng, arr) => arr[Math.floor(rng() * arr.length)];

function pad(n) { return String(n).padStart(2, '0'); }
function futureDate(rng) {
  const y = 2027 + Math.floor(rng() * 4);
  return `${y}-${pad(1 + Math.floor(rng() * 12))}-${pad(1 + Math.floor(rng() * 28))}`;
}
function pastDate(rng) {
  const y = 2024 + Math.floor(rng() * 2);
  return `${y}-${pad(1 + Math.floor(rng() * 12))}-${pad(1 + Math.floor(rng() * 28))}`;
}

export function violationChance(shift) {
  return Math.min(RULES.maxViolationChance, RULES.baseViolationChance + RULES.chancePerShift * (shift - 1));
}

export function generatePassenger(rng, shift) {
  const name = pick(rng, NAMES);
  const p = violationChance(shift);
  const nameMismatch = rng() < p;
  const expired = rng() < p;
  const contraband = rng() < p;

  let other = pick(rng, NAMES);
  while (other === name) other = pick(rng, NAMES);

  const items = [];
  const nNormal = 2 + Math.floor(rng() * 3);
  for (let i = 0; i < nNormal; i += 1) items.push(pick(rng, NORMAL_ITEMS).id);
  if (contraband) items.push(pick(rng, CONTRABAND_ITEMS).id);

  const violations = [];
  if (nameMismatch) violations.push('name');
  if (expired) violations.push('expired');
  if (contraband) violations.push('contraband');

  return {
    name,
    photoSeed: Math.floor(rng() * 1e9),
    passport: {
      name,
      expiry: expired ? pastDate(rng) : futureDate(rng),
      country: pick(rng, COUNTRIES),
    },
    boarding: {
      name: nameMismatch ? other : name,
      flight: `FL${100 + Math.floor(rng() * 900)}`,
      dest: pick(rng, DESTINATIONS),
    },
    luggage: { items, contraband },
    violations,
    clean: violations.length === 0,
  };
}

export function createRun({ seed = 1 } = {}) {
  const rng = makeRng(seed);
  return {
    seed,
    shift: 1,
    processed: 0,
    score: 0,
    combo: 0,
    strikes: 0,
    phase: 'playing', // playing | clear | over
    passenger: generatePassenger(rng, 1),
    events: [],
    rng,
  };
}

// 判定放行/拒绝。返回 { correct, clean, violations, gameOver, shiftClear }。
export function decide(run, approve) {
  if (run.phase !== 'playing') return { correct: false, inactive: true };
  const p = run.passenger;
  const correct = (p.clean && approve) || (!p.clean && !approve);
  if (correct) {
    run.combo += 1;
    const gained = RULES.scorePerCorrect + RULES.comboBonus * (run.combo - 1);
    run.score += gained;
    run.events.push({ type: 'correct', gained, combo: run.combo });
  } else {
    run.combo = 0;
    run.strikes += 1;
    run.events.push({ type: 'wrong', clean: p.clean, violations: p.violations });
  }
  run.processed += 1;
  let gameOver = false;
  let shiftClear = false;
  if (run.strikes >= RULES.maxStrikes) {
    run.phase = 'over';
    gameOver = true;
    run.events.push({ type: 'over', score: run.score });
  } else if (run.processed >= RULES.shiftSize) {
    run.phase = 'clear';
    shiftClear = true;
    run.events.push({ type: 'clear', shift: run.shift, score: run.score });
  }
  return { correct, clean: p.clean, violations: p.violations, gameOver, shiftClear };
}

// 反馈结束后加载下一位旅客（仅在 playing 时）。
export function advance(run) {
  if (run.phase === 'playing') {
    run.passenger = generatePassenger(run.rng, run.shift);
  }
}

export function nextShift(run) {
  run.shift += 1;
  run.processed = 0;
  run.phase = 'playing';
  run.passenger = generatePassenger(run.rng, run.shift);
}

export function getHud(run) {
  return {
    shift: run.shift,
    processed: run.processed,
    score: run.score,
    combo: run.combo,
    strikes: run.strikes,
    phase: run.phase,
    clean: run.passenger.clean,
  };
}

export function drainEvents(run) {
  const out = run.events;
  run.events = [];
  return out;
}