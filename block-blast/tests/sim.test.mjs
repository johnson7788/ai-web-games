import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createSim, canPlace, canPlaceAt, place, findAnyFit, anyFit, getHud, drainEvents,
} from '../src/game/sim.js';
import { BOARD, RULES, CONFIG } from '../config/game.config.js';

const SIZE = BOARD.SIZE;

function dot(color = 1) {
  return { uid: 1, shapeId: 'dot', cells: [[0, 0]], color, w: 1, h: 1 };
}
function i2h(color = 2) {
  return { uid: 2, shapeId: 'i2h', cells: [[0, 0], [0, 1]], color, w: 2, h: 1 };
}
function i2v(color = 2) {
  return { uid: 3, shapeId: 'i2v', cells: [[0, 0], [1, 0]], color, w: 1, h: 2 };
}
function fullGridExcept(holes) {
  const g = Array.from({ length: SIZE }, () => Array(SIZE).fill(1));
  for (const [r, c] of holes) g[r][c] = 0;
  return g;
}

test('初始化：8×8 空棋盘、托盘 3 块、分数 0、playing', () => {
  const sim = createSim({ seed: 7 });
  assert.equal(sim.grid.length, SIZE);
  assert.equal(sim.grid[0].length, SIZE);
  assert.ok(sim.grid.every((row) => row.every((v) => v === 0)), '初始全空');
  assert.equal(sim.tray.filter(Boolean).length, RULES.traySize, '托盘 3 块');
  assert.equal(sim.score, 0);
  assert.equal(sim.phase, 'playing');
});

test('放置正向：单块落在空格 → 填格并按格计分', () => {
  const sim = createSim({ seed: 1 });
  sim.tray[0] = dot(3);
  assert.equal(canPlace(sim, 0, 2, 2), true);
  const r = place(sim, 0, 2, 2);
  assert.equal(r.ok, true);
  assert.equal(sim.grid[2][2], 3, '格子被填上颜色');
  assert.equal(sim.score, RULES.placeScorePerCell, '单格 +1');
  assert.equal(sim.tray[0], null, '该托盘槽清空');
});

test('边界：越界与重叠都不可放置', () => {
  const sim = createSim({ seed: 1 });
  sim.tray[0] = i2h();
  assert.equal(canPlace(sim, 0, 0, SIZE - 1), false, '横向越界');
  assert.equal(canPlace(sim, 0, SIZE - 1, 0), true, '单行横块在底行可放');
  sim.grid[0][0] = 5;
  assert.equal(canPlace(sim, 0, 0, 0), false, '与已有块重叠');
  assert.equal(canPlaceAt(sim.grid, [[0, 0]], -1, 0), false, '负坐标越界');
});

test('失败路径：非法放置返回 ok:false 且不改状态', () => {
  const sim = createSim({ seed: 1 });
  sim.tray[0] = i2h();
  sim.grid[0][0] = 5;
  const before = sim.score;
  const r = place(sim, 0, 0, 0);
  assert.equal(r.ok, false);
  assert.equal(sim.score, before, '分数不变');
  assert.ok(sim.tray[0], '方块仍在托盘');
});

test('满行消除：补满最后一格 → 整行清空并得分', () => {
  const sim = createSim({ seed: 1 });
  for (let c = 0; c < SIZE - 1; c += 1) sim.grid[3][c] = 2; // 第 3 行只差最后一格
  sim.tray[0] = dot(4);
  const r = place(sim, 0, 3, SIZE - 1);
  assert.equal(r.ok, true);
  assert.equal(r.lines, 1, '消 1 行');
  assert.ok(sim.grid[3].every((v) => v === 0), '整行被清空');
  const expected = RULES.placeScorePerCell + RULES.lineBaseScore * 1 * 1;
  assert.equal(sim.score, expected, '放置分 + 消行分');
  assert.equal(sim.lines, 1);
});

test('满列消除：补满最后一格 → 整列清空', () => {
  const sim = createSim({ seed: 1 });
  for (let r = 0; r < SIZE - 1; r += 1) sim.grid[r][5] = 2;
  sim.tray[0] = dot(4);
  const r = place(sim, 0, SIZE - 1, 5);
  assert.equal(r.lines, 1, '消 1 列');
  for (let rr = 0; rr < SIZE; rr += 1) assert.equal(sim.grid[rr][5], 0, '整列清空');
});

test('行列同消（十字）：一次消 2 线，分数按 n² 计', () => {
  const sim = createSim({ seed: 1 });
  // 第 2 行与第 2 列都只差交点 (2,2)
  for (let c = 0; c < SIZE; c += 1) if (c !== 2) sim.grid[2][c] = 3;
  for (let r = 0; r < SIZE; r += 1) if (r !== 2) sim.grid[r][2] = 3;
  sim.tray[0] = dot(4);
  const r = place(sim, 0, 2, 2);
  assert.equal(r.lines, 2, '行列各 1 → 2 线');
  const expected = RULES.placeScorePerCell + RULES.lineBaseScore * 2 * 2;
  assert.equal(sim.score, expected, '消 2 线 = 10*4');
  assert.ok(sim.grid[2].every((v) => v === 0), '行清空');
});

test('连击：连续消除 combo 递增，未消除则归零', () => {
  const sim = createSim({ seed: 1 });
  // 第一次消行
  for (let c = 0; c < SIZE - 1; c += 1) sim.grid[0][c] = 2;
  sim.tray[0] = dot();
  place(sim, 0, 0, SIZE - 1);
  assert.equal(sim.combo, 1, '首消 combo=1');
  // 第二次再消一行 → combo=2，含连击奖励
  for (let c = 0; c < SIZE - 1; c += 1) sim.grid[1][c] = 2;
  sim.tray[1] = dot();
  const scoreBefore = sim.score;
  place(sim, 1, 1, SIZE - 1);
  assert.equal(sim.combo, 2, '连消 combo=2');
  const gain = sim.score - scoreBefore;
  assert.equal(gain, RULES.placeScorePerCell + RULES.lineBaseScore + RULES.comboBonus * 1, '含 combo 奖励');
  // 放一个不消行的块 → combo 归零
  sim.tray[2] = dot();
  place(sim, 2, 5, 5);
  assert.equal(sim.combo, 0, '未消除 combo 归零');
});

test('托盘补满：三块都用完后自动补 3 块', () => {
  const sim = createSim({ seed: 3 });
  sim.tray = [dot(), dot(), dot()];
  place(sim, 0, 0, 0);
  place(sim, 1, 0, 2);
  assert.equal(sim.tray.filter(Boolean).length, 1, '还剩 1 块时不补');
  place(sim, 2, 0, 4);
  assert.equal(sim.tray.filter(Boolean).length, RULES.traySize, '用尽后补满 3 块');
});

test('死局判定：无任何块可放 → phase=over', () => {
  const sim = createSim({ seed: 1 });
  // 每行每列各 2 个互不相邻的空位（无满行满列），双格块无处可放，只有单块能放。
  const holes = [];
  for (let r = 0; r < SIZE; r += 1) {
    holes.push([r, r], [r, (r + 4) % SIZE]);
  }
  sim.grid = fullGridExcept(holes);
  sim.tray = [dot(), i2h(), i2v()];
  assert.equal(anyFit(sim), true, '单块还能放');
  assert.equal(findAnyFit(sim).pieceIndex, 0, '只有单块可放');
  const r = place(sim, 0, 0, 0); // 填一个空位，不触发消除
  assert.equal(r.lines, 0, '不应消除');
  assert.equal(r.over, true, '触发死局');
  assert.equal(sim.phase, 'over');
  assert.equal(anyFit(sim), false, '双格块无处可放');
});

test('findAnyFit 与 anyFit 一致，且返回合法位置', () => {
  const sim = createSim({ seed: 9 });
  const fit = findAnyFit(sim);
  assert.ok(fit, '空棋盘必有可放位置');
  assert.equal(anyFit(sim), true);
  assert.equal(canPlace(sim, fit.pieceIndex, fit.row, fit.col), true, '返回位置确实可放');
});

test('可复现：同 seed 初始托盘形状序列一致', () => {
  const a = createSim({ seed: 42 });
  const b = createSim({ seed: 42 });
  assert.deepEqual(a.tray.map((p) => p.shapeId), b.tray.map((p) => p.shapeId));
  assert.deepEqual(a.tray.map((p) => p.color), b.tray.map((p) => p.color));
});

test('事件流：place/blast/refill/over 可被 drainEvents 取出', () => {
  const sim = createSim({ seed: 1 });
  drainEvents(sim); // 清掉初始 refill
  for (let c = 0; c < SIZE - 1; c += 1) sim.grid[0][c] = 2;
  sim.tray[0] = dot();
  place(sim, 0, 0, SIZE - 1);
  const ev = drainEvents(sim);
  assert.ok(ev.some((e) => e.type === 'place'), '有 place 事件');
  assert.ok(ev.some((e) => e.type === 'blast'), '有 blast 事件');
  assert.equal(drainEvents(sim).length, 0, '取完后清空');
});

test('配置默认值：8×8、en/zh、计分常量', () => {
  assert.equal(BOARD.SIZE, 8);
  assert.equal(CONFIG.defaultLang, 'en');
  assert.deepEqual(CONFIG.languages, ['en', 'zh']);
  assert.equal(RULES.traySize, 3);
  assert.equal(RULES.lineBaseScore, 10);
  assert.equal(getHud(createSim({ seed: 1 })).score, 0);
});