// src/game/sim.js — LIGHT GRID · 玩法核心（纯逻辑，零 DOM / 零 localStorage / 零 Date.now）。
// 契约：createRun({level,seed}) → run；run.step({press:[r,c]}) / run.press(r,c) / run.nextLevel() /
//       run.getHud() / run.drainEvents()。事件表见 docs/analysis.md。
import {
  STEP, allLit, litCount, toggleOffsets, cloneBoard, inBounds,
  PRESS_PATTERNS, TYPE_PATTERN, CAP_PATTERN,
} from '../../config/gameplay.js';
import { LEVELS } from '../../config/levels.js';

export function createRun({ level = 0, seed = 0 } = {}) {
  const idx = Math.max(0, Math.min(level, LEVELS.length - 1));
  const lvl = LEVELS[idx];
  const run = {
    seed: seed >>> 0,
    levelIndex: idx,
    N: lvl.size,
    chapter: lvl.chapter,
    board: cloneBoard(lvl.board),
    types: lvl.types.map((r) => r.slice()),
    charges: new Uint8Array(lvl.size * lvl.size),
    solution: lvl.solution.map((p) => [p[0], p[1]]),
    par: lvl.par,
    maxSteps: lvl.maxSteps,
    steps: 0,
    hintsUsed: 0,
    stars: 0,
    phase: 'playing', // playing | solved | dead | complete
    time: 0,
    events: [],
    stats: { levelsReached: lvl.index, levelsSolved: 0, totalSteps: 0, bestStars: 0 },
    _maxLit: litCount(lvl.board),
  };
  run.step = (input = {}) => step(run, input);
  run.press = (r, c) => pressCell(run, r, c);
  run.nextLevel = () => nextLevel(run);
  run.hint = () => useHint(run);
  run.getHud = () => getHud(run);
  run.drainEvents = () => drainEvents(run);
  emit(run, 'levelStart', { level: lvl.index, chapter: lvl.chapter });
  return run;
}

function step(run, input) {
  if (run.phase !== 'playing') return;
  run.time += STEP;
  const p = input.press;
  if (p && Array.isArray(p)) pressCell(run, p[0], p[1]);
}

function pressCell(run, r, c) {
  if (run.phase !== 'playing') return;
  if (!inBounds(run.N, r, c)) return;
  const type = run.types[r][c];
  if (type === 'insulator') {
    emit(run, 'blocked', { r, c });
    return;
  }
  if (type === 'capacitor') {
    const idx = r * run.N + c;
    if (!run.charges[idx]) {
      run.charges[idx] = 1;
      run.steps += 1;
      run.stats.totalSteps += 1;
      emit(run, 'charge', { r, c });
    } else {
      run.charges[idx] = 0;
      toggleOffsets(run.board, run.N, r, c, CAP_PATTERN);
      run.steps += 1;
      run.stats.totalSteps += 1;
      emit(run, 'press', { r, c, cellType: type });
    }
  } else {
    toggleOffsets(run.board, run.N, r, c, PRESS_PATTERNS[TYPE_PATTERN[type]]);
    run.steps += 1;
    run.stats.totalSteps += 1;
    emit(run, 'press', { r, c, cellType: type });
  }
  const lit = litCount(run.board);
  emit(run, 'toggle', { r, c, lit });
  if (lit > run._maxLit) {
    run._maxLit = lit;
    emit(run, 'milestone', { lit });
  }
  checkSolved(run);
}

function checkSolved(run) {
  if (allLit(run.board)) {
    run.phase = 'solved';
    run.stars = run.steps <= run.par ? 3 : run.steps <= run.par + 2 ? 2 : 1;
    run.stats.levelsSolved += 1;
    run.stats.bestStars = Math.max(run.stats.bestStars, run.stars);
    emit(run, 'solved', { level: run.levelIndex + 1, steps: run.steps, par: run.par, stars: run.stars });
    emit(run, 'signature', { level: run.levelIndex + 1 });
    return;
  }
  if (run.steps >= run.maxSteps) {
    run.phase = 'dead';
    emit(run, 'overload', { level: run.levelIndex + 1, steps: run.steps, maxSteps: run.maxSteps });
  }
}

/** 提示：亮出已知生成解中的一步（近似；真实解随盘面变化，但该格确属可行解）。 */
function useHint(run) {
  if (run.phase !== 'playing') return null;
  const idx = Math.min(run.hintsUsed, run.solution.length - 1);
  run.hintsUsed += 1;
  const [r, c] = run.solution[idx] || [0, 0];
  emit(run, 'hint', { r, c });
  return [r, c];
}

function nextLevel(run) {
  const next = run.levelIndex + 1;
  if (next >= LEVELS.length) {
    run.phase = 'complete';
    emit(run, 'complete', {});
    return false;
  }
  loadLevel(run, next);
  return true;
}

function loadLevel(run, levelIndex) {
  const lvl = LEVELS[levelIndex];
  run.levelIndex = levelIndex;
  run.N = lvl.size;
  run.chapter = lvl.chapter;
  run.board = cloneBoard(lvl.board);
  run.types = lvl.types.map((r) => r.slice());
  run.charges = new Uint8Array(lvl.size * lvl.size);
  run.solution = lvl.solution.map((p) => [p[0], p[1]]);
  run.par = lvl.par;
  run.maxSteps = lvl.maxSteps;
  run.steps = 0;
  run.hintsUsed = 0;
  run.stars = 0;
  run.phase = 'playing';
  run.stats.levelsReached = Math.max(run.stats.levelsReached, lvl.index);
  run._maxLit = litCount(lvl.board);
  emit(run, 'levelStart', { level: lvl.index, chapter: lvl.chapter });
}

function getHud(run) {
  const total = run.N * run.N;
  const lit = litCount(run.board);
  return {
    level: run.levelIndex + 1,
    chapter: run.chapter,
    N: run.N,
    steps: run.steps,
    par: run.par,
    maxSteps: run.maxSteps,
    remaining: Math.max(0, run.maxSteps - run.steps),
    lit,
    total,
    litPercent: total ? lit / total : 0,
    phase: run.phase,
    stars: run.stars,
    hintsUsed: run.hintsUsed,
  };
}

function emit(run, type, fields = {}) {
  run.events.push({ type, ...fields });
}

function drainEvents(run) {
  const ev = run.events;
  run.events = [];
  return ev;
}
