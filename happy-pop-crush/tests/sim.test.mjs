import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRun, mulberry32 } from '../src/game/sim.js';
import { LEVELS, LEVEL_COUNT } from '../config/levels.js';

const ROWS = 8;
const COLS = 8;

// 检测棋盘里是否存在 ≥3 的横/竖同色 run（测试用，独立于 sim 实现）
function hasMatch(grid) {
  for (let r = 0; r < ROWS; r += 1) {
    for (let c = 0; c <= COLS - 3; c += 1) {
      const a = grid[r][c], b = grid[r][c + 1], d = grid[r][c + 2];
      if (a && b && d && a.kind !== 'rock' && b.kind !== 'rock' && d.kind !== 'rock'
        && a.color === b.color && b.color === d.color) return true;
    }
  }
  for (let c = 0; c < COLS; c += 1) {
    for (let r = 0; r <= ROWS - 3; r += 1) {
      const a = grid[r][c], b = grid[r + 1][c], d = grid[r + 2][c];
      if (a && b && d && a.kind !== 'rock' && b.kind !== 'rock' && d.kind !== 'rock'
        && a.color === b.color && b.color === d.color) return true;
    }
  }
  return false;
}

// 把棋盘填成 (r+c)%3 对角图案（无横竖三连），保留岩石
function fillBoard(state) {
  let id = 100000;
  for (let r = 0; r < ROWS; r += 1) {
    for (let c = 0; c < COLS; c += 1) {
      const cell = state.grid[r][c];
      if (cell && cell.kind === 'rock') continue;
      state.grid[r][c] = { id: id++, color: (r + c) % 3, special: 'none' };
    }
  }
}

function hasSpecial(state, special) {
  for (let r = 0; r < ROWS; r += 1) {
    for (let c = 0; c < COLS; c += 1) {
      const cell = state.grid[r][c];
      if (cell && cell.special === special) return true;
    }
  }
  return false;
}

function noNulls(state) {
  for (let r = 0; r < ROWS; r += 1) {
    for (let c = 0; c < COLS; c += 1) {
      if (!state.grid[r][c]) return false;
    }
  }
  return true;
}

test('冒烟：createRun → step → tap → getHud → drainEvents 无异常', () => {
  const r = createRun(0, { seed: 1 });
  r.step(1 / 60);
  const hud = r.getHud();
  assert.equal(hud.level, 1);
  assert.equal(hud.phase, 'playing');
  assert.ok(hud.movesLeft > 0);
  assert.ok(Array.isArray(r.drainEvents()));
});

test('state 形状：8×8 棋盘、全满、无初始三消、可玩', () => {
  const r = createRun(0, { seed: 1 });
  const s = r.state;
  assert.equal(s.rows, ROWS);
  assert.equal(s.cols, COLS);
  assert.equal(s.grid.length, ROWS);
  assert.equal(s.grid[0].length, COLS);
  assert.equal(s.phase, 'playing');
  assert.equal(noNulls(s), true);
  assert.equal(hasMatch(s.grid), false);
  assert.ok(r.findMove(), '初始棋盘应有可行交换');
});

test('确定性：同 seed 生成完全一致的棋盘', () => {
  const a = createRun(0, { seed: 42 });
  const b = createRun(0, { seed: 42 });
  for (let r = 0; r < ROWS; r += 1) {
    for (let c = 0; c < COLS; c += 1) {
      assert.equal(a.state.grid[r][c].color, b.state.grid[r][c].color);
      assert.equal(a.state.grid[r][c].special, b.state.grid[r][c].special);
    }
  }
});

test('关卡表：8 关、index 连续、目标分/步数合法', () => {
  assert.equal(LEVEL_COUNT, 8);
  assert.equal(LEVELS.length, 8);
  LEVELS.forEach((lv, i) => {
    assert.equal(lv.index, i + 1);
    assert.ok(lv.target > 0);
    assert.ok(lv.moves > 0);
    assert.ok(lv.colors >= 3 && lv.colors <= 6);
    assert.ok(Array.isArray(lv.rocks));
    assert.ok(lv.hammers >= 0);
  });
});

test('岩石：L2 指定格是 rock，点选返回 notGem', () => {
  const r = createRun(1, { seed: 1 });
  const [rr, cc] = LEVELS[1].rocks[0];
  assert.equal(r.state.grid[rr][cc].kind, 'rock');
  assert.equal(r.tap(rr, cc).reason, 'notGem');
});

test('点选状态机：选 → 再点同一格取消', () => {
  const r = createRun(0, { seed: 1 });
  const t1 = r.tap(0, 0);
  assert.equal(t1.selected, true);
  assert.deepEqual(r.state.selected, { r: 0, c: 0 });
  const t2 = r.tap(0, 0);
  assert.equal(t2.deselected, true);
  assert.equal(r.state.selected, null);
});

test('findMove 返回的交换确实产生消除', () => {
  const r = createRun(0, { seed: 7 });
  const mv = r.findMove();
  assert.ok(mv);
  const res = r.swap(mv.a, mv.b);
  assert.equal(res.matched, true);
  assert.ok(r.state.score > 0);
  assert.equal(r.state.movesLeft, r.state.initialMoves - 1);
});

test('无效交换弹回：分数不变，步数消耗 1', () => {
  const r = createRun(0, { seed: 1 });
  fillBoard(r.state);
  const before = r.state.score;
  const moves = r.state.movesLeft;
  // (0,0)=(0,1) 在 (r+c)%3 图案里相邻不同色，交换不产生消除
  const res = r.swap({ r: 0, c: 0 }, { r: 0, c: 1 });
  assert.equal(res.matched, false);
  assert.equal(r.state.score, before);
  assert.equal(r.state.movesLeft, moves - 1);
});

test('消除后重力补位：棋盘始终全满', () => {
  const r = createRun(0, { seed: 7 });
  const mv = r.findMove();
  r.swap(mv.a, mv.b);
  assert.equal(noNulls(r.state), true);
});

test('4 连生成行特殊宝石（line）', () => {
  const r = createRun(0, { seed: 1 });
  fillBoard(r.state);
  const s = r.state;
  s.grid[3][0].color = 0;
  s.grid[3][1].color = 0;
  s.grid[3][2].color = 0;
  s.grid[3][3].color = 1;
  s.grid[3][4].color = 0;
  const res = r.swap({ r: 3, c: 3 }, { r: 3, c: 4 });
  assert.equal(res.matched, true);
  assert.ok(r.state.score > 0);
  assert.equal(hasSpecial(s, 'line'), true);
});

test('相邻消除震碎岩石', () => {
  const r = createRun(0, { seed: 1 });
  const s = r.state;
  fillBoard(s);
  s.grid[1][1] = { kind: 'rock' };
  s.grid[0][0].color = 0;
  s.grid[0][1].color = 0;
  s.grid[0][2].color = 2;
  s.grid[0][3].color = 0;
  const res = r.swap({ r: 0, c: 2 }, { r: 0, c: 3 });
  assert.equal(res.matched, true);
  assert.notEqual(s.grid[1][1].kind, 'rock', '岩石应被震碎');
  assert.ok(r.drainEvents().some((e) => e.type === 'rockBreak'));
});

test('锤子砸宝石：锤数递减、棋盘补满', () => {
  const r = createRun(0, { seed: 1 });
  const before = r.state.hammers;
  const res = r.hammer(0, 0);
  assert.equal(res.ok, true);
  assert.equal(r.state.hammers, before - 1);
  assert.equal(noNulls(r.state), true);
});

test('达标即胜：分数达目标 → win + 星级', () => {
  const r = createRun(0, { seed: 7 });
  r.state.targetScore = 1;
  const mv = r.findMove();
  r.swap(mv.a, mv.b);
  assert.equal(r.state.phase, 'won');
  assert.equal(r.state.result.won, true);
  assert.ok(r.state.stars >= 1);
  assert.ok(r.drainEvents().some((e) => e.type === 'win'));
});

test('步数耗尽未达标 → lose outOfMoves', () => {
  const r = createRun(0, { seed: 7 });
  r.state.targetScore = 1e9;
  r.state.movesLeft = 1;
  const mv = r.findMove();
  r.swap(mv.a, mv.b);
  assert.equal(r.state.phase, 'lost');
  assert.equal(r.state.result.won, false);
  assert.ok(r.drainEvents().some((e) => e.type === 'lose' && e.reason === 'outOfMoves'));
});

test('彩虹鸟 + 任意宝石：清一整色并消耗一步', () => {
  const r = createRun(0, { seed: 1 });
  const s = r.state;
  fillBoard(s);
  s.grid[0][0] = { id: 1, color: -1, special: 'bird' };
  s.grid[0][1] = { id: 2, color: 0, special: 'none' };
  const moves = s.movesLeft;
  const res = r.swap({ r: 0, c: 0 }, { r: 0, c: 1 });
  assert.equal(res.matched, true);
  assert.equal(res.special, 'bird');
  assert.equal(s.movesLeft, moves - 1);
  assert.equal(noNulls(s), true);
});

test('mulberry32 确定性随机', () => {
  const a = mulberry32(123);
  const b = mulberry32(123);
  assert.equal(a(), b());
  assert.equal(a(), b());
});
