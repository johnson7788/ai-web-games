// Deterministic map generation for each stage.
// Uses seed + stage config to produce identical maps for the same seed.
import { WORLD } from '../../config/game.config.js';
import { mulberry32, rngInt } from './rng.js';

const TILE = WORLD.TILE;
const COLS = WORLD.COLS;

function idx(cols, x, y) { return y * cols + x; }

function fillRect(solid, cols, x0, y0, w, h, v) {
  for (let y = y0; y < y0 + h; y++) {
    for (let x = x0; x < x0 + w; x++) {
      if (x >= 0 && x < cols && y >= 0 && y < solid.length / cols) {
        solid[idx(cols, x, y)] = v;
      }
    }
  }
}

function clearRect(solid, cols, x0, y0, w, h) {
  fillRect(solid, cols, x0, y0, w, h, 0);
}

export function generateMap(stage) {
  const rows = stage.rows;
  const levelH = rows * TILE;
  const solid = new Uint8Array(rows * COLS);
  const sand = new Uint8Array(rows * COLS);
  const rng = mulberry32(stage.seed);

  // 1. Borders (solid=1)
  for (let x = 0; x < COLS; x++) {
    solid[idx(COLS, x, 0)] = 1;
    solid[idx(COLS, x, rows - 1)] = 1;
  }
  for (let y = 0; y < rows; y++) {
    solid[idx(COLS, 0, y)] = 1;
    solid[idx(COLS, COLS - 1, y)] = 1;
  }

  // 2. Generate corridor center path (random walk from bottom to top)
  const corridorCenter = new Int32Array(rows);
  let cx = Math.floor(COLS / 2);
  const corridorWidth = 7;
  for (let y = rows - 1; y >= 0; y--) {
    corridorCenter[y] = cx;
    if (rng() < 0.15 && cx > 4) cx -= 1;
    else if (rng() < 0.15 && cx < COLS - 5) cx += 1;
  }

  // 3. Place water bands FIRST (they'll be overwritten by corridor later)
  const numBands = rngInt(rng, 4, 6);
  const bandSpacing = Math.floor((rows - 10) / numBands);
  for (let b = 0; b < numBands; b++) {
    const bandRow = rows - 8 - b * bandSpacing;
    if (bandRow < 4) break;
    const bandHeight = rngInt(rng, 1, 2);
    for (let dy = 0; dy < bandHeight; dy++) {
      const y = bandRow + dy;
      if (y <= 0 || y >= rows - 1) continue;
      for (let x = 1; x < COLS - 1; x++) {
        solid[idx(COLS, x, y)] = 2; // water
      }
    }
  }

  // 4. Place rock clusters (will be overwritten by corridor)
  for (let y = 2; y < rows - 2; y += 3) {
    for (let x = 2; x < COLS - 2; x += 4) {
      if (rng() < 0.35) {
        const rw = rngInt(rng, 1, 2);
        const rh = rngInt(rng, 1, 2);
        fillRect(solid, COLS, x, y, rw, rh, 1);
      }
    }
  }

  // 5. Carve corridor LAST — this guarantees a clear path from bottom to top
  for (let y = 1; y < rows - 1; y++) {
    const left = Math.max(1, corridorCenter[y] - Math.floor(corridorWidth / 2));
    const right = Math.min(COLS - 1, left + corridorWidth);
    for (let x = left; x < right; x++) {
      solid[idx(COLS, x, y)] = 0;
    }
  }

  // 6. Place sandbags (solid=3) near camps, outside corridor
  const campRows = (stage.camps || []).map(c => c.row);
  for (const campRow of campRows) {
    for (let dy = -2; dy <= 2; dy++) {
      const y = campRow + dy;
      if (y <= 0 || y >= rows - 1) continue;
      for (let x = 1; x < COLS - 1; x++) {
        const distFromCorridor = Math.abs(x - corridorCenter[y]);
        if (distFromCorridor < Math.floor(corridorWidth / 2) + 1) continue;
        if (solid[idx(COLS, x, y)] === 0 && rng() < 0.3) {
          solid[idx(COLS, x, y)] = 3;
          sand[idx(COLS, x, y)] = 3;
        }
      }
    }
  }

  // 7. Clear areas around camps and helipads
  for (const zone of [...(stage.camps || []), ...(stage.helipads || [])]) {
    const row = zone.row;
    for (let dy = -1; dy <= 1; dy++) {
      const y = row + dy;
      if (y <= 0 || y >= rows - 1) continue;
      for (let x = 2; x < COLS - 2; x++) {
        solid[idx(COLS, x, y)] = 0;
        sand[idx(COLS, x, y)] = 0;
      }
    }
  }

  // 8. Clear birth point area (don't touch border at rows-1)
  const birthX = Math.floor(WORLD.W / 2 / TILE);
  const birthY = rows - 2;
  clearRect(solid, COLS, birthX - 2, birthY - 1, 5, 2);

  // 9. Clear top area (for boss arena / stage exit)
  clearRect(solid, COLS, 3, 1, COLS - 6, 3);

  return { cols: COLS, rows, tile: TILE, levelH, solid, sand, seed: stage.seed };
}

export function isWalkable(map, x, y) {
  if (x < 0 || y < 0 || x >= WORLD.W || y >= map.levelH) return false;
  const tx = Math.floor(x / map.tile);
  const ty = Math.floor(y / map.tile);
  if (tx < 0 || tx >= map.cols || ty < 0 || ty >= map.rows) return false;
  // 只有 0（地面/道路）可通行；1 岩壁 / 2 水 / 3 沙袋 全部阻挡载具
  return map.solid[idx(map.cols, tx, ty)] === 0;
}

export function isSolid(map, x, y) {
  if (x < 0 || y < 0 || x >= WORLD.W || y >= map.levelH) return true;
  const tx = Math.floor(x / map.tile);
  const ty = Math.floor(y / map.tile);
  if (tx < 0 || tx >= map.cols || ty < 0 || ty >= map.rows) return true;
  return map.solid[idx(map.cols, tx, ty)] >= 1;
}

export function isWater(map, x, y) {
  if (x < 0 || y < 0 || x >= WORLD.W || y >= map.levelH) return true;
  const tx = Math.floor(x / map.tile);
  const ty = Math.floor(y / map.tile);
  if (tx < 0 || tx >= map.cols || ty < 0 || ty >= map.rows) return true;
  return map.solid[idx(map.cols, tx, ty)] === 2;
}

export function findWalkableInRect(map, x0, y0, w, h, rng) {
  const attempts = 20;
  for (let i = 0; i < attempts; i++) {
    const x = x0 + rng() * w;
    const y = y0 + rng() * h;
    if (isWalkable(map, x, y)) return { x, y };
  }
  return { x: x0 + w / 2, y: y0 + h / 2 };
}

export function destroySandbag(map, tx, ty) {
  if (tx >= 0 && tx < map.cols && ty >= 0 && ty < map.rows) {
    const i = idx(map.cols, tx, ty);
    if (map.solid[i] === 3) {
      map.solid[i] = 0;
      map.sand[i] = 0;
    }
  }
}
