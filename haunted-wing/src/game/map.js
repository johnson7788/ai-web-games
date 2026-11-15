// src/game/map.js — 纯逻辑地图构建：把 config 里的房间/门/楼梯/可搜索点编译成网格。
// 网格字符：# 墙  . 地板  ^/v 楼梯  g 发电机  X 出口  P 出生点  其余 = 门 id（如 'red'）
import { MAP, WORLD } from '../../config/game.config.js';

const cell = MAP.cell;

export function buildMap() {
  const grids = {};      // floor -> { w, h, y, cells: string[][] }
  const doors = [];      // [{ id, floor, openWhen, open, cells:[{x,z}], dir }]
  const doorById = {};   // id -> door
  const stairs = {};     // floor -> { x, z, to }
  const generator = {};  // floor -> { x, z }
  const entityPath = {}; // floor -> [{x,z}]（米）
  let spawn = null;

  for (const [fk, f] of Object.entries(MAP.floors)) {
    const floor = +fk;
    const grid = Array.from({ length: f.h }, () => Array(f.w).fill('#'));
    for (const r of f.rooms) {
      for (let z = r.z; z < r.z + r.d; z += 1) {
        for (let x = r.x; x < r.x + r.w; x += 1) grid[z][x] = '.';
      }
    }
    for (const o of f.openings || []) {
      for (let z = o.z; z < o.z + o.h; z += 1) {
        for (let x = o.x; x < o.x + o.w; x += 1) grid[z][x] = '.';
      }
    }
    for (const d of f.doors || []) {
      const door = { id: d.id, floor, openWhen: d.openWhen, open: false, cells: [], dir: d.dir };
      for (let z = d.z; z < d.z + d.h; z += 1) {
        for (let x = d.x; x < d.x + d.w; x += 1) {
          door.cells.push({ x, z });
          grid[z][x] = d.id;
        }
      }
      doors.push(door);
      doorById[d.id] = door;
    }
    if (f.stairs) { grid[f.stairs.z][f.stairs.x] = '^'; stairs[floor] = { ...f.stairs }; }
    if (f.generator) { grid[f.generator.z][f.generator.x] = 'g'; generator[floor] = { x: (f.generator.x + 0.5) * cell, z: (f.generator.z + 0.5) * cell }; }
    if (f.spawn) {
      grid[f.spawn.z][f.spawn.x] = 'P';
      spawn = { floor, x: (f.spawn.x + 0.5) * cell, z: (f.spawn.z + 0.5) * cell, yaw: f.spawn.yaw };
    }
    if (f.entityPath?.length) {
      entityPath[floor] = f.entityPath.map((p) => ({ x: (p.x + 0.5) * cell, z: (p.z + 0.5) * cell }));
    }
    grids[floor] = { w: f.w, h: f.h, y: f.y, cells: grid };
  }

  grids[MAP.exit.floor].cells[MAP.exit.z][MAP.exit.x] = 'X';

  const searchables = MAP.searchables.map((s) => ({
    ...s, x: (s.x + 0.5) * cell, z: (s.z + 0.5) * cell, key: null, searched: false,
  }));
  const batteries = MAP.batteries.map((b) => ({
    ...b, x: (b.x + 0.5) * cell, z: (b.z + 0.5) * cell, taken: false,
  }));
  const cabinets = (MAP.cabinets || []).map((c) => ({
    ...c, x: (c.x + 0.5) * cell, z: (c.z + 0.5) * cell,
  }));

  return {
    cell,
    grids,
    doors,
    doorById,
    stairs,
    generator,
    entityPath,
    spawn,
    exit: { floor: MAP.exit.floor, x: (MAP.exit.x + 0.5) * cell, z: (MAP.exit.z + 0.5) * cell },
    searchables,
    batteries,
    cabinets,
  };
}

// 网格世界坐标 → 米（用于渲染/碰撞对齐）
export const cellCenter = (c) => (c + 0.5) * cell;

export { WORLD };
