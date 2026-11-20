// 题库选择（纯逻辑，无 DOM）：从 config/quiz.js 按类别抽题，同一局内不重复。
import { QUESTIONS } from '../../config/quiz.js';

export function questionCount() {
  return QUESTIONS.length;
}

export function questionsByCategory(category) {
  return QUESTIONS.filter((q) => q.category === category);
}

export function validCategories() {
  const set = new Set();
  for (const q of QUESTIONS) set.add(q.category);
  return [...set];
}

/**
 * 抽一题：优先按关卡类别池，避开本局已用过的题；池空则回退到任意未用题。
 * used 为 Set<id>，抽中后写入。
 */
export function pickQuestion(rng, categories, used) {
  const cats = Array.isArray(categories) && categories.length ? categories : validCategories();
  let pool = QUESTIONS.filter((q) => cats.includes(q.category) && !used.has(q.id));
  if (!pool.length) pool = QUESTIONS.filter((q) => !used.has(q.id));
  if (!pool.length) pool = QUESTIONS;
  const q = pool[Math.floor(rng() * pool.length)];
  used.add(q.id);
  return q;
}
