// src/game/map.js — 三套场景网格 + 光线投射 DDA（纯逻辑，sim 与 render 共用）。
// 网格 24×24，'1' 墙 / '0' 空地；中心出生点 (12.5,12.5) 保持开阔。
import { ARENA } from '../../config/gameplay.js';

const GRID = ARENA.GRID;

// 每场景的墙矩形 {x,y,w,h}（格坐标，含端点）。
// 约定：中心 (12.5,12.5) 半径 ~6 保持开阔（玩家出生 + 敌人出生环都在此），墙都放在外圈。
const SCENE_RECTS = [
  // 场景 1 · 殖民巷（紫灰）：四角柱 + 四向短墙围中庭
  [
    { x: 2, y: 2, w: 4, h: 4 }, { x: 18, y: 2, w: 4, h: 4 },
    { x: 2, y: 18, w: 4, h: 4 }, { x: 18, y: 18, w: 4, h: 4 },
    { x: 12, y: 1, w: 1, h: 5 }, { x: 12, y: 18, w: 1, h: 5 },
    { x: 1, y: 12, w: 5, h: 1 }, { x: 18, y: 12, w: 5, h: 1 },
  ],
  // 场景 2 · 反应场（青绿）：四角大方块 + 十字臂 + 对角柱
  [
    { x: 2, y: 2, w: 3, h: 3 }, { x: 19, y: 2, w: 3, h: 3 },
    { x: 2, y: 19, w: 3, h: 3 }, { x: 19, y: 19, w: 3, h: 3 },
    { x: 10, y: 1, w: 4, h: 1 }, { x: 10, y: 22, w: 4, h: 1 },
    { x: 1, y: 10, w: 1, h: 4 }, { x: 22, y: 10, w: 1, h: 4 },
    { x: 6, y: 6, w: 1, h: 1 }, { x: 17, y: 6, w: 1, h: 1 },
    { x: 6, y: 17, w: 1, h: 1 }, { x: 17, y: 17, w: 1, h: 1 },
  ],
  // 场景 3 · 夜空港（深蓝）：四角块 + 环形柱群，中央开阔广场
  [
    { x: 4, y: 4, w: 2, h: 2 }, { x: 18, y: 4, w: 2, h: 2 },
    { x: 4, y: 18, w: 2, h: 2 }, { x: 18, y: 18, w: 2, h: 2 },
    { x: 8, y: 2, w: 1, h: 1 }, { x: 15, y: 2, w: 1, h: 1 },
    { x: 2, y: 8, w: 1, h: 1 }, { x: 21, y: 8, w: 1, h: 1 },
    { x: 2, y: 15, w: 1, h: 1 }, { x: 21, y: 15, w: 1, h: 1 },
    { x: 8, y: 21, w: 1, h: 1 }, { x: 15, y: 21, w: 1, h: 1 },
  ],
];

function buildGrid(rects) {
  const g = [];
  for (let y = 0; y < GRID; y += 1) {
    const row = new Array(GRID).fill(0);
    g.push(row);
  }
  for (let y = 0; y < GRID; y += 1) {
    for (let x = 0; x < GRID; x += 1) {
      if (x === 0 || y === 0 || x === GRID - 1 || y === GRID - 1) g[y][x] = 1;
    }
  }
  for (const r of rects) {
    for (let y = r.y; y < r.y + r.h; y += 1) {
      for (let x = r.x; x < r.x + r.w; x += 1) {
        if (x > 0 && y > 0 && x < GRID - 1 && y < GRID - 1) g[y][x] = 1;
      }
    }
  }
  return g;
}

export const MAPS = SCENE_RECTS.map(buildGrid);

export function isWall(grid, x, y) {
  const cx = Math.floor(x);
  const cy = Math.floor(y);
  if (cx < 0 || cy < 0 || cx >= GRID || cy >= GRID) return true;
  return grid[cy][cx] === 1;
}

/** DDA 光线投射：返回垂距 + 命中格 + 命中面（0=x 面，1=y 面）。 */
export function raycast(grid, px, py, dx, dy, maxDist = 64) {
  let mapX = Math.floor(px);
  let mapY = Math.floor(py);
  const deltaX = Math.abs(1 / (dx === 0 ? 1e-9 : dx));
  const deltaY = Math.abs(1 / (dy === 0 ? 1e-9 : dy));
  let stepX; let stepY; let sideDistX; let sideDistY;
  if (dx < 0) { stepX = -1; sideDistX = (px - mapX) * deltaX; }
  else { stepX = 1; sideDistX = (mapX + 1 - px) * deltaX; }
  if (dy < 0) { stepY = -1; sideDistY = (py - mapY) * deltaY; }
  else { stepY = 1; sideDistY = (mapY + 1 - py) * deltaY; }

  let side = 0;
  for (let i = 0; i < 256; i += 1) {
    if (sideDistX < sideDistY) { sideDistX += deltaX; mapX += stepX; side = 0; }
    else { sideDistY += deltaY; mapY += stepY; side = 1; }
    if (mapX < 0 || mapY < 0 || mapX >= GRID || mapY >= GRID) return { dist: maxDist, side, mapX, mapY, hit: false };
    if (grid[mapY][mapX] === 1) {
      let dist;
      if (side === 0) dist = Math.abs((mapX - px + (1 - stepX) / 2) / (dx || 1e-9));
      else dist = Math.abs((mapY - py + (1 - stepY) / 2) / (dy || 1e-9));
      return { dist: Math.min(dist, maxDist), side, mapX, mapY, hit: true };
    }
  }
  return { dist: maxDist, side, mapX, mapY, hit: false };
}

/** 圆形碰撞：采样圆心 + 8 个圆周点是否落进墙。 */
export function circleCollides(grid, x, y, r) {
  if (isWall(grid, x, y)) return true;
  const N = 8;
  for (let i = 0; i < N; i += 1) {
    const a = (i / N) * Math.PI * 2;
    if (isWall(grid, x + Math.cos(a) * r, y + Math.sin(a) * r)) return true;
  }
  return false;
}

/** 两点之间是否有墙遮挡（步进采样）。 */
export function hasLineOfSight(grid, x0, y0, x1, y1) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const dist = Math.hypot(dx, dy) || 1;
  const steps = Math.max(1, Math.ceil(dist * 3));
  for (let i = 1; i < steps; i += 1) {
    const t = i / steps;
    if (isWall(grid, x0 + dx * t, y0 + dy * t)) return false;
  }
  return true;
}
