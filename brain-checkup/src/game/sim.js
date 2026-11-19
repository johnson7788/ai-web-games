// BRAIN CHECKUP · 纯逻辑（可无头测试）
// 职责：关卡/连击/智慧/星级/计时 的状态机。DOM 层把「正确/错误」的操作翻译成 act(ok)/submit(v)。
// 事件：start / correct / answered / wrong / hint / skip / win / combo / timeout / complete
import { GAME } from '../../config/game.config.js';
import { LEVELS, LEVEL_COUNT } from '../../config/levels.js';

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function levelFor(i) {
  return LEVELS[Math.max(0, Math.min(LEVEL_COUNT - 1, i | 0))];
}

/** 该关需要多少次「正确微操作」才通关（tap/rate 多次；其余一次 submit 即可） */
export function requiredTaps(level) {
  if (level.kind === 'tap' || level.kind === 'rate') return level.taps || 1;
  return 1;
}

/** submit(v) 是否正确：input 走字符串比对，其余走严格相等 */
export function matchesAnswer(level, v) {
  const a = level.answer;
  // 手势类（hold/drag/flip/timing）没有 answer：DOM 已自行判定条件，submit(true)=通过
  if (a === undefined || a === null) return v === true;
  if (level.kind === 'input') return String(v).trim().toLowerCase() === String(a).trim().toLowerCase();
  if (Array.isArray(a)) return Array.isArray(v) && v.join(',') === a.join(',');
  return v === a;
}

export function createRun(opts = {}) {
  const totalLevels = opts.totalLevels || LEVEL_COUNT;
  const state = {
    phase: 'idle',          // idle | playing | won
    level: 0,               // 当前关（1 基）；0 = 尚未开始
    levelIndex: -1,         // 0 基
    wisdom: GAME.START_WISDOM,
    combo: 0,
    bestCombo: 0,
    mistakes: 0,            // 本关错误次数
    progress: 0,            // 本关正确微操作数
    timeLeft: 0,
    initialTime: 0,
    timedOut: false,
    stars: {},              // level -> stars
    solved: 0,
    completed: false,
    totalLevels,
  };
  const events = [];

  function emit(type, payload = {}) {
    events.push({ type, level: state.level, ...payload });
  }

  function clampWisdom() {
    state.wisdom = Math.max(0, Math.min(GAME.WISDOM_MAX, state.wisdom));
  }

  function currentLevel() {
    return levelFor(state.levelIndex);
  }

  function startLevel(i) {
    const idx = Math.max(0, Math.min(totalLevels - 1, i | 0));
    const lv = levelFor(idx);
    state.levelIndex = idx;
    state.level = idx + 1;
    state.phase = 'playing';
    state.mistakes = 0;
    state.progress = 0;
    state.timedOut = false;
    state.initialTime = GAME.LEVEL_TIME;
    state.timeLeft = state.initialTime;
    emit('start', { levelIndex: idx });
    return true;
  }

  function winLevel() {
    state.phase = 'won';
    state.combo += 1;
    state.bestCombo = Math.max(state.bestCombo, state.combo);
    const noMistake = state.mistakes === 0;
    const timeStar = !state.timedOut && state.timeLeft >= state.initialTime * GAME.TIME_STAR_RATIO;
    const stars = 1 + (noMistake ? 1 : 0) + (timeStar ? 1 : 0);
    state.stars[state.level] = Math.max(state.stars[state.level] | 0, stars);
    state.solved += 1;
    const bonus = GAME.WIN_BONUS + (state.combo >= GAME.COMBO_AT ? GAME.COMBO_BONUS : 0);
    state.wisdom += bonus;
    clampWisdom();
    if (state.level >= totalLevels) state.completed = true;
    emit('win', { stars, combo: state.combo, bonus });
    if (state.combo > 0 && state.combo % GAME.COMBO_AT === 0) {
      emit('combo', { combo: state.combo });
    }
    if (state.completed) emit('complete', {});
  }

  function wrong() {
    state.mistakes += 1;
    state.combo = 0;
    emit('wrong', { mistakes: state.mistakes });
  }

  /** 一次「正确/错误」的微操作（tap/rate 用）。返回是否被接受。 */
  function act(ok) {
    if (state.phase !== 'playing') return { ok: false, correct: false };
    if (ok) {
      state.progress += 1;
      if (state.progress >= requiredTaps(currentLevel())) {
        emit('correct', { progress: state.progress });
        winLevel();
      } else {
        emit('correct', { progress: state.progress });
      }
      return { ok: true, correct: true };
    }
    wrong();
    return { ok: true, correct: false };
  }

  /** 一次「提交答案」（choice/select/input/timing/flip/hold/drag 用）。 */
  function submit(v) {
    if (state.phase !== 'playing') return { ok: false, correct: false };
    const correct = matchesAnswer(currentLevel(), v);
    if (correct) {
      state.progress = requiredTaps(currentLevel());
      emit('answered', { correct: true });
      winLevel();
    } else {
      wrong();
      emit('answered', { correct: false });
    }
    return { ok: true, correct };
  }

  /** 使用提示：扣智慧。 */
  function hint() {
    if (state.wisdom < GAME.HINT_COST) {
      emit('hintDenied', {});
      return false;
    }
    state.wisdom -= GAME.HINT_COST;
    clampWisdom();
    emit('hint', { cost: GAME.HINT_COST });
    return true;
  }

  /** 跳关：扣智慧并直接判过（0 星，不算连击）。 */
  function skip() {
    if (state.phase !== 'playing' || state.wisdom < GAME.SKIP_COST) {
      emit('skipDenied', {});
      return false;
    }
    state.wisdom -= GAME.SKIP_COST;
    clampWisdom();
    state.phase = 'won';
    state.combo = 0;
    state.solved += 1;
    state.stars[state.level] = Math.max(state.stars[state.level] | 0, 0);
    if (state.level >= totalLevels) state.completed = true;
    emit('skip', { cost: GAME.SKIP_COST });
    if (state.completed) emit('complete', {});
    return true;
  }

  function step(dt) {
    if (state.phase !== 'playing') return;
    state.timeLeft -= dt;
    if (state.timeLeft <= 0) {
      state.timeLeft = 0;
      if (!state.timedOut) {
        state.timedOut = true;
        emit('timeout', {});
      }
    }
  }

  function drainEvents() {
    if (events.length === 0) return [];
    return events.splice(0, events.length);
  }

  return {
    state,
    startLevel,
    act,
    submit,
    hint,
    skip,
    step,
    drainEvents,
    requiredTaps: () => requiredTaps(currentLevel()),
    currentLevel,
    matchesAnswer: (v) => matchesAnswer(currentLevel(), v),
  };
}
