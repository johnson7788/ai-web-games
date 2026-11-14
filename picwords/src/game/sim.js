// 纯逻辑：看图拼词（字母块填槽 + 校验 + 提示）。
// 不碰 DOM / window / localStorage / Date.now；随机用可注入 seed。
import { PICTURES } from '../../config/pictures.js';
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

export function createRun({ level = 0, seed = 1 } = {}) {
  const rng = makeRng(seed + level * 7919);
  const picture = PICTURES[level % PICTURES.length];
  const word = picture.word;
  const letters = [...word];
  for (let i = 0; i < RULES.extraLetters; i += 1) {
    letters.push(String.fromCharCode(65 + Math.floor(rng() * 26)));
  }
  const tiles = shuffle(letters, rng).map((letter) => ({ letter, used: false }));
  return {
    level,
    picture,
    word,
    tiles,
    slots: Array(word.length).fill(null),
    hintsUsed: 0,
    score: 0,
    phase: 'playing',
    events: [],
    rng,
  };
}

export function currentWord(run) {
  return run.slots.map((s) => (s === null ? '' : run.tiles[s].letter)).join('');
}

function check(run) {
  if (currentWord(run) === run.word) {
    run.phase = 'clear';
    run.score += RULES.scorePerWord;
    run.events.push({ type: 'correct', word: run.word });
  } else {
    run.events.push({ type: 'wrong' });
  }
}

export function tapTile(run, tileIdx) {
  if (run.phase !== 'playing') return { ok: false };
  const tile = run.tiles[tileIdx];
  if (!tile || tile.used) return { ok: false };
  const slot = run.slots.indexOf(null);
  if (slot === -1) return { ok: false };
  run.slots[slot] = tileIdx;
  tile.used = true;
  run.events.push({ type: 'place', slot });
  if (run.slots.every((s) => s !== null)) check(run);
  return { ok: true };
}

export function tapSlot(run, slotIdx) {
  if (run.phase !== 'playing') return { ok: false };
  const tileIdx = run.slots[slotIdx];
  if (tileIdx === null) return { ok: false };
  run.tiles[tileIdx].used = false;
  run.slots[slotIdx] = null;
  return { ok: true };
}

export function clearSlots(run) {
  run.slots.forEach((s) => { if (s !== null) run.tiles[s].used = false; });
  run.slots = Array(run.word.length).fill(null);
}

export function useHint(run) {
  if (run.phase !== 'playing' || run.hintsUsed >= RULES.hintLimit) return null;
  const slot = run.slots.indexOf(null);
  if (slot === -1) return null;
  const letter = run.word[slot];
  let tileIdx = run.tiles.findIndex((t) => !t.used && t.letter === letter);
  if (tileIdx === -1) return null;
  run.slots[slot] = tileIdx;
  run.tiles[tileIdx].used = true;
  run.hintsUsed += 1;
  run.events.push({ type: 'hint', slot, letter });
  if (run.slots.every((s) => s !== null)) check(run);
  return { slot, letter };
}

export function nextLevel(run) {
  const fresh = createRun({ level: run.level + 1, seed: run.seed });
  fresh.score = run.score;
  Object.assign(run, fresh);
}

export function getHud(run) {
  return {
    level: run.level,
    word: run.word,
    wordLen: run.word.length,
    current: currentWord(run),
    slots: [...run.slots],
    hintsLeft: RULES.hintLimit - run.hintsUsed,
    score: run.score,
    phase: run.phase,
    emoji: run.picture.emoji,
    hint: run.picture.hint,
  };
}

export function drainEvents(run) {
  const out = run.events;
  run.events = [];
  return out;
}

export const LEVEL_COUNT = PICTURES.length;