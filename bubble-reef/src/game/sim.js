// src/game/sim.js — 纯逻辑模拟：瞄准发射、六边形弹道（左右壁反弹）、同色 ≥3 连通消除、
// 悬空集群掉落、顶棚每 N 发下沉、触底判负、清除率通关、百搭泡、潮汐瞄准线。
// 不碰 DOM / window / localStorage / Date.now；随机走 seed。
import { LEVELS, levelAt } from '../../config/levels.js';
import {
  MAX_AIM, SHOOTER, SHOT_SPEED, DEATH_Y, TOP_Y, BUBBLE_R, BUBBLE_DIAM, WORLD, WILDCARD_COMBO, PREVIEWS_PER_LEVEL,
  colsInRow, parityOf, neighborsOf, rowColToPos,
} from '../../config/gameplay.js';
import { mulberry32, rngInt } from './rng.js';
import {
  matchCluster, floatingCells, snapToCell, countBubbles, anyTouchingDeathLine,
} from './grid.js';

const STEP = 1 / 60;
const CLEAR_TICKS = 60;                 // 过关横幅停留 1 秒
const MATCH_SCORE = 10;                 // 每个消去的泡泡基础分
const DROP_SCORE = 20;                  // 每个掉落泡泡额外分（signature：整簇悬空掉落）
const COMBO_BONUS = 5;                  // 每连击额外分
const WILDCARD_MULT = 2;                // 百搭泡消除得分倍率

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

export function createRun({ seed = 1, levelIndex = 0 } = {}) {
  const rng = mulberry32(seed >>> 0);

  const run = {
    seed: seed >>> 0,
    rng,
    phase: 'playing',   // playing | cleared | dead | won
    levelIndex,         // 0-based
    level: levelAt(levelIndex + 1),
    grid: [],
    parities: [],
    aimAngle: 0,
    flying: null,       // 飞行中的泡泡
    current: null,      // 炮管内待发射的泡泡
    shotsFired: 0,
    score: 0,
    combo: 0,
    bestCombo: 0,
    clearedTotal: 0,
    goldRemaining: 0,
    previewsLeft: PREVIEWS_PER_LEVEL,
    previewActive: false,
    events: [],
    time: 0,
    clearTimer: 0,
    stats: { levelsReached: 1, bubblesCleared: 0, maxCombo: 0, score: 0 },
  };

  function emit(type, payload = {}) {
    run.events.push({ type, t: run.time, ...payload });
  }

  function loadNextBubble() {
    return { c: rngInt(rng, 1, run.level.colors), wildcard: false, gold: false };
  }

  function loadLevel() {
    const L = levelAt(run.levelIndex + 1);
    run.level = L;
    run.grid = [];
    run.parities = [];
    for (let r = 0; r < L.rows; r += 1) {
      run.parities[r] = r % 2;
      run.grid[r] = [];
      for (let c = 0; c < colsInRow(r % 2); c += 1) {
        run.grid[r][c] = { c: rngInt(rng, 1, L.colors), gold: false, wildcard: false };
      }
    }
    // 岩礁障碍泡：不可消，只能靠掉落清除（不放在顶行，保证顶行始终是连接起点）
    for (let k = 0; k < L.rocks; k += 1) {
      const r = rngInt(rng, 1, Math.max(1, L.rows - 1));
      const c = rngInt(rng, 0, colsInRow(run.parities[r]) - 1);
      run.grid[r][c] = { c: 0, gold: false, wildcard: false };
    }
    // 金泡：通关必须清光
    let placedGold = 0;
    let guard = 0;
    while (placedGold < L.gold && guard < 200) {
      guard += 1;
      const r = rngInt(rng, 1, L.rows - 1);
      const c = rngInt(rng, 0, colsInRow(run.parities[r]) - 1);
      const cell = run.grid[r] && run.grid[r][c];
      if (cell && cell.c > 0 && !cell.gold) {
        cell.gold = true;
        placedGold += 1;
      }
    }
    run.goldRemaining = placedGold;
    run.clearedTotal = 0;
    run.shotsFired = 0;
    run.combo = 0;
    run.previewActive = false;
    run.flying = null;
    run.current = loadNextBubble();
    run.clearTimer = 0;
    run.phase = 'playing';
  }

  function sink() {
    const rows = run.level.doubleCeil ? 2 : 1;
    for (let k = 0; k < rows; k += 1) {
      const newParity = run.parities.length ? (run.parities[0] + 1) % 2 : 0;
      const ncols = colsInRow(newParity);
      const newRow = [];
      for (let c = 0; c < ncols; c += 1) {
        newRow.push({ c: rngInt(rng, 1, run.level.colors), gold: false, wildcard: false });
      }
      run.grid.unshift(newRow);
      run.parities.unshift(newParity);
    }
    emit('sink', { rows });
    // 下沉把泡泡推到触底线即判负（不等到下一发）
    if (anyTouchingDeathLine(run.grid, DEATH_Y)) die();
  }

  function resolveWildcardColor(r, c) {
    const counts = new Map();
    for (const [dr, dc] of neighborsOf(parityOf(run.parities, r))) {
      const cell = run.grid[r + dr] && run.grid[r + dr][c + dc];
      if (cell && cell.c > 0) counts.set(cell.c, (counts.get(cell.c) || 0) + 1);
    }
    if (counts.size) return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
    return rngInt(rng, 1, run.level.colors);
  }

  function die() {
    run.phase = 'dead';
    emit('death', { level: run.level.index });
  }

  function afterShot() {
    if (anyTouchingDeathLine(run.grid, DEATH_Y)) { die(); return; }

    const totalGenerated = run.clearedTotal + countBubbles(run.grid);
    const clearance = totalGenerated > 0 ? run.clearedTotal / totalGenerated : 0;
    if (clearance >= run.level.clearance && run.goldRemaining <= 0) {
      run.phase = 'cleared';
      run.clearTimer = CLEAR_TICKS;
      run.stats.levelsReached = Math.max(run.stats.levelsReached, run.level.index);
      emit('levelClear', { level: run.level.index, clearance });
      return;
    }

    if (run.shotsFired > 0 && run.shotsFired % run.level.shotsToSink === 0) {
      sink();   // sink 内部会判负
    }
  }

  function land(x, y) {
    const cell = snapToCell(run.grid, run.parities, x, y);
    if (!cell) { run.flying = null; emit('miss'); return; }
    const { row, col } = cell;
    while (run.grid.length <= row) { run.grid.push([]); run.parities.push(run.parities.length % 2); }
    while (run.grid[row].length <= col) run.grid[row].push(null);
    const wasWildcard = !!run.flying.wildcard;
    const color = wasWildcard ? resolveWildcardColor(row, col) : run.flying.c;
    run.grid[row][col] = { c: color, gold: false, wildcard: wasWildcard };
    run.flying = null;
    emit('land', { row, col, color, wildcard: wasWildcard });

    const cluster = matchCluster(run.grid, run.parities, row, col);
    if (cluster.length >= 3) {
      let removedGold = 0;
      for (const { row: r, col: c } of cluster) {
        const cellAt = run.grid[r][c];
        if (cellAt.gold) { run.goldRemaining -= 1; removedGold += 1; }
        run.grid[r][c] = null;
      }
      const count = cluster.length;
      run.clearedTotal += count;
      run.combo += 1;
      run.bestCombo = Math.max(run.bestCombo, run.combo);
      run.stats.maxCombo = run.bestCombo;
      const pts = count * MATCH_SCORE + run.combo * COMBO_BONUS
        + (wasWildcard ? count * MATCH_SCORE * (WILDCARD_MULT - 1) : 0);
      run.score += pts;
      run.stats.score = run.score;
      run.stats.bubblesCleared += count;
      emit('match', { count, combo: run.combo, row, col, wildcard: wasWildcard });

      const floating = floatingCells(run.grid, run.parities);
      if (floating.length) {
        for (const { row: r, col: c } of floating) {
          const cellAt = run.grid[r][c];
          if (cellAt.gold) { run.goldRemaining -= 1; removedGold += 1; }
          run.grid[r][c] = null;
        }
        run.clearedTotal += floating.length;
        const dropPts = floating.length * DROP_SCORE;
        run.score += dropPts;
        run.stats.score = run.score;
        run.stats.bubblesCleared += floating.length;
        emit('drop', { count: floating.length, row, col });
      }
      if (removedGold > 0) emit('gold', { count: removedGold });
    } else if (run.combo > 0) {
      run.combo = 0;
      emit('comboBreak');
    }
    afterShot();
  }

  function moveFlying() {
    const f = run.flying;
    if (run.level.drift) f.vx += run.level.drift * STEP;
    f.x += f.vx * STEP;
    f.y += f.vy * STEP;
    if (f.x < BUBBLE_R) { f.x = BUBBLE_R; f.vx = Math.abs(f.vx); emit('bounce', { x: f.x, y: f.y }); }
    else if (f.x > WORLD.WIDTH - BUBBLE_R) { f.x = WORLD.WIDTH - BUBBLE_R; f.vx = -Math.abs(f.vx); emit('bounce', { x: f.x, y: f.y }); }
    if (f.y <= TOP_Y + BUBBLE_R) { land(f.x, f.y); return; }
    for (let r = 0; r < run.grid.length; r += 1) {
      const row = run.grid[r];
      if (!row) continue;
      const pr = parityOf(run.parities, r);
      for (let c = 0; c < row.length; c += 1) {
        if (!row[c]) continue;
        const p = rowColToPos(pr, r, c);
        const ddx = f.x - p.x;
        const ddy = f.y - p.y;
        if (ddx * ddx + ddy * ddy <= BUBBLE_DIAM * BUBBLE_DIAM) { land(f.x, f.y); return; }
      }
    }
  }

  function fireShot() {
    if (run.flying) return;
    if (!run.current) run.current = loadNextBubble();
    run.flying = {
      x: SHOOTER.x,
      y: SHOOTER.y,
      vx: Math.sin(run.aimAngle) * SHOT_SPEED,
      vy: -Math.cos(run.aimAngle) * SHOT_SPEED,
      c: run.current.c,
      wildcard: run.current.wildcard,
      gold: false,
    };
    run.current = loadNextBubble();
    run.shotsFired += 1;
    emit('shot', { angle: run.aimAngle, color: run.flying.c, wildcard: run.flying.wildcard });
  }

  function advance() {
    if (run.levelIndex + 1 >= LEVELS.length) {
      run.phase = 'won';
      run.stats.levelsReached = LEVELS.length;
      emit('won', { level: LEVELS.length });
      return;
    }
    run.levelIndex += 1;
    loadLevel();
  }

  run.loadLevel = loadLevel;
  run.sink = sink;
  loadLevel();

  run.step = function step(input = {}) {
    if (run.phase === 'cleared') {
      run.clearTimer -= 1;
      run.time += STEP;
      if (run.clearTimer <= 0) advance();
      return;
    }
    if (run.phase !== 'playing') return;

    if (typeof input.angle === 'number') {
      run.aimAngle = clamp(input.angle, -MAX_AIM, MAX_AIM);
    }

    if (input.useWildcard && run.combo >= WILDCARD_COMBO && run.current && !run.current.wildcard && !run.flying) {
      run.current = { c: 0, wildcard: true, gold: false };
      run.combo -= WILDCARD_COMBO;
      emit('wildcardArm');
    }

    if (input.usePreview && run.previewsLeft > 0 && !run.previewActive && !run.flying) {
      run.previewsLeft -= 1;
      run.previewActive = true;
      emit('preview');
    }

    if (input.shoot && !run.flying) {
      fireShot();
      if (run.previewActive) run.previewActive = false;
    }

    if (run.flying) moveFlying();

    run.time += STEP;
  };

  run.drainEvents = function drainEvents() {
    const out = run.events;
    run.events = [];
    return out;
  };

  run.getHud = function getHud() {
    const totalGenerated = run.clearedTotal + countBubbles(run.grid);
    return {
      score: run.score,
      level: run.level.index,
      combo: run.combo,
      bestCombo: run.bestCombo,
      clearance: totalGenerated > 0 ? run.clearedTotal / totalGenerated : 0,
      clearanceTarget: run.level.clearance,
      shotsToSink: run.level.shotsToSink,
      shotsSinceSink: run.shotsFired % run.level.shotsToSink,
      bubblesRemaining: countBubbles(run.grid),
      goldRemaining: run.goldRemaining,
      wildcardAvailable: run.combo >= WILDCARD_COMBO,
      wildcardLoaded: !!(run.current && run.current.wildcard),
      currentColor: run.current ? run.current.c : 1,
      previewsLeft: run.previewsLeft,
      previewActive: run.previewActive,
      colors: run.level.colors,
      pack: run.level.pack,
      levelFeature: run.level,
    };
  };

  return run;
}
