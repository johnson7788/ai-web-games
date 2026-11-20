// config/levels.js — 场景（3 章）/ 波次（12 波）/ 地图生成（Lead 所有）。
// 三场景包：旷野（土黄）/ 雪原（蓝白）/ 熔城（暗红）；换章必换构图与敌配比。
import { MAP, CELL } from './gameplay.js';

// 三场景定义：色板键 + 构图参数（buildMap 用）
export const SCENES = [
  { index: 1, key: 'wastes',   nameKey: 'scene.wastes',   palette: 'wastes' },
  { index: 2, key: 'snowfield', nameKey: 'scene.snowfield', palette: 'snowfield' },
  { index: 3, key: 'molten',   nameKey: 'scene.molten',   palette: 'molten' },
];

// 12 波：每场景 4 波，敌配比递进。enemies 列表会被展平为按序生成队列。
export const WAVES = [
  // —— 旷野（教：砖墙/熔炉/主炮）——
  { wave: 1, scene: 1, spawnInterval: 2.2, maxConcurrent: 3,
    enemies: [{ type: 'normal', count: 5 }, { type: 'fast', count: 1 }] },
  { wave: 2, scene: 1, spawnInterval: 2.0, maxConcurrent: 4,
    enemies: [{ type: 'normal', count: 6 }, { type: 'fast', count: 2 }] },
  { wave: 3, scene: 1, spawnInterval: 1.8, maxConcurrent: 4,
    enemies: [{ type: 'normal', count: 5 }, { type: 'fast', count: 3 }] },
  { wave: 4, scene: 1, spawnInterval: 1.6, maxConcurrent: 4,
    enemies: [{ type: 'normal', count: 6 }, { type: 'fast', count: 4 }, { type: 'armored', count: 1 }] },
  // —— 雪原（练：重炮弹破钢墙）——
  { wave: 5, scene: 2, spawnInterval: 1.6, maxConcurrent: 5,
    enemies: [{ type: 'normal', count: 5 }, { type: 'fast', count: 6 }] },
  { wave: 6, scene: 2, spawnInterval: 1.5, maxConcurrent: 5,
    enemies: [{ type: 'normal', count: 4 }, { type: 'fast', count: 6 }, { type: 'armored', count: 2 }] },
  { wave: 7, scene: 2, spawnInterval: 1.4, maxConcurrent: 5,
    enemies: [{ type: 'fast', count: 6 }, { type: 'armored', count: 4 }] },
  { wave: 8, scene: 2, spawnInterval: 1.3, maxConcurrent: 6,
    enemies: [{ type: 'fast', count: 4 }, { type: 'armored', count: 6 }, { type: 'prop', count: 1 }] },
  // —— 熔城（变：高密度重甲 + 道具）——
  { wave: 9, scene: 3, spawnInterval: 1.3, maxConcurrent: 6,
    enemies: [{ type: 'fast', count: 6 }, { type: 'armored', count: 6 }] },
  { wave: 10, scene: 3, spawnInterval: 1.2, maxConcurrent: 6,
    enemies: [{ type: 'fast', count: 4 }, { type: 'armored', count: 8 }, { type: 'prop', count: 1 }] },
  { wave: 11, scene: 3, spawnInterval: 1.1, maxConcurrent: 7,
    enemies: [{ type: 'fast', count: 2 }, { type: 'armored', count: 8 }, { type: 'prop', count: 2 }] },
  // —— 收：终波（重甲潮 + 道具）——
  { wave: 12, scene: 3, spawnInterval: 1.0, maxConcurrent: 7,
    enemies: [{ type: 'fast', count: 3 }, { type: 'armored', count: 8 }, { type: 'prop', count: 2 }] },
];

export function waveByIdx(idx) {
  return WAVES[idx] || WAVES[WAVES.length - 1];
}

export function sceneOfWave(wave) {
  const w = WAVES.find((x) => x.wave === wave);
  return w ? w.scene : 1;
}

// ---------------------------------------------------------------------------
// 地图生成：26×26 半格（row 0 = 底部，y=0）。返回二维数组 grid[row][col]。
// 构图按场景不同（换章必换构图）：旷野=散落砖堆+钢柱；雪原=开阔水道+钢排；熔城=密集砖阵+熔岩河。
// ---------------------------------------------------------------------------
function lcg(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function emptyGrid() {
  return Array.from({ length: MAP.ROWS }, () => new Array(MAP.COLS).fill(CELL.EMPTY));
}

// 保留区不可放障碍：出生点/熔炉围栏/敌人生成点
const RESERVED = new Set();
function markReserved(row, col) {
  RESERVED.add(`${row},${col}`);
}
// 熔炉 + 围栏区（row 0..2, col 11..14）、玩家出生（row 0..1, col 8..10）、敌生成（row 24..25, col 0..2/12..14/24..25）
function seedReserved() {
  RESERVED.clear();
  for (let r = 0; r <= 2; r++) for (let c = 11; c <= 14; c++) markReserved(r, c);
  for (let r = 0; r <= 1; r++) for (let c = 8; c <= 10; c++) markReserved(r, c);
  // 玩家出生点上方垂直走廊全空：保证能绕出熔炉口袋
  for (let r = 0; r < MAP.ROWS; r++) for (let c = 8; c <= 10; c++) markReserved(r, c);
  // 顶部整 3 行留空：敌人生成与下行通道
  for (let r = 23; r <= 25; r++) for (let c = 0; c < MAP.COLS; c++) markReserved(r, c);
  // 生成点下方垂直通道留空，避免敌人被砖堵在顶角
  for (let r = 19; r <= 22; r++) for (const c of [0, 1, 2, 12, 13, 14, 24, 25]) markReserved(r, c);
}

function canPlace(r, c) {
  if (r < 0 || c < 0 || r >= MAP.ROWS || c >= MAP.COLS) return false;
  return !RESERVED.has(`${r},${c}`);
}

function fillRect(grid, r0, c0, h, w, cell) {
  for (let r = r0; r < r0 + h; r++) for (let c = c0; c < c0 + w; c++) {
    if (r < 0 || c < 0 || r >= MAP.ROWS || c >= MAP.COLS) continue;
    if (RESERVED.has(`${r},${c}`)) continue;
    grid[r][c] = cell;
  }
}

function scatter(grid, rng, cell, count, w, h) {
  let placed = 0;
  let guard = 0;
  while (placed < count && guard < 500) {
    guard++;
    const r = 1 + Math.floor(rng() * (MAP.ROWS - 2 - h));
    const c = 1 + Math.floor(rng() * (MAP.COLS - 2 - w));
    let ok = true;
    for (let rr = r; rr < r + h; rr++) for (let cc = c; cc < c + w; cc++) {
      if (!canPlace(rr, cc)) { ok = false; break; }
    }
    if (!ok) continue;
    fillRect(grid, r, c, h, w, cell);
    placed++;
  }
}

export function buildMap(sceneIndex) {
  seedReserved();
  const grid = emptyGrid();
  const rng = lcg(1234 + sceneIndex * 777);

  // 结构化地图：留出「竖直车道 + 中间横带」的清晰通道，障碍只落在区块内，
  // 避免敌我双方被钢墙/水面困死在角落。三场景换密度与构图。
  const isLane = (r, c) => {
    if (r >= 23) return true;                 // 顶部 3 行（敌生成/下行）
    if (c >= 8 && c <= 10) return true;       // 玩家出生走廊
    if (c <= 2 || (c >= 12 && c <= 14) || c >= 24) return true; // 敌生成三列车道
    if (r >= 9 && r <= 14) return true;       // 中间横带（横向机动）
    if (r <= 2 && c >= 11 && c <= 14) return true; // 熔炉区（围栏由 resetGrid 补）
    return false;
  };

  const density = [0.5, 0.6, 0.7][sceneIndex - 1] ?? 0.5;
  for (let r = 0; r < MAP.ROWS; r += 1) {
    for (let c = 0; c < MAP.COLS; c += 1) {
      if (isLane(r, c)) continue;
      if (rng() < density) grid[r][c] = CELL.BRICK;
    }
  }

  // 钢柱（少量，落在砖块间的空位）
  const steelCount = [3, 5, 7][sceneIndex - 1] ?? 3;
  let steelPlaced = 0;
  let guard = 0;
  while (steelPlaced < steelCount && guard < 400) {
    guard += 1;
    const r = 3 + Math.floor(rng() * 19);
    const c = 3 + Math.floor(rng() * 20);
    if (isLane(r, c)) continue;
    if (grid[r][c] !== CELL.EMPTY) continue;
    grid[r][c] = CELL.STEEL;
    steelPlaced += 1;
  }

  // 水塘（2×2，落角落区块，不堵主通道）
  const waterCount = [1, 2, 3][sceneIndex - 1] ?? 1;
  let waterPlaced = 0;
  guard = 0;
  while (waterPlaced < waterCount && guard < 400) {
    guard += 1;
    const r = 3 + Math.floor(rng() * 16);
    const c = 3 + Math.floor(rng() * 18);
    let ok = true;
    for (let rr = r; rr < r + 2; rr += 1) for (let cc = c; cc < c + 2; cc += 1) {
      if (isLane(rr, cc) || grid[rr][cc] !== CELL.EMPTY) { ok = false; break; }
    }
    if (!ok) continue;
    for (let rr = r; rr < r + 2; rr += 1) for (let cc = c; cc < c + 2; cc += 1) grid[rr][cc] = CELL.WATER;
    waterPlaced += 1;
  }

  // 草丛（可通行装饰，落在车道边）
  scatter(grid, rng, CELL.GRASS, 6 + sceneIndex * 2, 1, 1);

  return grid;
}
