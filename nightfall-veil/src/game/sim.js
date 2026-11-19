// 纯逻辑（无 DOM，可在 Node 直接跑）：算式符文下落 + 数字键盘输入 + 化解判定。
// 玩法骨架 1:1 保留参考玩法：算式从顶落下、输入答案按下化解、遗漏超限失败、撑过时限过关。
// 新增机制：连击加成 / 星级结算 / 金色符文爆分。
import { WORLD, GAME } from '../../config/game.config.js';
import { LEVELS, LEVEL_COUNT } from '../../config/levels.js';

// 确定性随机数（selfplay 与测试复用同一实现）
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

function randByDigit(rng, digit) {
  if (digit === 1) return Math.floor(rng() * 10);
  const min = Math.pow(10, digit - 1);
  const max = Math.pow(10, digit) - 1;
  return min + Math.floor(rng() * (max - min + 1));
}

// 按权重选一项，再按参考逻辑生成「只含 + / -，且中间结果不为负」的算式
export function genEquation(types, rng) {
  let r = rng();
  let acc = 0;
  let chosen = types[0];
  for (const t of types) {
    acc += t.rate;
    if (r <= acc) { chosen = t; break; }
  }
  const number = chosen[0];
  const digit = chosen[1];

  let result = randByDigit(rng, digit);
  let str = String(result);
  for (let i = 1; i < number; i += 1) {
    const item = randByDigit(rng, digit);
    let symbol = rng() < 0.5 ? 1 : 0; // 1 = 减
    if (symbol === 1 && result - item < 0) symbol = 0;
    if (symbol === 1) { result -= item; str += '-'; }
    else { result += item; str += '+'; }
    str += item;
  }
  return { subject: str, result };
}

function computeStars(state) {
  let stars = 1;               // 撑过时限 = 1 星
  if (state.missCount === 0) stars += 1;   // 零遗漏 +1
  if (state.errorCount === 0) stars += 1;  // 零误输 +1
  return stars;
}

export function createRun(levelIndex = 0, opts = {}) {
  const seed = (opts.seed == null ? 1 : opts.seed) >>> 0;
  const rng = mulberry32(seed);
  const idx = Math.max(0, Math.min(LEVEL_COUNT - 1, levelIndex | 0));
  const level = LEVELS[idx];
  const types = level.types;

  const state = {
    phase: 'countdown',   // countdown | playing | won | lost
    level: idx + 1,       // 1 基
    countdownLeft: level.countdown,
    timeLeft: level.timeLimit,
    initialTime: level.timeLimit,
    spawnTimer: 0,
    subjects: [],         // { id, subject, result, x, y, golden }
    input: '',
    rightCount: 0,
    errorCount: 0,
    missCount: 0,
    combo: 0,
    maxCombo: 0,
    score: 0,
    stars: 1,
    bonusCount: 0,
    spawnIndex: 0,
    nextId: 1,
    overReason: null,
  };

  const events = [];
  const push = (type, payload = {}) => events.push({ type, ...payload });

  function spawnSubject() {
    const { subject, result } = genEquation(types, rng);
    const golden = state.spawnIndex > 0 && state.spawnIndex % GAME.GOLDEN_EVERY === 0;
    const x = GAME.SUBJECT_MIN_X + rng() * (WORLD.WIDTH - GAME.SUBJECT_MIN_X * 2);
    const s = {
      id: state.nextId++,
      subject,
      result,
      x,
      y: GAME.SPAWN_Y,
      golden,
    };
    state.subjects.push(s);
    state.spawnIndex += 1;
    push('spawn', { id: s.id, subject, result, golden, x });
  }

  function lose(reason) {
    if (state.phase !== 'playing') return;
    state.phase = 'lost';
    state.stars = 0;
    state.overReason = reason;
    push('lose', {
      reason,
      level: state.level,
      rightCount: state.rightCount,
      missCount: state.missCount,
      errorCount: state.errorCount,
      score: state.score,
    });
  }

  function win() {
    if (state.phase !== 'playing') return;
    state.phase = 'won';
    state.stars = computeStars(state);
    push('win', {
      level: state.level,
      stars: state.stars,
      rightCount: state.rightCount,
      missCount: state.missCount,
      errorCount: state.errorCount,
      score: state.score,
      maxCombo: state.maxCombo,
    });
  }

  function answer(value) {
    if (state.phase !== 'playing') return { ok: false, matched: false };
    const matched = [];
    for (let i = state.subjects.length - 1; i >= 0; i -= 1) {
      if (state.subjects[i].result === value) {
        matched.push(state.subjects[i]);
        state.subjects.splice(i, 1);
      }
    }
    state.input = '';
    if (!matched.length) {
      state.errorCount += 1;
      state.combo = 0;
      push('error', { value });
      return { ok: true, matched: false };
    }

    // 答对：连击 + 计分（金符单独爆分）
    state.combo += 1;
    state.maxCombo = Math.max(state.maxCombo, state.combo);
    let gained = GAME.BASE_SCORE;
    if (state.combo > 1) gained += (state.combo - 1) * GAME.COMBO_SCORE;
    for (const s of matched) {
      state.rightCount += 1;
      if (s.golden) {
        state.bonusCount += 1;
        gained += GAME.GOLDEN_BONUS;
        push('bonus', { id: s.id, subject: s.subject, result: s.result, x: s.x, y: s.y });
      } else {
        push('correct', { id: s.id, subject: s.subject, result: s.result, x: s.x, y: s.y });
      }
    }
    state.score += gained;
    if (state.combo >= 2) push('combo', { combo: state.combo });
    if (state.rightCount % GAME.MILESTONE_EVERY === 0) push('milestone', { rightCount: state.rightCount });
    return { ok: true, matched: true, count: matched.length };
  }

  function step(dt) {
    if (state.phase === 'countdown') {
      state.countdownLeft -= dt;
      if (state.countdownLeft <= 0) {
        state.phase = 'playing';
        state._lastCeil = Math.ceil(state.timeLeft);
        push('start', { level: state.level });
      }
      return;
    }
    if (state.phase !== 'playing') return;

    // 倒计时
    state.timeLeft -= dt;
    const ceilNow = Math.ceil(state.timeLeft);
    if (ceilNow !== state._lastCeil) {
      if (ceilNow >= 1 && ceilNow <= 5 && state.timeLeft > 0) push('countdownTick', { timeLeft: ceilNow });
      state._lastCeil = ceilNow;
    }

    // 生成
    state.spawnTimer -= dt;
    if (state.spawnTimer <= 0) {
      spawnSubject();
      state.spawnTimer = 1 / level.createRate;
    }

    // 下落 + 越界判定
    const speed = level.downSpeed * WORLD.HEIGHT;
    for (let i = state.subjects.length - 1; i >= 0; i -= 1) {
      const s = state.subjects[i];
      s.y += speed * dt;
      if (s.y >= GAME.VEIL_Y) {
        state.subjects.splice(i, 1);
        state.missCount += 1;
        state.combo = 0;
        push('miss', { id: s.id, subject: s.subject, result: s.result, x: s.x, y: s.y });
        if (state.missCount >= level.maxMissCount) {
          lose('missLimit');
          return;
        }
      }
    }

    if (state.timeLeft <= 0) win();
  }

  const run = {
    state,
    step,
    drainEvents() { return events.splice(0, events.length); },
    typeDigit(d) {
      if (state.phase !== 'playing') return { ok: false };
      if (state.input.length >= 10) return { ok: false };
      state.input += String(d);
      return { ok: true };
    },
    backspace() {
      if (state.phase !== 'playing') return { ok: false };
      if (!state.input.length) return { ok: false };
      state.input = state.input.slice(0, -1);
      return { ok: true };
    },
    clearInput() {
      state.input = '';
      return { ok: true };
    },
    submit() {
      if (state.phase !== 'playing') return { ok: false, matched: false };
      if (!state.input.length) return { ok: false, matched: false };
      const v = parseInt(state.input, 10);
      return answer(v);
    },
    answer,
    getHud() {
      return {
        phase: state.phase,
        level: state.level,
        timeLeft: Math.max(0, state.timeLeft),
        score: state.score,
        rightCount: state.rightCount,
        missCount: state.missCount,
        errorCount: state.errorCount,
        combo: state.combo,
        input: state.input,
      };
    },
  };
  return run;
}

export { computeStars };
