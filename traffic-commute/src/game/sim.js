// 纯逻辑 sim（Node 可测，无 DOM）。交通问答核心状态机。
// 事件（drainEvents 消费）：question/retry/tap/correct/wrong/timeout/star/combo/comboBonus/hint/charSwitch/tick/win。
import { TOPICS, topicsFor, QUESTION_COUNT } from '../../config/topics.js';
import { GAME } from '../../config/game.config.js';

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function rng() {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function emit(state, type, payload = {}) {
  state.events.push({ type, ...payload });
}

function loadQuestion(state, qIndex) {
  state.questionIndex = qIndex;
  state.question = TOPICS[qIndex];
  state.travelerIndex = state.question.traveler;
  state.failedThisQuestion = false;
  state.hintActive = false;
  state.hintRemoved = -1;
  state.timeLeft = state.timeLimit;
  state.nextTickTime = Math.floor(state.t) + 1;
  emit(state, 'question', { q: qIndex, traveler: state.question.traveler });
}

function resetQuestion(state) {
  state.timeLeft = state.timeLimit;
  state.hintActive = false;
  state.hintRemoved = -1;
  state.nextTickTime = Math.floor(state.t) + 1;
  emit(state, 'retry', { q: state.questionIndex });
}

function timeOut(state) {
  state.failedThisQuestion = true;
  state.timeouts += 1;
  state.totalWrong += 1;
  state.combo = 0;
  emit(state, 'timeout', { q: state.questionIndex });
  resetQuestion(state);
}

function advance(state) {
  state.questionsDone += 1;
  const prevTraveler = state.question.traveler;
  const next = state.questionIndex + 1;
  if (next >= QUESTION_COUNT) {
    if (state.maxCombo >= GAME.COMBO_STAR_AT) {
      state.stars += 1;
      emit(state, 'star', { stars: state.stars, comboBonus: true });
      emit(state, 'comboBonus', { combo: state.maxCombo });
    }
    state.score += state.stars * 5;
    state.levelsReached = 3;
    state.phase = 'won';
    emit(state, 'win', { stars: state.stars, score: state.score, maxCombo: state.maxCombo });
    return;
  }
  loadQuestion(state, next);
  if (state.question.traveler !== prevTraveler) {
    state.levelsReached = 2;
    emit(state, 'charSwitch', { traveler: state.question.traveler });
  }
}

export function createRun(opts = {}) {
  const seed = opts.seed == null ? 1 : (opts.seed | 0);
  const traveler = opts.traveler == null ? 0 : (opts.traveler | 0);
  const state = {
    phase: 'playing',            // playing | won
    travelerIndex: traveler,
    questionIndex: 0,
    question: null,
    t: 0,                        // sim 内部时钟（秒）
    timeLeft: GAME.TIME_PER_QUESTION,
    timeLimit: GAME.TIME_PER_QUESTION,
    nextTickTime: 1,
    failedThisQuestion: false,   // 本题是否已错过（决定是否得星）
    totalWrong: 0,               // 整局错次数（含超时）
    timeouts: 0,
    combo: 0,
    maxCombo: 0,
    stars: 0,
    score: 0,
    hintLeft: GAME.HINT_PER_RUN,
    hintActive: false,
    hintRemoved: -1,
    questionsDone: 0,
    levelsReached: traveler === 0 ? 1 : 2,
    events: [],
    rng: mulberry32(seed || 1),
    seed,
  };

  const startIndex = traveler === 1 ? topicsFor(0).length : 0;
  loadQuestion(state, startIndex);

  const run = {
    state,

    step(dt) {
      if (state.phase !== 'playing') return;
      state.t += dt;
      state.timeLeft -= dt;
      while (state.nextTickTime <= state.t) {
        emit(state, 'tick', { left: Math.max(0, Math.ceil(state.timeLeft)) });
        state.nextTickTime += 1;
      }
      if (state.timeLeft <= 0) timeOut(state);
    },

    answer(i) {
      if (state.phase !== 'playing') return { ok: false };
      const q = state.question;
      if (!q || i < 0 || i >= q.options.length) return { ok: false };
      emit(state, 'tap', { i });
      if (q.correct.includes(i)) {
        emit(state, 'correct', { i });
        if (!state.failedThisQuestion && !state.hintActive) {
          state.stars += 1;
          state.combo += 1;
          state.maxCombo = Math.max(state.maxCombo, state.combo);
          state.score += 10 + Math.min(5, state.combo) * 2;
          emit(state, 'star', { stars: state.stars });
          emit(state, 'combo', { combo: state.combo });
        } else {
          state.combo = 0;
          state.score += 5;
        }
        advance(state);
        return { ok: true, correct: true };
      }
      state.failedThisQuestion = true;
      state.totalWrong += 1;
      state.combo = 0;
      emit(state, 'wrong', { i });
      resetQuestion(state);
      return { ok: true, correct: false };
    },

    hint() {
      if (state.phase !== 'playing') return { ok: false };
      if (state.hintLeft <= 0) return { ok: false };
      const q = state.question;
      const wrong = q.options.filter((o) => !q.correct.includes(o.i));
      if (!wrong.length) return { ok: false };
      state.hintLeft -= 1;
      state.hintActive = true;
      state.hintRemoved = wrong[0].i;
      emit(state, 'hint', { removed: wrong[0].i, hintLeft: state.hintLeft });
      return { ok: true, removed: wrong[0].i, hintLeft: state.hintLeft };
    },

    jumpTo(qIndex) {
      const idx = Math.max(0, Math.min(QUESTION_COUNT - 1, qIndex | 0));
      state.phase = 'playing';
      state.stars = 0;
      state.combo = 0;
      state.maxCombo = 0;
      state.score = 0;
      state.totalWrong = 0;
      state.timeouts = 0;
      state.questionsDone = 0;
      state.levelsReached = TOPICS[idx].traveler === 0 ? 1 : 2;
      state.events = [];
      loadQuestion(state, idx);
    },

    getHud() {
      return {
        score: state.score,
        stars: state.stars,
        combo: state.combo,
        timeLeft: state.timeLeft,
        hintLeft: state.hintLeft,
        questionIndex: state.questionIndex,
        total: QUESTION_COUNT,
        traveler: state.travelerIndex,
        phase: state.phase,
      };
    },

    drainEvents() {
      const out = state.events;
      state.events = [];
      return out;
    },
  };

  return run;
}
