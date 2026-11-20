// src/game/sim.js — 星屑三消 · run 生命周期（纯逻辑，零 DOM）
// 契约：createRun({seed, startLevel}) → run { step, getHud, drainEvents, phase, grid, level, score }
// 事件名（与 audio/render/tutorial 一字不差）：
//   swap / invalidSwap / match / clearStar / specialCreate / specialBlast / novaBlast /
//   darkBreak / fall / refill / cascade / milestone / reshuffle / levelStart / levelClear / levelFail / win
import {
  BOARD, SCORE, GRAVITY, LENS, COMBO_WINDOW_SEC, clamp,
} from '../../config/gameplay.js';
import { levelAt, LEVEL_COUNT, SCENES } from '../../config/levels.js';
import { mulberry32, randInt } from './rng.js';
import * as B from './board.js';

function emit(run, type, fields = {}) {
  run.events.push({ type, ...fields });
}

function drainEvents(run) {
  const ev = run.events;
  run.events = [];
  return ev;
}

function darkCellsFor(level, rng) {
  const n = level.darkCount || 0;
  const cells = [];
  const used = new Set();
  for (let k = 0; k < n; k += 1) {
    for (let t = 0; t < 40; t += 1) {
      const r = randInt(rng, 0, BOARD.ROWS - 1);
      const c = randInt(rng, 0, BOARD.COLS - 1);
      const key = r * BOARD.COLS + c;
      if (!used.has(key)) { used.add(key); cells.push({ r, c }); break; }
    }
  }
  return cells;
}

function beginLevel(run, index, rng) {
  const level = levelAt(index);
  run.level = index;
  run.score = 0;
  run.moves = level.moves;
  run.movesMax = level.moves;
  run.target = level.target;
  run.lensLeft = LENS.CHARGES_PER_LEVEL;
  run.combo = 0;
  run.lastClearAt = -Infinity;
  run._lastMilestone = 0;
  run.gravity = level.feature === 'gravity' || level.feature === 'gravity+dark' ? GRAVITY.UP : GRAVITY.DOWN;
  const darkCells = level.darkCount ? darkCellsFor(level, rng) : [];
  const seeded = level.seeded || [];
  run.grid = B.createGrid(rng, {
    colors: level.colors,
    darkCells,
    seeded,
    gravity: run.gravity,
  });
  emit(run, 'levelStart', {
    level: index,
    target: level.target,
    moves: level.moves,
    scene: level.scene,
    sceneName: SCENES[level.scene].key,
    gravity: run.gravity,
  });
}

export function createRun({ seed = 0, startLevel = 1 } = {}) {
  const rng = mulberry32(seed);
  const run = {
    rng,
    seed: seed >>> 0,
    phase: 'playing',
    level: 0,
    score: 0,
    moves: 0,
    movesMax: 0,
    target: 0,
    lensLeft: 0,
    combo: 0,
    lastClearAt: -Infinity,
    gravity: GRAVITY.DOWN,
    grid: null,
    events: [],
    simTime: 0,
    _lastMilestone: 0,
    stats: { levelsReached: 1, maxScore: 0, specialsMade: 0, novasMade: 0, clears: 0 },
  };
  beginLevel(run, clamp(startLevel, 1, LEVEL_COUNT), rng);
  run.step = (input) => step(run, input);
  run.getHud = () => getHud(run);
  run.drainEvents = () => drainEvents(run);
  return run;
}

function addScore(run, amount) {
  run.score += amount;
  if (run.score > run.stats.maxScore) run.stats.maxScore = run.score;
  emit(run, 'score', { amount, total: run.score });
  const mile = Math.floor(run.score / SCORE.MILESTONE_EVERY);
  if (mile > run._lastMilestone) {
    run._lastMilestone = mile;
    emit(run, 'milestone', { score: run.score });
  }
}

function onClear(run, cleared, cascades) {
  run.stats.clears += 1;
  run.combo = (run.simTime - run.lastClearAt <= COMBO_WINDOW_SEC) ? run.combo + 1 : 1;
  run.lastClearAt = run.simTime;
  if (run.combo > 1) emit(run, 'comboUp', { combo: run.combo });
}

function ratingFor(run) {
  const ratio = run.moves / Math.max(1, run.movesMax);
  if (ratio >= 0.6) return 3;
  if (ratio >= 0.3) return 2;
  return 1;
}

function checkLevelEnd(run) {
  if (run.score >= run.target) {
    if (run.level >= LEVEL_COUNT) {
      run.phase = 'win';
      emit(run, 'win', { level: run.level, score: run.score });
    } else {
      const stars = ratingFor(run);
      emit(run, 'levelClear', { level: run.level, score: run.score, stars });
      beginLevel(run, run.level + 1, run.rng);
      if (run.level > run.stats.levelsReached) run.stats.levelsReached = run.level;
    }
    return;
  }
  if (run.moves <= 0) {
    run.phase = 'dead';
    emit(run, 'levelFail', { level: run.level, score: run.score, target: run.target });
  } else if (!B.hasValidMove(run.grid)) {
    B.shuffleGrid(run.rng, run.grid, levelAt(run.level).colors);
    emit(run, 'reshuffle', { level: run.level });
  }
}

function doSwap(run, a, b, costLens) {
  const level = levelAt(run.level);
  B.swapCells(run.grid, a, b);
  const matches = B.findAllMatches(run.grid);
  if (!matches.length) {
    B.swapCells(run.grid, a, b); // 换回
    emit(run, 'invalidSwap', { a, b });
    return false;
  }
  run.moves -= 1;
  if (costLens) run.lensLeft -= 1;
  emit(run, 'swap', { a, b });
  const res = B.resolveBoard(run.grid, (ev) => {
    if (ev.type === 'specialCreate') {
      run.stats.specialsMade += 1;
      if (ev.special === 'nova') run.stats.novasMade += 1;
    }
    emit(run, ev.type, ev);
  }, { rng: run.rng, colors: level.colors, gravity: run.gravity, swapCells: [a, b] });
  if (res.cleared > 0) {
    addScore(run, res.score);
    onClear(run, res.cleared, res.cascades);
  }
  checkLevelEnd(run);
  return true;
}

function step(run, input = {}) {
  if (run.phase !== 'playing') return;
  run.simTime += 1 / 60;
  if (run.combo > 0 && run.simTime - run.lastClearAt > COMBO_WINDOW_SEC) run.combo = 0;

  if (input.lens) {
    const { a, b } = input.lens;
    if (run.lensLeft <= 0) return;
    if (!B.inBounds(Math.floor(a / BOARD.COLS), a % BOARD.COLS) || !B.inBounds(Math.floor(b / BOARD.COLS), b % BOARD.COLS)) return;
    if (!B.isColored(run.grid[a]) || !B.isColored(run.grid[b])) return;
    emit(run, 'lens', { a, b });
    doSwap(run, a, b, true);
    return;
  }

  if (input.swap) {
    const { a, b } = input.swap;
    if (a == null || b == null) return;
    if (!B.areAdjacent(a, b)) { emit(run, 'invalidSwap', { a, b }); return; }
    if (!B.isColored(run.grid[a]) || !B.isColored(run.grid[b])) { emit(run, 'invalidSwap', { a, b }); return; }
    doSwap(run, a, b, false);
    return;
  }
}

function getHud(run) {
  const level = levelAt(run.level);
  return {
    level: run.level,
    score: run.score,
    target: run.target,
    moves: run.moves,
    movesMax: run.movesMax,
    lensLeft: run.lensLeft,
    combo: run.combo,
    scene: level.scene,
    sceneName: SCENES[level.scene].key,
    gravity: run.gravity,
    phase: run.phase,
  };
}
