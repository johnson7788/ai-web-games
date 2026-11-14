// 方块形状库：每个形状是相对左上角的 [row, col] 单元格列表。
// weight 越大越常见；color 为 COLORS.blocks 的索引（1..7）。
// 逻辑层只读这里，不写死形状。

function cells(rows) {
  // rows: 字符串数组，'X' 表示有块
  const out = [];
  rows.forEach((line, r) => {
    [...line].forEach((ch, c) => {
      if (ch === 'X') out.push([r, c]);
    });
  });
  return out;
}

export const SHAPES = [
  { id: 'dot',   weight: 6,  color: 5, cells: cells(['X']) },
  { id: 'i2h',   weight: 7,  color: 2, cells: cells(['XX']) },
  { id: 'i2v',   weight: 7,  color: 2, cells: cells(['X', 'X']) },
  { id: 'i3h',   weight: 6,  color: 3, cells: cells(['XXX']) },
  { id: 'i3v',   weight: 6,  color: 3, cells: cells(['X', 'X', 'X']) },
  { id: 'i4h',   weight: 4,  color: 4, cells: cells(['XXXX']) },
  { id: 'i4v',   weight: 4,  color: 4, cells: cells(['X', 'X', 'X', 'X']) },
  { id: 'i5h',   weight: 2,  color: 6, cells: cells(['XXXXX']) },
  { id: 'i5v',   weight: 2,  color: 6, cells: cells(['X', 'X', 'X', 'X', 'X']) },
  { id: 'o2',    weight: 6,  color: 1, cells: cells(['XX', 'XX']) },
  { id: 'o3',    weight: 2,  color: 7, cells: cells(['XXX', 'XXX', 'XXX']) },
  { id: 'r23',   weight: 3,  color: 2, cells: cells(['XXX', 'XXX']) },
  { id: 'r32',   weight: 3,  color: 2, cells: cells(['XX', 'XX', 'XX']) },
  { id: 'l2a',   weight: 4,  color: 3, cells: cells(['X.', 'XX']) },
  { id: 'l2b',   weight: 4,  color: 3, cells: cells(['.X', 'XX']) },
  { id: 'l2c',   weight: 4,  color: 3, cells: cells(['XX', 'X.']) },
  { id: 'l2d',   weight: 4,  color: 3, cells: cells(['XX', '.X']) },
  { id: 'l3a',   weight: 3,  color: 4, cells: cells(['X..', 'X..', 'XXX']) },
  { id: 'l3b',   weight: 3,  color: 4, cells: cells(['..X', '..X', 'XXX']) },
  { id: 'l3c',   weight: 3,  color: 4, cells: cells(['XXX', 'X..', 'X..']) },
  { id: 'l3d',   weight: 3,  color: 4, cells: cells(['XXX', '..X', '..X']) },
  { id: 'j3a',   weight: 3,  color: 6, cells: cells(['.X', '.X', 'XX']) },
  { id: 'j3b',   weight: 3,  color: 6, cells: cells(['X.', 'X.', 'XX']) },
  { id: 't3a',   weight: 3,  color: 5, cells: cells(['XXX', '.X.']) },
  { id: 't3b',   weight: 3,  color: 5, cells: cells(['.X.', 'XXX']) },
  { id: 't3c',   weight: 3,  color: 5, cells: cells(['X.', 'XX', 'X.']) },
  { id: 't3d',   weight: 3,  color: 5, cells: cells(['.X', 'XX', '.X']) },
  { id: 's3a',   weight: 2,  color: 7, cells: cells(['.XX', 'XX.']) },
  { id: 's3b',   weight: 2,  color: 7, cells: cells(['XX.', '.XX']) },
  { id: 'z3a',   weight: 2,  color: 1, cells: cells(['X.', 'XX', '.X']) },
  { id: 'z3b',   weight: 2,  color: 1, cells: cells(['.X', 'XX', 'X.']) },
];

// 预计算每个形状的包围盒，便于托盘缩放与拖拽命中。
for (const s of SHAPES) {
  let maxR = 0;
  let maxC = 0;
  for (const [r, c] of s.cells) {
    if (r > maxR) maxR = r;
    if (c > maxC) maxC = c;
  }
  s.h = maxR + 1;
  s.w = maxC + 1;
}

export const TOTAL_WEIGHT = SHAPES.reduce((a, s) => a + s.weight, 0);