// 关卡解析 + 可解性求解（A* 最优解，用于星级 par 与 bot/测试）。
// 纯逻辑，零 DOM。sim / selfplay / tests 共用。

import { LEVELS } from '../../config/levels.js';

const DIRS = [
  { d: 'up', dr: -1, dc: 0 },
  { d: 'down', dr: 1, dc: 0 },
  { d: 'left', dr: 0, dc: -1 },
  { d: 'right', dr: 0, dc: 1 },
];

const key = (r, c) => `${r},${c}`;

/** 解析 ASCII 地图 → 地形/目标/箱子/玩家/岩石 */
export function parseLevel(level) {
  const rows = level.map.filter((l) => l.trim().length > 0);
  const R = rows.length;
  const C = Math.max(...rows.map((r) => r.length));
  const walls = new Set();
  const rocks = new Set();
  const targets = new Set();
  const targetList = [];
  const boxes = [];
  let player = null;
  let id = 0;

  const terrain = [];
  for (let r = 0; r < R; r += 1) {
    const rowArr = [];
    const line = rows[r] || '';
    for (let c = 0; c < C; c += 1) {
      const ch = line[c] || '#';
      let kind = 'floor';
      let target = false;
      if (ch === '#') kind = 'wall';
      else if (ch === 'X') kind = 'rock';
      else if (ch === '*') target = true;
      else if (ch === '$') boxes.push({ id: id++, r, c });
      else if (ch === '@') player = { r, c };
      else if (ch === '+') { target = true; player = { r, c }; }
      if (kind === 'wall') walls.add(key(r, c));
      if (kind === 'rock') rocks.add(key(r, c));
      if (target) { targets.add(key(r, c)); targetList.push({ r, c }); }
      rowArr.push({ kind, target });
    }
    terrain.push(rowArr);
  }

  return { rows: R, cols: C, walls, rocks, targets, targetList, boxes, player, terrain };
}

function isBoxAt(boxes, r, c) {
  return boxes.some((b) => b.r === r && b.c === c);
}

// ---------------- 二叉最小堆 ----------------
class MinHeap {
  constructor() { this.a = []; }
  push(v) {
    const a = this.a;
    a.push(v);
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (a[p].f <= a[i].f) break;
      [a[p], a[i]] = [a[i], a[p]];
      i = p;
    }
  }
  pop() {
    const a = this.a;
    if (a.length === 0) return null;
    const top = a[0];
    const last = a.pop();
    if (a.length > 0) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1;
        const r = l + 1;
        let m = i;
        if (l < a.length && a[l].f < a[m].f) m = l;
        if (r < a.length && a[r].f < a[m].f) m = r;
        if (m === i) break;
        [a[m], a[i]] = [a[i], a[m]];
        i = m;
      }
    }
    return top;
  }
  get size() { return this.a.length; }
}

function stateKey(player, boxes) {
  const boxKeys = boxes.map((b) => key(b.r, b.c)).sort();
  return `${key(player.r, player.c)}|${boxKeys.join(',')}`;
}

/**
 * A* 求解最短步数解（走路/推箱都算 1 步）。
 * 启发式：每个箱子到最近目标的曼哈顿距离之和（可采纳下界）。
 * 返回 { moves: string[], count: number } 或 null（不可解）。
 */
export function solveLevel(level) {
  const p = parseLevel(level);
  const { walls, rocks, targets, targetList, player: startPlayer, boxes: rawBoxes } = p;
  const R = p.rows;
  const C = p.cols;
  if (!startPlayer) return null;

  const isGoal = (boxes) => boxes.every((b) => targets.has(key(b.r, b.c)));

  const heuristic = (boxes) => {
    let sum = 0;
    for (const b of boxes) {
      if (targets.has(key(b.r, b.c))) continue;
      let best = Infinity;
      for (const t of targetList) {
        const d = Math.abs(b.r - t.r) + Math.abs(b.c - t.c);
        if (d < best) best = d;
      }
      sum += best;
    }
    return sum;
  };

  const start = rawBoxes.map((b) => ({ id: b.id, r: b.r, c: b.c }));
  if (isGoal(start)) return { moves: [], count: 0 };

  const startPlayerNode = { r: startPlayer.r, c: startPlayer.c };
  const gScore = new Map();
  const startKey = stateKey(startPlayerNode, start);
  gScore.set(startKey, 0);
  const open = new MinHeap();
  open.push({ f: heuristic(start), g: 0, player: startPlayerNode, boxes: start, path: [] });

  const NODE_CAP = 600000;
  let expanded = 0;

  while (open.size > 0) {
    if (++expanded > NODE_CAP) return null;
    const cur = open.pop();
    const curKey = stateKey(cur.player, cur.boxes);
    if (gScore.get(curKey) !== cur.g) continue; // 陈旧节点

    if (isGoal(cur.boxes)) return { moves: cur.path, count: cur.path.length };

    for (const { d, dr, dc } of DIRS) {
      const nr = cur.player.r + dr;
      const nc = cur.player.c + dc;
      if (nr < 0 || nr >= R || nc < 0 || nc >= C) continue;
      if (walls.has(key(nr, nc)) || rocks.has(key(nr, nc))) continue;

      const boxIdx = cur.boxes.findIndex((b) => b.r === nr && b.c === nc);
      let nextBoxes;
      let nextPlayer;

      if (boxIdx >= 0) {
        const br = nr + dr;
        const bc = nc + dc;
        if (br < 0 || br >= R || bc < 0 || bc >= C) continue;
        if (walls.has(key(br, bc)) || rocks.has(key(br, bc))) continue;
        if (isBoxAt(cur.boxes, br, bc)) continue;
        nextBoxes = cur.boxes.map((b, i) => (i === boxIdx ? { ...b, r: br, c: bc } : b));
        nextPlayer = { r: nr, c: nc };
      } else {
        nextBoxes = cur.boxes;
        nextPlayer = { r: nr, c: nc };
      }

      const nk = stateKey(nextPlayer, nextBoxes);
      const ng = cur.g + 1;
      if (gScore.has(nk) && gScore.get(nk) <= ng) continue;
      gScore.set(nk, ng);
      open.push({ f: ng + heuristic(nextBoxes), g: ng, player: nextPlayer, boxes: nextBoxes, path: [...cur.path, d] });
    }
  }
  return null;
}

// par 缓存（按关卡 index）
const parCache = new Map();

/** 关卡最优步数（用于星级 par）；优先用 levels 里硬编码的 par，否则 A* 求解 */
export function getPar(levelIndex) {
  const idx = levelIndex | 0;
  if (parCache.has(idx)) return parCache.get(idx);
  const level = LEVELS[idx] ?? LEVELS[0];
  let val = null;
  if (typeof level.par === 'number' && level.par > 0) {
    val = level.par;
  } else {
    const sol = solveLevel(level);
    val = sol ? sol.count : null;
  }
  parCache.set(idx, val);
  return val;
}

/** 可解性（供测试） */
export function isSolvable(level) {
  return solveLevel(level) !== null;
}
