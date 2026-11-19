// MEMORY FRIENDS MATCH · 纯逻辑 sim（零 DOM，Node 可测）
//
// 玩法骨架（P0 1:1 复刻「找朋友」）：
//   - 记忆阶段：N 位朋友展示「样子 + 名字」，玩家点「我记住了」进入答题。
//   - 答题阶段：轮流两种题型——
//       type 1 = 给出名字 → 选对应朋友（脸）
//       type 2 = 给出朋友（脸）→ 选对应名字
//   - 答对/答错即时反馈；全局倒计时到 0 → 失败。
//
// 新增机制（本作换皮原创）：
//   1. 连击 Combo：连对得分 ×1 ×2 ×3，答错清零。
//   2. 星级 Stars：按失误数 + 剩余时间结算 1–3 星。
//   3. 扫描 Hint：每关限 1 次，移除一个错误选项（高难关禁用）。
import { LEVELS } from '../../config/levels.js';

// 稳定随机（供 selfplay 用固定 seed 复现）
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle(arr, rng) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// 朋友名字池（双语，程序化「名字」不来自参考源码）
const NAMES = [
  { en: 'Nova', zh: '诺瓦' },
  { en: 'Zig', zh: '齐格' },
  { en: 'Boop', zh: '布普' },
  { en: 'Momo', zh: '莫莫' },
  { en: 'Pip', zh: '皮普' },
  { en: 'Kai', zh: '凯' },
  { en: 'Zoe', zh: '佐伊' },
  { en: 'Luna', zh: '露娜' },
  { en: 'Bolt', zh: '博尔特' },
  { en: 'Glim', zh: '格利姆' },
  { en: 'Roo', zh: '鲁' },
  { en: 'Nyx', zh: '尼克斯' },
  { en: 'Fizz', zh: '菲兹' },
  { en: 'Dax', zh: '达克斯' },
  { en: 'Wren', zh: '雷恩' },
  { en: 'Omi', zh: '奥米' },
];

function generateFriends(n, rng) {
  const pool = shuffle(NAMES, rng);
  const friends = [];
  for (let i = 0; i < n; i += 1) {
    const nm = pool[i % pool.length];
    friends.push({
      id: i,
      nameEn: nm.en,
      nameZh: nm.zh,
      looks: {
        body: Math.floor(rng() * 3),
        color: Math.floor(rng() * 6),
        eye: Math.floor(rng() * 3),
        mouth: Math.floor(rng() * 4),
        accessory: Math.floor(rng() * 4),
        badge: Math.floor(rng() * 3),
      },
    });
  }
  return friends;
}

function generateQuestions(level, friendCount, rng) {
  const qs = [];
  let type = Math.floor(rng() * 2) + 1; // 1 或 2，交替
  for (let i = 0; i < level.question; i += 1) {
    const optCount = Math.max(2, Math.min(level.options[i] ?? 2, friendCount));
    const idxs = shuffle(Array.from({ length: friendCount }, (_, k) => k), rng).slice(0, optCount);
    const target = idxs[Math.floor(rng() * idxs.length)];
    qs.push({ type, target, options: shuffle(idxs, rng) });
    type = type === 1 ? 2 : 1;
  }
  return qs;
}

export function computeStars(state) {
  let s = 3;
  if (state.wrong >= 1) s -= 1;
  if (state.wrong >= 3) s -= 1;
  if (state.timeLeft < state.initialTime * 0.3) s -= 1;
  return Math.max(1, Math.min(3, s));
}

export function createRun(levelIndex, opts = {}) {
  const idx = Math.max(0, Math.min(LEVELS.length - 1, levelIndex | 0));
  const level = LEVELS[idx];
  const rng = mulberry32((opts.seed ?? 1) >>> 0);
  const friends = generateFriends(level.persons, rng);
  const questions = generateQuestions(level, friends.length, rng);

  const state = {
    phase: 'memorize', // memorize | question | won | lose
    level: idx + 1,
    friends,
    questions,
    questionIndex: 0,
    question: null,
    correct: 0,
    wrong: 0,
    combo: 0,
    bestCombo: 0,
    score: 0,
    timeLeft: level.timeLimit,
    initialTime: level.timeLimit,
    memorizeLeft: level.memorizeTime,
    hintLeft: level.hint == null ? 1 : level.hint,
    transitionLeft: 0,
    answered: false,
    stars: 0,
    reason: null,
  };
  state._level = level;

  let events = [];
  const emit = (type, payload = {}) => events.push({ type, ...payload });

  emit('memorize', { count: friends.length });

  function buildQuestion(i) {
    const q = questions[i];
    state.questionIndex = i;
    state.question = { type: q.type, target: q.target, options: q.options.slice() };
    state.answered = false;
    state.transitionLeft = 0;
    emit('question', { index: i, type: q.type });
  }

  function enterQuestionPhase() {
    state.phase = 'question';
    buildQuestion(0);
  }

  function win() {
    state.phase = 'won';
    state.stars = computeStars(state);
    emit('win', {
      stars: state.stars,
      score: state.score,
      correct: state.correct,
      wrong: state.wrong,
      timeLeft: state.timeLeft,
    });
  }

  function lose(reason) {
    state.phase = 'lose';
    state.reason = reason || 'timeOut';
    emit('lose', { reason: state.reason, correct: state.correct, wrong: state.wrong, score: state.score });
  }

  const run = {
    state,

    step(dt) {
      if (state.phase === 'won' || state.phase === 'lose') return;
      if (state.phase === 'memorize') {
        state.timeLeft -= dt;
        if (state.timeLeft <= 0) {
          state.timeLeft = 0;
          lose('timeOut');
          return;
        }
        state.memorizeLeft -= dt;
        if (state.memorizeLeft <= 0) enterQuestionPhase();
      } else if (state.phase === 'question') {
        state.timeLeft -= dt;
        if (state.timeLeft <= 0) {
          state.timeLeft = 0;
          lose('timeOut');
          return;
        }
        if (state.transitionLeft > 0) {
          state.transitionLeft -= dt;
          if (state.transitionLeft <= 0) {
            state.transitionLeft = 0;
            if (state.questionIndex + 1 < questions.length) buildQuestion(state.questionIndex + 1);
            else win();
          }
        }
      }
    },

    memorizeDone() {
      if (state.phase !== 'memorize') return { ok: false };
      enterQuestionPhase();
      return { ok: true };
    },

    answer(i) {
      if (state.phase !== 'question' || !state.question || state.answered || state.transitionLeft > 0) {
        return { ok: false };
      }
      const q = state.question;
      const correct = q.options[i] === q.target;
      state.answered = true;
      state.transitionLeft = 0.5;
      if (correct) {
        state.correct += 1;
        state.combo += 1;
        state.bestCombo = Math.max(state.bestCombo, state.combo);
        state.score += 100 * state.combo;
        emit('correct', { combo: state.combo, score: state.score });
        if (state.combo >= 2) emit('combo', { combo: state.combo });
      } else {
        state.wrong += 1;
        state.combo = 0;
        emit('wrong', {});
      }
      return { ok: true, correct };
    },

    revealHint() {
      if (state.phase !== 'question' || !state.question || state.answered || state.transitionLeft > 0) {
        return { ok: false };
      }
      if (state.hintLeft <= 0) return { ok: false };
      const q = state.question;
      if (q.options.length <= 2) return { ok: false };
      const wrongIdx = q.options.map((o, i) => (o !== q.target ? i : -1)).filter((i) => i >= 0);
      if (wrongIdx.length === 0) return { ok: false };
      const remove = wrongIdx[Math.floor(rng() * wrongIdx.length)];
      q.options.splice(remove, 1);
      state.hintLeft -= 1;
      emit('hint', { hintLeft: state.hintLeft });
      return { ok: true };
    },

    drainEvents() {
      const e = events;
      events = [];
      return e;
    },

    getHud() {
      return {
        level: state.level,
        timeLeft: state.timeLeft,
        score: state.score,
        combo: state.combo,
        hintLeft: state.hintLeft,
        correct: state.correct,
        wrong: state.wrong,
        phase: state.phase,
      };
    },
  };

  return run;
}
