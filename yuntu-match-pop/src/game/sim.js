// YUNTU MATCH POP · 纯逻辑 sim（零 DOM，可被 node --test / selfplay 无头驱动）
//
// 玩法骨架 1:1 还原「云浮消消乐」P0：
//   - 5 列 × 7 行，点列下落方块；新块 70% 是 2、30% 是 4。
//   - 相邻同值方块（上下左右）合并：目标值 × 2^邻块数；上限 8192（超限销毁）。
//   - 合并后上方方块下落（重力），再连锁判定；分 += 合并值；钻石 += floor(log2/5)。
//   - 点满列 → 游戏结束（lose）。
//
// 新增机制（改造换皮后原创）：
//   - 目标关（reach target tile）：任一方块值 >= 关卡目标 → 通关（win）。
//   - 连击 combo：一次落块触发 ≥2 波合并 → 连击加分 + combo 事件。
//   - 岩石 rock：第 3 关起每 N 次落块在随机列落一个 0 值障碍，紧邻合并即被清除（+50 分）。
//   - 星级 star：通关按「超目标值 / 得分」评 1–3 星。
//   - 炸弹 bomb：花钻石清除某列最底部方块（救急）。
import { LEVELS, LEVEL_COUNT } from '../../config/levels.js';
import { GAME } from '../../config/game.config.js';

export const COLS = 5;
export const ROWS = 7;
export const MAX_VALUE = GAME.MAX_VALUE;
export const DROP_TIME = GAME.DROP_TIME;
export const MERGE_TIME = GAME.MERGE_TIME;
export const BOMB_COST = GAME.BOMB_COST;
export const ROCK_SCORE = GAME.ROCK_SCORE;
export const COMBO_STEP = GAME.COMBO_STEP;

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

function clampIdx(i) {
  return Math.max(0, Math.min(LEVEL_COUNT - 1, i | 0));
}

export function createRun(levelIndex, opts = {}) {
  const idx = clampIdx(levelIndex);
  const lv = LEVELS[idx];
  const seed = (opts.seed | 0) || 1;
  const rng = mulberry32(seed);
  const rollNext = () => (rng() < 0.3 ? 4 : 2);

  const state = {
    phase: 'playing',            // playing | won | lost
    level: idx + 1,              // 1 基
    levelIndex: idx,
    target: lv.target,
    theme: lv.theme,
    cols: COLS,
    rows: ROWS,
    grid: Array.from({ length: COLS }, () => []),  // 每列 bottom-up：[{v}]，v=0 表示岩石
    nextValue: rollNext(),
    score: 0,
    diamonds: 0,
    bestValue: 0,
    placements: 0,
    combo: 0,
    maxCombo: 0,
    rocksCleared: 0,
    milestone: 2,
    stars: 0,
    busy: 0,
    pendingCol: null,
    rockPending: false,
    rockCountdown: lv.rockEvery > 0 ? lv.rockEvery : Infinity,
    time: 0,
  };

  const events = [];

  const key = (c, r) => `${c}_${r}`;
  const emit = (e) => events.push(e);

  function neighborsOf(c, r) {
    const out = [];
    if (r + 1 < state.grid[c].length) out.push([c, r + 1]);            // up
    if (r - 1 >= 0) out.push([c, r - 1]);                               // down
    if (c - 1 >= 0 && r < state.grid[c - 1].length) out.push([c - 1, r]); // left
    if (c + 1 < COLS && r < state.grid[c + 1].length) out.push([c + 1, r]); // right
    return out;
  }

  // 收集本轮所有合并组（目标块 + 待消邻块），与源码 4 方向邻接判定 1:1。
  function detectMerges() {
    const infos = [];
    const removed = new Set();
    for (let c = 0; c < COLS; c += 1) {
      for (let r = 0; r < state.grid[c].length; r += 1) {
        if (removed.has(key(c, r))) continue;
        const v = state.grid[c][r].v;
        if (!v || v <= 0) continue; // 岩石不合并
        const neighbors = [];
        for (const [nc, nr] of neighborsOf(c, r)) {
          const nv = state.grid[nc][nr].v;
          if (nv === v && nv > 0) neighbors.push([nc, nr]);
        }
        if (neighbors.length > 0) {
          infos.push({ target: [c, r], neighbors });
          for (const [nc, nr] of neighbors) removed.add(key(nc, nr));
        }
      }
    }
    return { infos, removed };
  }

  function checkWin() {
    if (state.bestValue >= state.target) {
      state.stars = 1
        + (state.bestValue >= state.target * 2 ? 1 : 0)
        + (state.score >= state.target * 5 ? 1 : 0);
      state.phase = 'won';
      emit({ type: 'win', stars: state.stars, score: state.score, target: state.target, bestValue: state.bestValue });
      return true;
    }
    return false;
  }

  // 合并 + 重力 + 连锁；返回合并波数（连击依据）。
  function resolve() {
    let waves = 0;
    let lastCombo = 0;
    while (true) {
      const { infos, removed } = detectMerges();
      if (infos.length === 0) break;
      waves += 1;
      for (const info of infos) {
        const [c, r] = info.target;
        const cell = state.grid[c][r];
        const count = info.neighbors.length;
        const newVal = cell.v * Math.pow(2, count);
        cell.v = newVal;
        if (newVal > MAX_VALUE) removed.add(key(c, r)); // 超上限目标一并销毁（与源码一致）
        state.score += newVal;
        state.diamonds += Math.floor(Math.log2(newVal) / 5);
        if (newVal > state.bestValue) state.bestValue = newVal;
        if (newVal > state.milestone) { state.milestone = newVal; emit({ type: 'milestone', value: newVal }); }
        emit({ type: 'merge', c, r, value: newVal });
        // 紧邻目标块的岩石被震碎（原创「岩石」机制）
        for (const [nc, nr] of neighborsOf(c, r)) {
          if (state.grid[nc][nr].v === 0) {
            const rk = key(nc, nr);
            if (!removed.has(rk)) {
              removed.add(rk);
              state.rocksCleared += 1;
              state.score += ROCK_SCORE;
              emit({ type: 'rockClear', c: nc, r: nr });
            }
          }
        }
        for (const [nc, nr] of info.neighbors) removed.add(key(nc, nr));
      }
      if (waves >= 2) {
        const bonus = (waves - 1) * COMBO_STEP;
        state.score += bonus;
        lastCombo = waves;
        if (waves > state.maxCombo) state.maxCombo = waves;
        emit({ type: 'combo', chain: waves, bonus });
      }
      // 移除合并/震碎的方块，余块自然下沉（重力）
      for (let c = 0; c < COLS; c += 1) {
        state.grid[c] = state.grid[c].filter((_, r) => !removed.has(key(c, r)));
      }
    }
    state.combo = lastCombo;
    return waves;
  }

  function spawnRock() {
    const candidates = [];
    for (let c = 0; c < COLS; c += 1) if (state.grid[c].length < ROWS) candidates.push(c);
    if (!candidates.length) return false;
    const c = candidates[Math.floor(rng() * candidates.length)];
    state.grid[c].push({ v: 0 });
    emit({ type: 'rockSpawn', c, r: state.grid[c].length - 1 });
    return true;
  }

  const run = {
    state,

    place(col) {
      if (state.phase !== 'playing') return { ok: false, reason: 'phase' };
      if (state.busy > 0) return { ok: false, reason: 'busy' };
      if (!Number.isInteger(col) || col < 0 || col >= COLS) return { ok: false, reason: 'bounds' };
      if (state.grid[col].length >= ROWS) {
        state.phase = 'lost';
        emit({ type: 'lose', reason: 'full', score: state.score, bestValue: state.bestValue });
        return { ok: false, reason: 'full' };
      }
      const v = state.nextValue;
      state.grid[col].push({ v });
      state.placements += 1;
      state.nextValue = rollNext();
      state.pendingCol = col;
      state.busy = DROP_TIME;
      state.rockCountdown -= 1;
      if (state.rockCountdown <= 0) {
        state.rockPending = true;
        state.rockCountdown = lv.rockEvery > 0 ? lv.rockEvery : Infinity;
      }
      emit({ type: 'place', col, value: v });
      return { ok: true, col, value: v };
    },

    bomb(col) {
      if (state.phase !== 'playing') return { ok: false, reason: 'phase' };
      if (state.busy > 0) return { ok: false, reason: 'busy' };
      if (!Number.isInteger(col) || col < 0 || col >= COLS) return { ok: false, reason: 'bounds' };
      if (state.grid[col].length === 0) return { ok: false, reason: 'empty' };
      if (state.diamonds < BOMB_COST) return { ok: false, reason: 'noDiamonds' };
      state.diamonds -= BOMB_COST;
      const removed = state.grid[col].shift();
      emit({ type: 'bomb', col, value: removed.v });
      return { ok: true, col };
    },

    step(dt) {
      if (state.phase !== 'playing') return;
      state.time += dt;
      if (state.busy > 0) {
        state.busy -= dt;
        if (state.busy <= 0) {
          state.busy = 0;
          if (state.pendingCol != null) {
            state.pendingCol = null;
            const waves = resolve();
            if (waves > 0) state.busy = waves * MERGE_TIME;
            if (state.phase === 'playing' && state.rockPending) {
              state.rockPending = false;
              spawnRock();
            }
            if (state.phase === 'playing') checkWin();
          }
        }
      }
    },

    drainEvents() {
      return events.splice(0);
    },

    getHud() {
      return {
        level: state.level,
        target: state.target,
        score: state.score,
        diamonds: state.diamonds,
        nextValue: state.nextValue,
        bestValue: state.bestValue,
        combo: state.combo,
        maxCombo: state.maxCombo,
        rocksCleared: state.rocksCleared,
        stars: state.stars,
        phase: state.phase,
        time: state.time,
      };
    },
  };

  return run;
}
