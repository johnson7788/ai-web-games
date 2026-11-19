// 纯逻辑 sim：SWIM OR SINK 生存问答
// 状态机：playing（答题中）→ won（通关）/ lost（空气耗尽沉没）。
// 每关（深度）若干题，答对推进；答错扣空气、退回本题；3 连击回 1 格空气。
// 无 DOM / 无 i18n 依赖，可在 Node 直接 import 供测试与 selfplay 使用。
import { GAME } from '../../config/game.config.js';
import { LEVELS, LEVEL_COUNT, pick } from '../../config/questions.js';

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 洗牌（不改变原数组），返回新数组
export function shuffle(arr, rng) {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function computeStars(st) {
  let s = 1;                       // 活下来 = 1 星
  if (st.air >= 2) s += 1;         // 空气充足
  if (st.maxStreak >= 4) s += 1;   // 连击够高
  return Math.min(3, s);
}

export function createRun(levelIndex = 0, opts = {}) {
  const seed = (opts.seed == null ? 1 : opts.seed) >>> 0;
  const rng = mulberry32(seed);
  const startLevel = Math.max(0, Math.min(LEVEL_COUNT - 1, levelIndex | 0));

  const levels = LEVELS.map((lv) => {
    const questions = lv.questions.map((q) => ({ ...q }));
    if (lv.shuffle) {
      questions.forEach((q) => {
        const order = shuffle(q.opts.map((_, i) => i), rng);
        const newOpts = order.map((i) => q.opts[i]);
        q.answer = order.indexOf(q.answer);
        q.opts = newOpts;
      });
    }
    return { ...lv, questions };
  });

  const st = {
    phase: 'playing',              // playing | won | lost
    level: startLevel + 1,         // 1 基
    qIndex: 0,
    questions: levels[startLevel].questions,
    air: GAME.maxAir,
    maxAir: GAME.maxAir,
    streak: 0,
    maxStreak: 0,
    score: 0,
    stars: 0,
    totalCorrect: 0,
    totalWrong: 0,
    usedLifeline: false,
    time: 0,
  };

  const _events = [];
  function queue(type, payload = {}) {
    _events.push({ type, ...payload, t: st.time });
  }

  queue('runStart', { level: st.level, air: st.air });
  queue('question', { qIndex: st.qIndex, level: st.level, total: st.questions.length });

  const run = {
    state: st,
    _levels: levels,

    step(dt) {
      st.time += dt;
    },

    drainEvents() {
      const out = _events.splice(0);
      return out;
    },

    answer(idx) {
      if (st.phase !== 'playing') return { ok: false };
      const q = st.questions[st.qIndex];
      if (!q) return { ok: false };
      if (idx == null || idx < 0 || idx >= q.opts.length) return { ok: false };
      if (q.eliminated && q.eliminated.has(idx)) return { ok: false };

      if (idx === q.answer) {
        st.streak += 1;
        st.maxStreak = Math.max(st.maxStreak, st.streak);
        st.totalCorrect += 1;
        const gained = GAME.baseScore + GAME.streakBonus * (st.streak - 1);
        st.score += gained;
        queue('correct', { idx, streak: st.streak, gained, answer: q.answer });

        if (st.streak >= 2) queue('streak', { streak: st.streak });
        if (st.streak > 0 && st.streak % GAME.streakRegenEvery === 0) {
          queue('combo', { combo: Math.floor(st.streak / GAME.streakRegenEvery) });
          if (st.air < st.maxAir) {
            st.air += 1;
            queue('airRegen', { air: st.air });
          } else {
            queue('airFull', { streak: st.streak });
          }
        }

        const isLast = st.qIndex + 1 >= st.questions.length;
        if (isLast) {
          if (st.level >= levels.length) {
            st.phase = 'won';
            st.stars = computeStars(st);
            queue('win', { stars: st.stars, score: st.score, air: st.air, maxStreak: st.maxStreak });
            if (st.totalWrong === 0 && st.air === st.maxAir) {
              queue('perfect', { score: st.score, stars: st.stars });
            }
          } else {
            queue('levelCleared', { level: st.level });
            st.level += 1;
            st.qIndex = 0;
            st.questions = levels[st.level - 1].questions;
            if (st.air < st.maxAir) st.air += 1; // 通关回 1 格空气
            queue('question', { qIndex: 0, level: st.level, total: st.questions.length });
          }
        } else {
          st.qIndex += 1;
          queue('question', { qIndex: st.qIndex, level: st.level, total: st.questions.length });
        }
        return { ok: true, correct: true, air: st.air, score: st.score };
      }

      st.streak = 0;
      st.totalWrong += 1;
      st.air -= 1;
      queue('wrong', { idx, air: st.air, answer: q.answer });
      queue('airLost', { air: st.air });
      if (st.air <= 0) {
        st.air = 0;
        st.phase = 'lost';
        st.stars = 0;
        queue('lose', { score: st.score, reason: 'drowned', maxStreak: st.maxStreak });
      }
      return { ok: true, correct: false, air: st.air };
    },

    useLifeline() {
      if (st.phase !== 'playing') return { ok: false };
      if (st.usedLifeline) return { ok: false };
      const q = st.questions[st.qIndex];
      if (!q) return { ok: false };
      if (q.opts.length < 3) return { ok: false };
      const wrongs = q.opts
        .map((_, i) => i)
        .filter((i) => i !== q.answer && !(q.eliminated && q.eliminated.has(i)));
      if (!wrongs.length) return { ok: false };
      const eliminate = wrongs[Math.floor(rng() * wrongs.length)];
      q.eliminated = q.eliminated || new Set();
      q.eliminated.add(eliminate);
      st.usedLifeline = true;
      queue('lifeline', { eliminated: eliminate, remaining: q.opts.length - 1 - (q.eliminated.size - 1) });
      return { ok: true, eliminated: eliminate };
    },

    getHud() {
      return {
        phase: st.phase,
        level: st.level,
        qIndex: st.qIndex,
        qCount: st.questions.length,
        air: st.air,
        maxAir: st.maxAir,
        streak: st.streak,
        maxStreak: st.maxStreak,
        score: st.score,
        stars: st.stars,
        usedLifeline: st.usedLifeline,
      };
    },
  };

  return run;
}

// 供 render/ui 使用：按语言取题面
export function localizeQuestion(q, lang) {
  return {
    q: pick(q.q, lang),
    opts: q.opts.map((o) => pick(o, lang)),
    answer: q.answer,
    reason: pick(q.reason, lang),
    eliminated: q.eliminated || null,
  };
}
