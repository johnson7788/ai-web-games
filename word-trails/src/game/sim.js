// 纯逻辑：关卡词库 + 拼词判定 + 提示/重排 + 计分连击。
// 不碰 DOM / window / localStorage / Date.now；随机用可注入 seed。
import { RULES } from '../../config/game.config.js';
import { LEVELS, sortedWords } from '../../config/levels.js';

function makeRng(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createRun({ levelIndex = 0, seed = 1 } = {}) {
  const level = LEVELS[levelIndex];
  const letters = [...level.letters];
  return {
    levelIndex,
    letters,
    ring: [...letters],          // 环上显示顺序（可重排）
    words: sortedWords(level.words),
    found: new Set(),
    revealed: new Set(),         // "wordIdx:pos"
    score: 0,
    streak: 0,
    hintsUsed: 0,
    phase: 'playing',            // playing | complete
    events: [],
    rng: makeRng(seed),
  };
}

export function foundCount(run) {
  return run.found.size;
}

export function isComplete(run) {
  return run.found.size >= run.words.length;
}

export function computeStars(hintsUsed) {
  if (hintsUsed <= 0) return 3;
  if (hintsUsed === 1) return 2;
  return 1;
}

// 提交一个拼出的词。返回 { ok, kind, gained, complete }。
export function submitWord(run, raw) {
  const word = String(raw || '').trim().toUpperCase();
  if (run.phase !== 'playing') return { ok: false, kind: 'inactive' };
  if (word.length < RULES.minWordLen) {
    run.streak = 0;
    return { ok: false, kind: 'short' };
  }
  if (run.found.has(word)) {
    return { ok: false, kind: 'already' };
  }
  if (run.words.includes(word)) {
    run.found.add(word);
    run.streak += 1;
    const gained = word.length * RULES.scorePerLetter + RULES.streakBonus * (run.streak - 1);
    run.score += gained;
    run.events.push({ type: 'found', word, gained, streak: run.streak });
    let complete = false;
    if (isComplete(run)) {
      run.phase = 'complete';
      complete = true;
      run.events.push({ type: 'clear', levelIndex: run.levelIndex, stars: computeStars(run.hintsUsed), score: run.score });
    }
    return { ok: true, kind: 'found', word, gained, complete };
  }
  run.streak = 0;
  run.events.push({ type: 'invalid', word });
  return { ok: false, kind: 'invalid' };
}

// 提示：揭示一个未找到词的随机未揭示字母。返回 { wordIdx, pos, char } 或 null。
export function useHint(run) {
  if (run.phase !== 'playing') return null;
  if (run.hintsUsed >= RULES.hintLimit) return null;
  const candidates = [];
  run.words.forEach((w, wi) => {
    if (run.found.has(w)) return;
    for (let pos = 0; pos < w.length; pos += 1) {
      if (!run.revealed.has(`${wi}:${pos}`)) candidates.push({ wi, pos, char: w[pos] });
    }
  });
  if (candidates.length === 0) return null;
  const pick = candidates[Math.floor(run.rng() * candidates.length)];
  run.revealed.add(`${pick.wi}:${pick.pos}`);
  run.hintsUsed += 1;
  run.events.push({ type: 'hint', wordIdx: pick.wi, pos: pick.pos, char: pick.char });
  return { wordIdx: pick.wi, pos: pick.pos, char: pick.char };
}

// 重排字母环（Fisher–Yates，用注入 rng）。
export function shuffleRing(run) {
  const a = run.ring;
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(run.rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  run.events.push({ type: 'shuffle' });
  return run.ring;
}

export function getHud(run) {
  return {
    levelIndex: run.levelIndex,
    score: run.score,
    streak: run.streak,
    found: run.found.size,
    total: run.words.length,
    hintsLeft: RULES.hintLimit - run.hintsUsed,
    phase: run.phase,
  };
}

export function drainEvents(run) {
  const out = run.events;
  run.events = [];
  return out;
}

export const LEVEL_COUNT = LEVELS.length;