import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRun, dropResult, clearableRows, clearRows, placeCells, CELL } from '../src/game/sim.js';
import { cellsFor } from '../src/game/tetromino.js';
import { shuffled, mulberry32 } from '../src/game/rng.js';
import { gravitySeconds, lineScore, levelForLines, HEAT } from '../config/gameplay.js';
import { TYPES } from '../src/game/tetromino.js';

// 把当前活动块换成指定类型（测试用）。
function setActive(run, type, rot = 0, x = 3, y = 0) {
  run.active = {
    type, rot, x, y,
    stone: false, gift: false,
    cells: cellsFor(type, rot).map(([cx, cy]) => [x + cx, y + cy]),
  };
}

// 清空棋盘，填满底行除 3-6 列外的格子，用横 I 硬降补满 → 消 1 行。
function forceClear(run) {
  for (let yy = 0; yy < 20; yy += 1) for (let xx = 0; xx < 10; xx += 1) run.board[yy][xx] = 0;
  for (let xx = 0; xx < 10; xx += 1) if (xx < 3 || xx > 6) run.board[19][xx] = 1;
  setActive(run, 'I', 0, 3, 0);
  run.step({ hardDrop: true });
  run.drainEvents();
}

test('createRun：开局有活动块且 phase=playing', () => {
  const r = createRun({ seed: 1 });
  assert.equal(r.phase, 'playing');
  assert.ok(r.active);
  assert.equal(r.active.cells.length, 4);
});

test('重力：无输入时活动块会下落', () => {
  const r = createRun({ seed: 2 });
  const y0 = r.active.y;
  for (let i = 0; i < 60; i += 1) r.step({});
  assert.ok(r.active.y > y0, '1 秒后应下落至少 1 格');
});

test('硬降：锁定并生成下一块，且 +2/行计分', () => {
  const r = createRun({ seed: 3 });
  const before = r.active.type;
  const dist = dropResult(r.board, r.active.type, r.active.rot, r.active.x).y - r.active.y;
  const score0 = r.score;
  r.step({ hardDrop: true });
  assert.equal(r.score - score0, dist * 2, '硬降 +2 分/行');
  assert.ok(r.active, '硬降后应有新块');
});

test('软降：持续软降会计分并接近底部', () => {
  const r = createRun({ seed: 4 });
  for (let i = 0; i < 60; i += 1) r.step({ softDrop: true });
  assert.ok(r.score > 0, '软降应有计分');
});

test('消 1 行：横 I 补满底行 → lines=1 且计分', () => {
  const r = createRun({ seed: 5 });
  forceClear(r);
  assert.equal(r.lines, 1);
  assert.ok(r.score >= 100, '消行得分 ≥100');
});

test('TETRA：竖 I 补满 4 行 → lines=4 且发 tetra 事件', () => {
  const r = createRun({ seed: 6 });
  for (let yy = 0; yy < 20; yy += 1) for (let xx = 0; xx < 10; xx += 1) r.board[yy][xx] = 0;
  for (let yy = 16; yy < 20; yy += 1) {
    for (let xx = 0; xx < 10; xx += 1) if (xx !== 2) r.board[yy][xx] = 1;
  }
  setActive(r, 'I', 1, 0, 0);
  r.step({ hardDrop: true });
  const evs = r.drainEvents();
  assert.equal(r.lines, 4);
  assert.ok(r.score >= 800, '四行得分 ≥800');
  assert.ok(evs.some((e) => e.type === 'tetra'), '应有 tetra 事件');
});

test('等级：levelForLines 每 10 行 +1 且封顶', () => {
  assert.equal(levelForLines(0), 1);
  assert.equal(levelForLines(10), 2);
  assert.equal(levelForLines(100), 11);
  assert.equal(levelForLines(9999), 20);
});

test('行分：lineScore 1/4 行与白热倍率', () => {
  assert.equal(lineScore(1, 1, false), 100);
  assert.equal(lineScore(4, 1, false), 800);
  assert.equal(lineScore(1, 2, false), 200);
  assert.equal(lineScore(1, 1, true), 200);
});

test('hold：首次暂存后本块锁禁不可再暂存', () => {
  const r = createRun({ seed: 7 });
  const cur = r.active.type;
  r.step({ hold: true });
  assert.equal(r.hold, cur);
  assert.equal(r.holdUsed, true);
  const after = r.active.type;
  r.step({ hold: true });
  assert.equal(r.hold, cur, '锁禁期内 hold 不变');
  assert.equal(r.active.type, after, '锁禁期内不出新块');
});

test('hold：落定后可交换回暂存块', () => {
  const r = createRun({ seed: 8 });
  const first = r.active.type;
  r.step({ hold: true });
  r.step({ hardDrop: true }); // 落定，解除锁禁
  assert.equal(r.holdUsed, false);
  const second = r.active.type;
  r.step({ hold: true });
  assert.equal(r.active.type, first, '交换后拿回暂存块');
  assert.equal(r.hold, second);
});

test('旋转：T 块旋转改变 rot', () => {
  const r = createRun({ seed: 9 });
  setActive(r, 'T', 0, 4, 5);
  r.step({ rotateCW: true });
  assert.equal(r.active.rot, 1);
});

test('SRS 踢墙：贴左墙旋转不崩且返回布尔', () => {
  const r = createRun({ seed: 10 });
  setActive(r, 'T', 0, 0, 5);
  r.step({ rotateCW: true });
  assert.ok([0, 1, 2, 3].includes(r.active.rot), '旋转后 rot 合法');
});

test('顶出：出生区被封后新块生成即死亡', () => {
  const r = createRun({ seed: 11 });
  for (let yy = 0; yy < 20; yy += 1) for (let xx = 0; xx < 10; xx += 1) r.board[yy][xx] = 0;
  // 封住出生区（cols 3..6、rows 0..2），当前块无法下落 → 锁定 → 下一块出生碰撞 → 死亡
  for (let yy = 0; yy < 3; yy += 1) for (let xx = 3; xx <= 6; xx += 1) r.board[yy][xx] = 1;
  for (let i = 0; i < 40 && r.phase === 'playing'; i += 1) r.step({});
  assert.equal(r.phase, 'dead');
});

test('7-bag：洗牌后是 7 种块的一个排列', () => {
  const rng = mulberry32(99);
  const bag = shuffled(rng, TYPES);
  assert.equal(bag.length, 7);
  assert.deepEqual([...bag].sort(), [...TYPES].sort());
});

test('矿层推进：消满 16 行进入第 4 层（窄井）', () => {
  const r = createRun({ seed: 12 });
  for (let i = 0; i < 16; i += 1) forceClear(r);
  assert.equal(r.layer, 4);
  assert.equal(r.narrow, true);
  assert.equal(r.board[0][0], CELL.WALL);
  assert.equal(r.board[0][9], CELL.WALL);
});

test('窄井消行：只统计中间 8 列', () => {
  const b = Array.from({ length: 20 }, () => new Array(10).fill(0));
  // 底行中间 8 列填满，两侧墙列留空
  for (let x = 1; x <= 8; x += 1) b[19][x] = 1;
  const rows = clearableRows(b, { narrow: true });
  assert.deepEqual(rows, [19]);
});

test('石头块不可消：含石头的行不能被消', () => {
  const b = Array.from({ length: 20 }, () => new Array(10).fill(0));
  for (let x = 0; x < 10; x += 1) b[19][x] = 1;
  b[19][5] = CELL.STONE;
  assert.deepEqual(clearableRows(b, { narrow: false }), []);
});

test('消行下移：清掉底行后底行变空、上方下移', () => {
  const b = Array.from({ length: 20 }, () => new Array(10).fill(0));
  b[18][0] = 1;
  b[19][0] = 1;
  const b2 = clearRows(b, [19]);
  assert.equal(b2[19][0], 1, '原第 18 行下移到第 19 行');
  assert.equal(b2[18][0], 0);
});

test('重力：等级越高越快、白热态更快', () => {
  assert.ok(gravitySeconds(10) < gravitySeconds(1));
  assert.ok(gravitySeconds(5, { whiteHot: true }) < gravitySeconds(5));
});

test('白热态：满热自动触发', () => {
  const r = createRun({ seed: 13 });
  r.heat = HEAT.MAX - 1;
  forceClear(r); // +1 热
  assert.equal(r.whiteHot, true);
  assert.ok(r.whiteHotLeft > 0);
});
