// 纯逻辑：SPOT THE ODD 的回合制点选核心（无 DOM / 无渲染 / 无音频）。
// 玩法骨架对齐「找你妹」：任务条给类别与数量 → 点选同类收集 → 计时 → 与 AI 对手竞速 → 5 回合结算。
// 新增机制：ODD 异类奖励（点中 +时间/+分不惩罚）、连击倍率（点错归零）、三星评级。

import {
  CATEGORIES,
  CATEGORY_ORDER,
  ITEMS,
  ROUNDS,
  ROUND_TIME,
  NEED,
  HINT_COUNT,
  ODD_TIME_BONUS,
  ODD_SCORE_BONUS,
  CORRECT_SCORE,
  WRONG_SCORE_COST,
  COMBO_MAX,
  AI_COMPLETE_MIN,
  AI_COMPLETE_MAX,
} from '../../config/game.config.js';

// 确定性伪随机（mulberry32）：同 seed 同局面，测试/自对弈可复现。
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

export const CATEGORY_BY_ID = Object.fromEntries(CATEGORIES.map((c) => [c.id, c]));

function emit(run, type, payload = {}) {
  run.events.push({ type, payload, t: run.t });
}

function pickOdd(run) {
  // ODD 异类：从「非任务类别」里随机挑一个，保证点它不帮助主线（有辨识的取舍）。
  const candidates = run.items.filter((it) => it.cat !== run.task.cat);
  const idx = Math.floor(run._rng() * candidates.length);
  candidates[idx].odd = true;
  candidates[idx].oddResolved = false;
}

function buildTask(run) {
  // 5 回合覆盖 5 个类别（顺序由 seed 洗牌），数量按 NEED 递增。
  const order = shuffle(CATEGORY_ORDER, run._rng);
  const catId = order[(run.round - 1) % CATEGORY_ORDER.length];
  const need = NEED[Math.min(run.round - 1, NEED.length - 1)];
  run.task = { cat: catId, need, found: 0 };
}

function startRound(run) {
  buildTask(run);
  run.timeLeft = ROUND_TIME;
  run.aiProgress = 0;
  run.aiSpeed = 1 / (AI_COMPLETE_MIN + run._rng() * (AI_COMPLETE_MAX - AI_COMPLETE_MIN));
  run.hintIndex = null;
  run.lastRoundResult = null;

  // 25 个物品洗牌，映射成网格对象（index = 格子位置）
  const order = shuffle(ITEMS.map((_, i) => i), run._rng);
  run.items = order.map((itemIdx) => {
    const src = ITEMS[itemIdx];
    return {
      uid: src.id,
      itemIdx,
      cat: src.cat,
      draw: src.draw,
      collected: false,
      odd: false,
      oddResolved: false,
    };
  });
  pickOdd(run);
  emit(run, 'roundStart', { round: run.round, cat: run.task.cat, need: run.task.need });
}

export function createRun(seed = 1) {
  const run = {
    phase: 'playing',     // playing → (finished 时) 由 main 决定 result
    seed: seed >>> 0,
    t: 0,
    round: 1,
    totalRounds: ROUNDS,
    task: null,
    items: [],
    timeLeft: ROUND_TIME,
    aiProgress: 0,
    aiSpeed: 0,
    score: 0,
    combo: 1,
    comboPeak: 1,
    oddFoundTotal: 0,
    roundsWon: 0,
    roundsLost: 0,
    roundsDrawn: 0,
    hintLeft: HINT_COUNT,
    hintIndex: null,
    lastRoundResult: null,
    finished: false,
    won: false,
    stars: 0,
    events: [],
    _rng: mulberry32(seed >>> 0),
  };
  startRound(run);
  return run;
}

function finishGame(run) {
  run.finished = true;
  run.won = run.roundsWon > run.roundsLost;
  // 三星评级：1 星 = 完赛；2 星 = 赢；3 星 = 大胜 + 找到足够异类 + 高连击。
  let stars = 1;
  if (run.won) stars = 2;
  if (run.roundsWon >= ROUNDS - 1 && run.oddFoundTotal >= 3 && run.comboPeak >= 3) stars = 3;
  run.stars = stars;
  emit(run, run.won ? 'gameWin' : 'gameLose', { stars, roundsWon: run.roundsWon, roundsLost: run.roundsLost, score: run.score });
}

function endRound(run, reason) {
  if (run.finished) return;
  const playerProgress = run.task.need > 0 ? run.task.found / run.task.need : 1;
  let result;
  if (reason === 'complete') {
    result = 'win';
  } else if (reason === 'ai') {
    result = 'lose';
  } else {
    // 超时：比较双方进度
    if (playerProgress > run.aiProgress + 1e-6) result = 'win';
    else if (run.aiProgress > playerProgress + 1e-6) result = 'lose';
    else result = 'draw';
  }

  if (result === 'win') run.roundsWon += 1;
  else if (result === 'lose') run.roundsLost += 1;
  else run.roundsDrawn += 1;

  run.lastRoundResult = result;
  emit(run, `round${result === 'win' ? 'Win' : result === 'lose' ? 'Lose' : 'Draw'}`, {
    round: run.round,
    result,
    playerProgress,
    aiProgress: run.aiProgress,
    won: run.roundsWon,
    lost: run.roundsLost,
  });

  if (run.round >= run.totalRounds) {
    finishGame(run);
    return;
  }
  run.round += 1;
  startRound(run);
}

export function step(run, dt = 1 / 60) {
  if (run.finished) return;
  run.t += dt;
  run.timeLeft -= dt;
  run.aiProgress = Math.min(1, run.aiProgress + run.aiSpeed * dt);

  // 每秒整点、最后 5 秒发 countdown 事件（音频/心跳）
  const prevCeil = Math.ceil(run.timeLeft + dt);
  const nowCeil = Math.ceil(run.timeLeft);
  if (nowCeil !== prevCeil && run.timeLeft <= 5 && run.timeLeft > 0) {
    emit(run, 'countdown', { timeLeft: run.timeLeft });
  }

  if (run.aiProgress >= 1) {
    endRound(run, 'ai');
    return;
  }
  if (run.timeLeft <= 0) {
    endRound(run, 'timeout');
  }
}

function taskDone(run) {
  return run.task.found >= run.task.need;
}

// 点选：返回 { ok, kind }。kind: 'correct' | 'wrong' | 'odd' | 'done' | 'locked'
export function tap(run, index) {
  if (run.finished) return { ok: false, kind: 'locked' };
  const item = run.items[index];
  if (!item) return { ok: false, kind: 'locked' };
  if (item.collected) return { ok: false, kind: 'done' };

  // ODD 异类：总是安全奖励，不惩罚、不重置连击、不占主线进度
  if (item.odd && !item.oddResolved) {
    item.oddResolved = true;
    run.oddFoundTotal += 1;
    run.timeLeft = Math.min(ROUND_TIME, run.timeLeft + ODD_TIME_BONUS);
    run.score += ODD_SCORE_BONUS;
    emit(run, 'oddFound', { index, bonus: ODD_TIME_BONUS, oddFoundTotal: run.oddFoundTotal });
    return { ok: true, kind: 'odd' };
  }

  if (item.cat === run.task.cat) {
    item.collected = true;
    run.task.found += 1;
    run.score += CORRECT_SCORE * run.combo;
    const prevCombo = run.combo;
    if (run.combo < COMBO_MAX) run.combo += 1;
    run.comboPeak = Math.max(run.comboPeak, run.combo);
    emit(run, 'tapCorrect', { index, found: run.task.found, need: run.task.need, combo: run.combo });
    if (run.combo > prevCombo && run.combo >= 2) emit(run, 'combo', { combo: run.combo });
    if (taskDone(run)) endRound(run, 'complete');
    return { ok: true, kind: 'correct' };
  }

  // 点错：重置连击 + 少量扣分（不扣时间）
  run.combo = 1;
  run.score = Math.max(0, run.score - WRONG_SCORE_COST);
  emit(run, 'tapWrong', { index });
  return { ok: true, kind: 'wrong' };
}

// 提示：高亮一个未收集的任务类别物品
export function hint(run) {
  if (run.finished) return { ok: false, index: null };
  if (run.hintLeft <= 0) return { ok: false, index: null };
  const candidates = [];
  run.items.forEach((it, i) => {
    if (!it.collected && it.cat === run.task.cat && !(it.odd && !it.oddResolved)) candidates.push(i);
  });
  if (!candidates.length) return { ok: false, index: null };
  const index = candidates[Math.floor(run._rng() * candidates.length)];
  run.hintLeft -= 1;
  run.hintIndex = index;
  emit(run, 'hint', { index, hintLeft: run.hintLeft });
  return { ok: true, index };
}

// 供 main 与 selfplay 消费事件
export function drainEvents(run) {
  const out = run.events;
  run.events = [];
  return out;
}

// 便捷再导出（测试 / 工具直接 import sim 即可拿到数值）
export {
  CATEGORIES,
  ITEMS,
  ROUNDS,
  ROUND_TIME,
  NEED,
  HINT_COUNT,
  ODD_TIME_BONUS,
  CORRECT_SCORE,
  COMBO_MAX,
};

// 标准 run 接口别名（playbook 契约）
export function createRunDecorated(seed) {
  const run = createRun(seed);
  run.step = (dt) => step(run, dt);
  run.tap = (index) => tap(run, index);
  run.hint = () => hint(run);
  run.getHud = () => ({
    round: run.round,
    timeLeft: run.timeLeft,
    score: run.score,
    combo: run.combo,
    task: run.task,
    aiProgress: run.aiProgress,
    roundsWon: run.roundsWon,
    roundsLost: run.roundsLost,
    stars: run.stars,
  });
  run.drainEvents = () => drainEvents(run);
  return run;
}
