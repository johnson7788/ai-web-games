// 纯逻辑：字母堆拼词（选字母 → 提交 → 找全词表）。
// 不碰 DOM / window / localStorage / Date.now；随机用可注入 seed。
import { LEVELS, sortedWords } from '../../config/levels.js';
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
  const def = LEVELS[level % LEVELS.length];
  const letters = [...def.letters];
  return {
    level,
    letters,
    pileOrder: shuffle(letters.map((_, i) => i), rng),
    words: sortedWords(def.words),
    found: new Set(),
    revealed: new Set(),
    selected: [],
    hintsUsed: 0,
    score: 0,
    phase: 'playing',
    events: [],
    rng,
  };
}

export function currentWord(run) {
  return run.selected.map((i) => run.letters[i]).join('');
}

export function tapLetter(run, letterIdx) {
  if (run.phase !== 'playing') return { ok: false };
  if (letterIdx < 0 || letterIdx >= run.letters.length) return { ok: false };
  if (run.selected.includes(letterIdx)) return { ok: false };
  run.selected.push(letterIdx);
  return { ok: true };
}

export function backspace(run) {
  run.selected.pop();
}

export function clearSelected(run) {
  run.selected = [];
}

export function submit(run) {
  if (run.phase !== 'playing') return { ok: false };
  const word = currentWord(run);
  run.selected = [];
  if (word.length < RULES.minWordLen) {
    run.events.push({ type: 'wrong', word });
    return { ok: false, kind: 'short' };
  }
  if (run.found.has(word)) {
    run.events.push({ type: 'already', word });
    return { ok: false, kind: 'already' };
  }
  if (run.words.includes(word)) {
    run.found.add(word);
    run.score += RULES.scorePerWord;
    run.events.push({ type: 'found', word });
    if (run.found.size >= run.words.length) {
      run.phase = 'clear';
      run.events.push({ type: 'clear', level: run.level });
    }
    return { ok: true, kind: 'found', word };
  }
  run.events.push({ type: 'wrong', word });
  return { ok: false, kind: 'wrong' };
}

export function shufflePile(run) {
  run.pileOrder = shuffle(run.pileOrder, run.rng);
  run.events.push({ type: 'shuffle' });
}

export function useHint(run) {
  if (run.phase !== 'playing' || run.hintsUsed >= RULES.hintLimit) return null;
  const remaining = run.words.filter((w) => !run.found.has(w));
  if (remaining.length === 0) return null;
  const word = remaining[Math.floor(run.rng() * remaining.length)];
  const wi = run.words.indexOf(word);
  run.revealed.add(`${wi}:0`);
  run.hintsUsed += 1;
  run.events.push({ type: 'hint', word });
  return { word, letter: word[0] };
}

export function nextLevel(run) {
  const fresh = createRun({ level: run.level + 1, seed: run.seed });
  fresh.score = run.score;
  Object.assign(run, fresh);
}

export function getHud(run) {
  return {
    level: run.level,
    letters: run.letters.join(''),
    current: currentWord(run),
    found: run.found.size,
    total: run.words.length,
    words: run.words,
    foundWords: [...run.found],
    revealed: [...run.revealed],
    hintsLeft: RULES.hintLimit - run.hintsUsed,
    score: run.score,
    phase: run.phase,
  };
}

export function drainEvents(run) {
  const out = run.events;
  run.events = [];
  return out;
}

export const LEVEL_TOTAL = LEVELS.length;