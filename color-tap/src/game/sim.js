// 纯逻辑：数字填色（选色 → 点格上色 → 完成）。
// 不碰 DOM / window / localStorage / Date.now。
import { PICTURES } from '../../config/pictures.js';
import { RULES } from '../../config/game.config.js';

export function createRun({ pictureIndex = 0 } = {}) {
  const pic = PICTURES[pictureIndex];
  const grid = pic.rows.map((row) => [...row].map(Number));
  const size = grid.length;
  const filled = grid.map((row) => row.map(() => false));
  const remaining = {};
  let totalCells = 0;
  for (const row of grid) {
    for (const v of row) {
      if (v > 0) {
        remaining[v] = (remaining[v] || 0) + 1;
        totalCells += 1;
      }
    }
  }
  const colors = Object.keys(remaining).map(Number).sort((a, b) => a - b);
  return {
    pictureIndex,
    name: pic.name,
    size,
    grid,
    filled,
    remaining,
    colors,
    selectedColor: colors[0],
    totalCells,
    filledCount: 0,
    hintsUsed: 0,
    phase: 'playing',
    events: [],
  };
}

export function selectColor(run, color) {
  if (run.colors.includes(color)) run.selectedColor = color;
}

export function tapCell(run, r, c) {
  if (run.phase !== 'playing') return { ok: false };
  if (r < 0 || r >= run.size || c < 0 || c >= run.size) return { ok: false };
  const v = run.grid[r][c];
  if (v === 0 || run.filled[r][c]) return { ok: false, kind: 'noop' };
  if (v !== run.selectedColor) {
    run.events.push({ type: 'wrong', r, c, need: v });
    return { ok: false, kind: 'wrong', need: v };
  }
  run.filled[r][c] = true;
  run.remaining[v] -= 1;
  run.filledCount += 1;
  run.events.push({ type: 'fill', r, c, color: v });
  // 当前颜色填完 → 自动切到下一个未完成颜色
  if (run.remaining[v] === 0) {
    const next = run.colors.find((col) => run.remaining[col] > 0);
    if (next != null) run.selectedColor = next;
  }
  let complete = false;
  if (run.filledCount >= run.totalCells) {
    run.phase = 'complete';
    complete = true;
    run.events.push({ type: 'complete', pictureIndex: run.pictureIndex });
  }
  return { ok: true, kind: 'fill', complete };
}

export function useHint(run) {
  if (run.phase !== 'playing' || run.hintsUsed >= RULES.hintLimit) return null;
  // 优先填当前颜色的一个格
  let target = null;
  for (let r = 0; r < run.size && !target; r += 1) {
    for (let c = 0; c < run.size && !target; c += 1) {
      if (run.grid[r][c] === run.selectedColor && !run.filled[r][c]) target = { r, c };
    }
  }
  if (!target) {
    for (let r = 0; r < run.size && !target; r += 1) {
      for (let c = 0; c < run.size && !target; c += 1) {
        if (run.grid[r][c] > 0 && !run.filled[r][c]) target = { r, c };
      }
    }
  }
  if (!target) return null;
  run.hintsUsed += 1;
  run.selectedColor = run.grid[target.r][target.c];
  tapCell(run, target.r, target.c);
  return target;
}

export function getHud(run) {
  return {
    pictureIndex: run.pictureIndex,
    name: run.name,
    filledCount: run.filledCount,
    totalCells: run.totalCells,
    selectedColor: run.selectedColor,
    remaining: { ...run.remaining },
    hintsLeft: RULES.hintLimit - run.hintsUsed,
    phase: run.phase,
    colors: run.colors,
  };
}

export function drainEvents(run) {
  const out = run.events;
  run.events = [];
  return out;
}

export const PICTURE_COUNT = PICTURES.length;