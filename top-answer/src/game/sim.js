// 纯逻辑：题库回合 + 双语答案匹配 + 提示/揭示 + 计分。
// 不碰 DOM / window / localStorage / Date.now；随机用可注入 seed。
import { RULES } from '../../config/game.config.js';
import { QUESTIONS } from '../../config/questions.js';

function makeRng(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 英文归一化：小写 + 去掉非字母数字（空格/标点）。
export function normEn(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '');
}

function buildKeys(answer) {
  const keys = new Set();
  for (const a of answer.aliases || []) {
    const n = normEn(a);
    if (n) keys.add(n);
  }
  const en = normEn(answer.en);
  if (en) keys.add(en);
  return keys;
}

export function createRun({ questionIndex = 0, seed = 1 } = {}) {
  const question = QUESTIONS[questionIndex];
  const answers = question.answers.map((a) => ({
    en: a.en,
    zh: a.zh,
    points: a.points,
    keys: buildKeys(a),
    zhTrim: a.zh.trim(),
    revealed: false,
    hinted: false,
  }));
  return {
    questionIndex,
    question,
    answers,
    score: 0,
    hintsUsed: 0,
    phase: 'playing', // playing | complete
    events: [],
    rng: makeRng(seed),
  };
}

export function foundCount(run) {
  return run.answers.filter((a) => a.revealed).length;
}
export function isComplete(run) {
  return run.answers.every((a) => a.revealed);
}

function matchIndex(run, raw) {
  const n = normEn(raw);
  for (let i = 0; i < run.answers.length; i += 1) {
    const a = run.answers[i];
    if ((n && a.keys.has(n)) || raw === a.zhTrim) return i;
  }
  return -1;
}

// 提交猜测。返回 { ok, kind, index, points, complete }。
export function submitGuess(run, text) {
  const raw = String(text || '').trim();
  if (run.phase !== 'playing') return { ok: false, kind: 'inactive' };
  if (!raw) return { ok: false, kind: 'empty' };
  const idx = matchIndex(run, raw);
  if (idx < 0) {
    run.events.push({ type: 'miss', text: raw });
    return { ok: false, kind: 'miss' };
  }
  const a = run.answers[idx];
  if (a.revealed) return { ok: false, kind: 'already', index: idx };
  a.revealed = true;
  run.score += a.points;
  run.events.push({ type: 'found', index: idx, points: a.points, en: a.en, zh: a.zh });
  let complete = false;
  if (isComplete(run)) {
    run.phase = 'complete';
    complete = true;
    run.events.push({ type: 'clear', score: run.score, giveup: false });
  }
  return { ok: true, kind: 'found', index: idx, points: a.points, complete };
}

// 提示：标记一个未揭示答案的首字母。返回 { index, char } 或 null。
export function useHint(run) {
  if (run.phase !== 'playing' || run.hintsUsed >= RULES.hintLimit) return null;
  const candidates = run.answers.map((a, i) => ({ a, i })).filter(({ a }) => !a.revealed && !a.hinted);
  if (candidates.length === 0) return null;
  const pick = candidates[Math.floor(run.rng() * candidates.length)];
  pick.a.hinted = true;
  run.hintsUsed += 1;
  run.events.push({ type: 'hint', index: pick.i });
  return { index: pick.i, char: pick.a.en[0] };
}

// 揭示全部剩余（不得分），结束回合。
export function revealAll(run) {
  if (run.phase !== 'playing') return false;
  for (const a of run.answers) a.revealed = true;
  run.phase = 'complete';
  run.events.push({ type: 'clear', score: run.score, giveup: true });
  return true;
}

export function getHud(run) {
  return {
    questionIndex: run.questionIndex,
    score: run.score,
    found: foundCount(run),
    total: run.answers.length,
    hintsLeft: RULES.hintLimit - run.hintsUsed,
    phase: run.phase,
  };
}

export function drainEvents(run) {
  const out = run.events;
  run.events = [];
  return out;
}

export const QUESTION_COUNT = QUESTIONS.length;