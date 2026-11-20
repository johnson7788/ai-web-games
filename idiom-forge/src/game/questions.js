// src/game/questions.js — 题目生成（纯逻辑，无 DOM / localStorage / Date.now）
// 中文模式：成语填空（1–2 缺字）或字谜（谜面猜单字）；英文模式：4 字母单词填空或谜面猜整词。
// 候选字格：正确字 + 干扰字（从词库字符池抽取），洗牌后返回。

import { IDIOMS_ZH, WORDS_EN, RIDDLES_ZH } from '../../config/idioms.js';
import { shuffle, pick } from './rng.js';

const EN_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');

let _zhChars = null;
export function zhCharPool() {
  if (_zhChars) return _zhChars;
  const set = new Set();
  for (const i of IDIOMS_ZH) for (const c of i.text) set.add(c);
  for (const r of RIDDLES_ZH) set.add(r.answer);
  _zhChars = [...set];
  return _zhChars;
}

export function enCharPool() {
  return EN_LETTERS;
}

// 从 0..len-1 里选 n 个不重复下标，升序返回（缺字位置从左到右）
export function pickBlankIndices(rng, len, n) {
  const pool = Array.from({ length: len }, (_, i) => i);
  const idx = [];
  for (let k = 0; k < Math.min(n, len); k += 1) {
    const j = Math.floor(rng() * pool.length);
    idx.push(pool.splice(j, 1)[0]);
  }
  return idx.sort((a, b) => a - b);
}

// 生成一道题。used 是「本关已用 key」的 Set，避免同关重复出题。
export function generateQuestion({ lang, blanks, riddle, rng, used }) {
  const usedSet = used || new Set();
  if (lang === 'zh') {
    if (riddle) {
      const avail = RIDDLES_ZH.filter((r) => !usedSet.has('r:' + r.answer));
      const r = pick(rng, avail.length ? avail : RIDDLES_ZH);
      return {
        kind: 'riddle', lang: 'zh',
        answer: [r.answer], blanks: [0], clue: r.clue,
        riddle: true, mult: 2, key: 'r:' + r.answer,
      };
    }
    const avail = IDIOMS_ZH.filter((i) => !usedSet.has('i:' + i.text));
    const idiom = pick(rng, avail.length ? avail : IDIOMS_ZH);
    const chars = [...idiom.text];
    const blankIdx = pickBlankIndices(rng, chars.length, blanks);
    return {
      kind: 'fill', lang: 'zh',
      answer: chars, blanks: blankIdx, clue: idiom.meaning,
      riddle: false, mult: 1, key: 'i:' + idiom.text,
    };
  }
  // 英文模式
  const avail = WORDS_EN.filter((w) => !usedSet.has('w:' + w.text));
  const word = pick(rng, avail.length ? avail : WORDS_EN);
  const chars = word.text.split('');
  const blankIdx = riddle ? [0, 1, 2, 3] : pickBlankIndices(rng, 4, blanks);
  return {
    kind: riddle ? 'riddle' : 'fill', lang: 'en',
    answer: chars, blanks: blankIdx, clue: word.meaning,
    riddle: !!riddle, mult: riddle ? 2 : 1, key: 'w:' + word.text,
  };
}

// 生成候选字格：正确字 + 干扰字（不含任何正确字），洗牌。
export function generateGrid({ question, gridSize, lang, rng }) {
  const correct = question.blanks.map((i) => question.answer[i]);
  const uniqueCorrect = [...new Set(correct)];
  const pool = lang === 'zh' ? zhCharPool() : enCharPool();
  const distractors = pool.filter((c) => !uniqueCorrect.includes(c));
  const need = Math.max(0, gridSize - uniqueCorrect.length);
  const extra = shuffle(rng, distractors).slice(0, need);
  return shuffle(rng, [...uniqueCorrect, ...extra]);
}
