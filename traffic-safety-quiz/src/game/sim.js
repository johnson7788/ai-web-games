// 纯逻辑：交通安全判断问答（无 DOM，可 Node 测试）。
// 玩法：10 张交通场景图，判断「安全/危险」。答对自动翻题并累积连击；
//       答错重置连击并锁定按钮；倒计时结束未答完判负；答完按得分结算 1–3 星。
// 契约：createRun() → { state, step, answer, navigate, getHud, drainEvents }。
import { QUESTIONS } from '../../config/questions.js';
import { QUIZ } from '../../config/game.config.js';

// 确定性伪随机（selfplay / 测试可复现）
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffledOrder(rng) {
  const arr = QUESTIONS.map((q) => q.id);
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function roundOf(index) {
  // 按累计题量分三关：人行道 / 过马路 / 信号与危险
  if (index < QUIZ.ROUNDS[0]) return 1;
  if (index < QUIZ.ROUNDS[0] + QUIZ.ROUNDS[1]) return 2;
  return 3;
}

export function createRun(opts = {}) {
  const seed = opts.seed ?? 1;
  const rng = mulberry32(seed);
  const order = shuffledOrder(rng);
  const events = [];

  const state = {
    phase: 'playing',   // playing | result
    order,
    index: 0,
    score: 0,
    combo: 0,
    maxCombo: 0,
    correct: 0,
    wrong: 0,
    total: QUESTIONS.length,
    timeLeft: QUIZ.TIME_LIMIT,
    totalTime: QUIZ.TIME_LIMIT,
    time: 0,
    stars: 0,
    won: false,
    reason: null,       // null | 'timeout'
    answered: new Set(),
    lockUntil: 0,       // sim 时间：答错后按钮锁定到该时刻
    round: 1,
    lastGain: 0,
  };

  const emit = (type, payload = {}) => events.push({ type, ...payload });
  const current = () => QUESTIONS[order[state.index]];

  function clampIndex(i) {
    return Math.max(0, Math.min(order.length - 1, i));
  }

  function finish(won, reason) {
    state.phase = 'result';
    state.won = won;
    state.reason = reason;
    if (won) {
      if (state.wrong === 0 && state.score >= QUIZ.STAR3_SCORE) state.stars = 3;
      else if (state.score >= QUIZ.STAR3_SCORE) state.stars = 3;
      else if (state.score >= QUIZ.STAR2_SCORE) state.stars = 2;
      else state.stars = 1;
      emit('win', { score: state.score, stars: state.stars, correct: state.correct });
      emit('star', { stars: state.stars });
    } else {
      state.stars = 0;
      emit('lose', { reason, correct: state.correct });
    }
  }

  const run = {
    state,

    step(dt = 1 / 60) {
      if (state.phase !== 'playing') return;
      state.time += dt;
      const prevLeft = state.timeLeft;
      state.timeLeft = Math.max(0, state.totalTime - state.time);
      // 最后 5 秒每秒 beep（可感知反馈，也供 selfplay 作为事件密度）
      const p = Math.ceil(prevLeft);
      const n = Math.ceil(state.timeLeft);
      if (state.timeLeft > 0 && n < p && state.timeLeft <= 5) {
        emit('countdownTick', { timeLeft: Math.ceil(state.timeLeft) });
      }
      if (state.timeLeft <= 0) {
        state.timeLeft = 0;
        finish(false, 'timeout');
      }
    },

    answer(choice) {
      if (state.phase !== 'playing') return { ok: false, reason: 'phase' };
      if (state.time < state.lockUntil) return { ok: false, reason: 'locked' };
      const q = current();
      const isRight = choice === q.answer;
      if (isRight) {
        if (!state.answered.has(q.id)) {
          state.answered.add(q.id);
          state.correct += 1;
          state.combo += 1;
          state.maxCombo = Math.max(state.maxCombo, state.combo);
          const bonus = Math.min(state.combo * QUIZ.COMBO_BONUS, QUIZ.COMBO_BONUS_MAX);
          const gain = QUIZ.BASE_SCORE + bonus;
          state.score += gain;
          state.lastGain = gain;
          emit('answer_correct', { id: q.id, gain, combo: state.combo });
          if (state.combo >= 2) emit('combo', { combo: state.combo });
          if (state.combo === 3 || state.combo === 6 || state.combo === 9) emit('combo_milestone', { combo: state.combo });
        }
        if (state.answered.size >= QUESTIONS.length) {
          finish(true, null);
          return { ok: true, correct: true, done: true };
        }
        // 答对自动翻到下一题
        const next = clampIndex(state.index + 1);
        if (next !== state.index) {
          const prevRound = state.round;
          state.index = next;
          state.round = roundOf(next);
          emit('advance', { index: state.index, round: state.round });
          if (state.round !== prevRound) emit('round', { round: state.round });
        }
        return { ok: true, correct: true, gain: state.lastGain, done: false };
      }
      // 答错：重置连击 + 锁按钮
      state.wrong += 1;
      state.combo = 0;
      state.lockUntil = state.time + QUIZ.WRONG_LOCK_DELAY;
      emit('answer_wrong', { id: q.id, combo: 0 });
      return { ok: true, correct: false };
    },

    navigate(dir) {
      if (state.phase !== 'playing') return { ok: false };
      const next = clampIndex(state.index + (dir > 0 ? 1 : -1));
      if (next === state.index) return { ok: false };
      state.index = next;
      state.round = roundOf(next);
      emit('nav', { index: state.index, round: state.round });
      return { ok: true, index: state.index };
    },

    // 标准 run 别名（playbook 契约）：step(input) / getHud() / drainEvents()
    getHud() {
      return {
        phase: state.phase,
        timeLeft: state.timeLeft,
        score: state.score,
        combo: state.combo,
        correct: state.correct,
        wrong: state.wrong,
        index: state.index,
        round: state.round,
        total: QUESTIONS.length,
        stars: state.stars,
        won: state.won,
      };
    },

    drainEvents() {
      return events.splice(0, events.length);
    },
  };

  // 初始 round
  state.round = roundOf(0);
  return run;
}
