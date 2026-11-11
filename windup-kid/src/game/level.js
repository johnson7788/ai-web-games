// 关卡解析：ASCII 地图 → 瓦片网格 + 实体 + 校验。纯数据，不碰 DOM / three。
export const T = { EMPTY: 0, SOLID: 1, BRICK: 2, QUESTION: 3, HARD: 4, ONEWAY: 5, SPIKE: 6, SPRING: 7 };

const LEGEND = { '.': 0, '#': 1, B: 2, '?': 3, X: 4, '=': 5, '^': 6, S: 7 };
const SOLID = new Set(['#', 'B', '?', 'X']);
const ENTITY_CHARS = 'oPEKMTCPF';

/**
 * @param {object} def 关卡定义（terrain 字符串数组，第 0 行是最上面）
 * @returns 关卡对象：w/h/tiles/spawn/goal/pickups/enemies + tileAt/isSolid
 */
export function parseLevel(def) {
  const rows = def.terrain;
  if (!rows || !rows.length) throw new Error(`关卡 ${def.id} 没有地形`);
  const w = rows[0].length;
  if (!rows.every((r) => r.length === w)) throw new Error(`关卡 ${def.id} 行不等宽`);
  const h = rows.length;

  const tiles = new Uint8Array(w * h);
  const pickups = [];
  const enemies = [];
  const checkpoints = [];
  const goal = { x: 0, y: 0 };
  let spawn = null;

  for (let r = 0; r < h; r++) {
    const ty = h - 1 - r;                    // ★ 行号翻转：第 0 行在最上面
    for (let tx = 0; tx < w; tx++) {
      const ch = rows[r][tx];
      if (ch === 'P') { spawn = { x: tx + 0.5, y: ty + 0.5 }; continue; }
      if (ch === 'F') { goal.x = tx + 0.5; goal.y = ty + 0.5; continue; }
      if (ch === 'o') { pickups.push({ x: tx + 0.5, y: ty + 0.5, taken: false }); continue; }
      if (ch === 'C') { checkpoints.push({ x: tx + 0.5, y: ty + 0.5, on: false }); continue; }
      if (ENTITY_CHARS.includes(ch)) { enemies.push({ type: ch, x: tx + 0.5, y: ty + 0.5 }); continue; }
      const t = LEGEND[ch];
      if (t !== undefined) tiles[ty * w + tx] = t;
    }
  }

  if (!spawn) throw new Error(`关卡 ${def.id} 缺少出生点 P`);
  if (!goal.x) throw new Error(`关卡 ${def.id} 缺少旗杆 F`);

  return {
    ...def, w, h, tiles, spawn, goal, pickups, enemies, checkpoints,
    tileAt(tx, ty) {
      if (tx < 0 || tx >= w || ty < 0 || ty >= h) return T.EMPTY;
      return tiles[ty * w + tx];
    },
    setTile(tx, ty, id) {
      if (tx < 0 || tx >= w || ty < 0 || ty >= h) return;
      tiles[ty * w + tx] = id;
    },
    isSolid(tx, ty) {
      if (tx < 0 || tx >= w || ty < 0 || ty >= h) return false; // 左右边界墙由 physics 处理
      // ★ 必须读 tiles：木箱被打碎/问号砖变硬后，setTile 只改 tiles
      const t = tiles[ty * w + tx];
      return t === T.SOLID || t === T.BRICK || t === T.QUESTION || t === T.HARD;
    },
  };
}

/** 设计校验：开发期用，不阻断运行 */
export function lintLevel(level) {
  const issues = [];
  if (level.h < 14) issues.push(`高度 ${level.h} < 14`);
  if (level.pickups.length < 15) issues.push(`齿轮只有 ${level.pickups.length} 个（建议 ≥ 15）`);
  if (level.goal.x < level.w - 24) issues.push('旗杆不在最后一屏');
  return issues;
}
