// config/levels.js — 远征地图：12 节点（0..11 列）分支地图 + 三场景包（换章换色板/构图/装饰）
// 从某列任一节点出发，可选下一列的 1–3 个节点（分支地图三选一）。

export const CHAPTERS = [
  { id: 1, nameKey: 'ch.1', scene: 'meadow', palette: { sky: ['#bfe8d8', '#7fc9a8'], ground: ['#6fbf8f', '#3f8f68'], accent: '#2f6f4f' } },
  { id: 2, nameKey: 'ch.2', scene: 'snow',   palette: { sky: ['#dcecf4', '#9fc3d8'], ground: ['#eef4f8', '#b7cfe0'], accent: '#7fa8c0' } },
  { id: 3, nameKey: 'ch.3', scene: 'ash',    palette: { sky: ['#4a2f33', '#2a1c20'], ground: ['#6b3a3f', '#3a2226'], accent: '#c96a4a' } },
];

export const chapterOf = (col) => (col <= 3 ? 1 : col <= 7 ? 2 : 3);

// 每列节点：type + 敌人组。n = 敌人 id 列表（battle/elite/boss 用）。
// 列 0 是出发营地（不耗粮），列 1..11 逐列推进，列 11 是远征 Boss。
const COLS = [
  [ { id: 'n0', type: 'start' } ],
  [ { id: 'n1a', type: 'battle', g: ['grunt', 'grunt'] }, { id: 'n1b', type: 'rest' } ],
  [ { id: 'n2a', type: 'battle', g: ['grunt', 'archer'] }, { id: 'n2b', type: 'event' }, { id: 'n2c', type: 'battle', g: ['grunt', 'grunt'] } ],
  [ { id: 'n3a', type: 'battle', g: ['grunt', 'grunt', 'archer'] }, { id: 'n3b', type: 'rest' } ],
  [ { id: 'n4a', type: 'elite', g: ['brute', 'grunt'] }, { id: 'n4b', type: 'battle', g: ['grunt', 'archer'] }, { id: 'n4c', type: 'event' } ],
  [ { id: 'n5a', type: 'battle', g: ['grunt', 'archer', 'archer'] }, { id: 'n5b', type: 'event' }, { id: 'n5c', type: 'battle', g: ['grunt', 'grunt'] } ],
  [ { id: 'n6a', type: 'rest' }, { id: 'n6b', type: 'battle', g: ['grunt', 'grunt'] }, { id: 'n6c', type: 'elite', g: ['brute', 'archer'] } ],
  [ { id: 'n7a', type: 'battle', g: ['grunt', 'archer', 'grunt'] }, { id: 'n7b', type: 'event' } ],
  [ { id: 'n8a', type: 'battle', g: ['grunt', 'shaman'] }, { id: 'n8b', type: 'rest' } ],
  [ { id: 'n9a', type: 'elite', g: ['brute', 'brute'] }, { id: 'n9b', type: 'battle', g: ['grunt', 'archer', 'shaman'] }, { id: 'n9c', type: 'battle', g: ['grunt', 'grunt'] } ],
  [ { id: 'n10a', type: 'battle', g: ['brute', 'grunt', 'archer'] }, { id: 'n10b', type: 'event' }, { id: 'n10c', type: 'elite', g: ['brute', 'shaman', 'grunt'] } ],
  [ { id: 'n11', type: 'boss', g: ['boss', 'grunt', 'archer'] } ],
];

export const NODES = [];
const byId = {};
for (let col = 0; col < COLS.length; col += 1) {
  for (const spec of COLS[col]) {
    const node = {
      id: spec.id,
      col,
      type: spec.type,
      chapter: chapterOf(col),
      enemyGroup: spec.g || [],
      nameKey: `node.${spec.type}`,
    };
    NODES.push(node);
    byId[spec.id] = node;
  }
}

export const START_NODE = byId.n0;

export function nodeById(id) {
  return byId[id] || null;
}

/** 当前节点的下一列可选节点（分支三选一）。列 11 之后返回空。 */
export function nextNodesOf(node) {
  if (!node) return [];
  return NODES.filter((n) => n.col === node.col + 1);
}

export const TOTAL_COLS = COLS.length; // 12（列 0..11）
