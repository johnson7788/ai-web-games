// COLOR MASTER MIX · 纯逻辑（不碰 DOM/window/localStorage/Date.now；随机用 seed）
// 玩法：把程序化轮廓的每个分格用 8×8 色板上色；封印格要邻居上色才解锁；
// 连击窗口内连续上色叠连击分；全部上色即胜利并按剩余时间+最大连击结算 1–3 星；超时失败。
import { GAME } from '../../config/game.config.js';
import { LEVELS } from '../../config/shapes.js';

// 可复现随机（selfplay 用固定 seed）
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createRun(levelIndex = 0, opts = {}) {
  const level = LEVELS[levelIndex] || LEVELS[0];
  const regions = level.cells.map((cell) => ({
    id: cell.id,
    r: cell.r,
    c: cell.c,
    x: cell.x,
    y: cell.y,
    neighbors: cell.neighbors.slice(),
    locked: !!cell.locked,
    unlocked: !cell.locked,
    colored: false,
    color: null,
  }));

  const state = {
    phase: 'playing',       // playing | won | lost
    outcome: null,          // win | lose
    timeLeft: level.time,
    totalTime: level.time,
    elapsed: 0,
    selectedFamily: 0,
    selectedShade: 0,
    combo: 0,
    maxCombo: 0,
    score: 0,
    filled: 0,
    total: regions.length,
    magicFillsLeft: GAME.MAGIC_FILLS,
    lastFillAt: -Infinity,
    undoStack: [],
    stars: 0,
  };

  const run = {
    levelIndex,
    level,
    regions,
    state,
    events: [],
    rng: mulberry32(opts.seed == null ? 1 : opts.seed),
    _lastTick: Infinity,
  };

  run.emit = (type, payload = {}) => {
    // 注意：payload 里不允许出现 type 字段（会覆盖事件名），调用方保证。
    run.events.push({ type, ...payload });
  };

  run.colorIndex = () => state.selectedFamily * GAME.SHADES + state.selectedShade;

  run.selectFamily = (f) => {
    if (run.state.phase !== 'playing') return { ok: false, reason: 'phase' };
    if (!Number.isInteger(f) || f < 0 || f >= GAME.FAMILIES) return { ok: false, reason: 'range' };
    state.selectedFamily = f;
    run.emit('selectFamily', { family: f });
    return { ok: true };
  };

  run.selectShade = (s) => {
    if (run.state.phase !== 'playing') return { ok: false, reason: 'phase' };
    if (!Number.isInteger(s) || s < 0 || s >= GAME.SHADES) return { ok: false, reason: 'range' };
    state.selectedShade = s;
    run.emit('selectShade', { family: state.selectedFamily, shade: s, color: run.colorIndex() });
    return { ok: true };
  };

  // 上色一个分格（free=false 时参与连击；magicFill 走 free=true）
  run._fill = (id, eventType, free = false) => {
    const r = run.regions[id];
    const now = state.elapsed;
    if (!free) {
      const within = now - state.lastFillAt <= GAME.COMBO_WINDOW;
      state.combo = within ? Math.min(state.combo + 1, GAME.COMBO_MAX) : 1;
      state.maxCombo = Math.max(state.maxCombo, state.combo);
      state.lastFillAt = now;
    }
    const gain = free ? GAME.FILL_SCORE : GAME.FILL_SCORE + (state.combo - 1) * GAME.COMBO_SCORE;
    state.score += gain;
    r.colored = true;
    r.color = run.colorIndex();
    state.filled += 1;
    state.undoStack.push(id);
    run.emit(eventType, {
      id,
      color: r.color,
      combo: state.combo,
      score: state.score,
      filled: state.filled,
      total: state.total,
      free: !!free,
    });
    if (!free && state.combo >= 2) run.emit('combo', { combo: state.combo });
    run._unlockRocks();
    if (state.filled === state.total) run._win();
  };

  run._unlockRocks = () => {
    for (const r of run.regions) {
      if (r.locked && !r.unlocked) {
        const coloredN = r.neighbors.filter((n) => run.regions[n].colored).length;
        if (coloredN >= GAME.ROCK_UNLOCK_NEIGHBORS) {
          r.unlocked = true;
          run.emit('rockUnlock', { id: r.id });
        }
      }
    }
  };

  run.tap = (id) => {
    if (run.state.phase !== 'playing') return { ok: false, reason: 'phase' };
    const r = run.regions[id];
    if (!r) return { ok: false, reason: 'range' };
    if (!r.unlocked) return { ok: false, reason: 'locked' };
    if (r.colored) return { ok: false, reason: 'colored' };
    run._fill(id, 'regionFill');
    return { ok: true };
  };

  run.undo = () => {
    if (run.state.phase !== 'playing') return { ok: false, reason: 'phase' };
    if (!state.undoStack.length) return { ok: false, reason: 'empty' };
    const id = state.undoStack.pop();
    const r = run.regions[id];
    r.colored = false;
    r.color = null;
    state.filled -= 1;
    state.combo = 0; // 撤销打断连击
    run.emit('undo', { id, filled: state.filled, total: state.total });
    return { ok: true };
  };

  run.magicFill = () => {
    if (run.state.phase !== 'playing') return { ok: false, reason: 'phase' };
    if (state.magicFillsLeft <= 0) return { ok: false, reason: 'noCharge' };
    const target = run.regions.find((r) => !r.colored && r.unlocked);
    if (!target) return { ok: false, reason: 'none' };
    state.magicFillsLeft -= 1;
    run._fill(target.id, 'magicFill', true);
    return { ok: true, id: target.id };
  };

  run._win = () => {
    state.phase = 'won';
    state.outcome = 'win';
    let stars = 1;
    if (state.timeLeft / state.totalTime >= GAME.STAR_TIME_RATIO) stars += 1;
    if (state.maxCombo >= GAME.STAR_COMBO) stars += 1;
    state.stars = Math.min(3, stars);
    run.emit('win', {
      stars: state.stars,
      score: state.score,
      timeLeft: state.timeLeft,
      combo: state.maxCombo,
    });
    run.emit('star', { stars: state.stars });
  };

  run._lose = (reason) => {
    state.phase = 'lost';
    state.outcome = 'lose';
    state.stars = 0;
    run.emit('lose', { reason, score: state.score, filled: state.filled, total: state.total });
  };

  run.step = (dt) => {
    if (run.state.phase !== 'playing') return;
    state.elapsed += dt;
    state.timeLeft -= dt;
    if (state.timeLeft <= 0) {
      state.timeLeft = 0;
      run._lose('timeOut');
      return;
    }
    const whole = Math.ceil(state.timeLeft);
    if (whole !== run._lastTick && whole <= 5 && whole > 0) {
      run._lastTick = whole;
      run.emit('countdownTick', { timeLeft: whole });
    }
  };

  run.drainEvents = () => {
    const out = run.events;
    run.events = [];
    return out;
  };

  run.getHud = () => ({
    level: run.levelIndex + 1,
    timeLeft: Math.ceil(state.timeLeft),
    totalTime: state.totalTime,
    score: state.score,
    combo: state.combo,
    maxCombo: state.maxCombo,
    filled: state.filled,
    total: state.total,
    stars: state.stars,
    selectedFamily: state.selectedFamily,
    selectedShade: state.selectedShade,
    magicFillsLeft: state.magicFillsLeft,
    phase: state.phase,
    outcome: state.outcome,
    progress: state.total ? state.filled / state.total : 0,
  });

  run.emit('levelStart', { level: run.levelIndex + 1, total: state.total });
  return run;
}
