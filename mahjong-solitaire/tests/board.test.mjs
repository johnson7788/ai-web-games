import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createBoard, matches, isFlower, isFreePos, computeStars,
} from '../src/game/board.js';
import { createSlots } from '../config/layout.js';
import { RULES, CONFIG } from '../config/game.config.js';

// 构造一个只含指定活牌的最小棋盘，复用 board 的 canPick 逻辑
function mkBoard(aliveTiles) {
  const tiles = aliveTiles.map((t) => ({ ...t, kind: t.kind || 'd1', alive: true }));
  const b = {
    tiles,
    canPick(i) {
      const t = this.tiles[i];
      if (!t || !t.alive) return false;
      return isFreePos(this.tiles, t.x, t.y, t.layer);
    },
  };
  return b;
}

test('自由判定：上方被压不可点', () => {
  // 下层 (0,0)，上层 (0,0) 完全重叠
  const b = mkBoard([
    { x: 0, y: 0, layer: 0, kind: 'd1' },
    { x: 0, y: 0, layer: 1, kind: 'd2' },
  ]);
  assert.equal(b.canPick(0), false, '下层被上层压住不可点');
  assert.equal(b.canPick(1), true, '上层无遮挡可点');
});

test('自由判定：左右两侧都被紧邻牌挡住不可点', () => {
  // 同一层一排：左中右三张相接（间距 2 格 = 0px < 一个牌宽）
  const b = mkBoard([
    { x: -2, y: 0, layer: 0, kind: 'd1' },
    { x: 0, y: 0, layer: 0, kind: 'd2' },
    { x: 2, y: 0, layer: 0, kind: 'd3' },
  ]);
  assert.equal(b.canPick(1), false, '中间牌两侧被挡不可点');
  assert.equal(b.canPick(0), true, '最左牌一侧空闲可点');
  assert.equal(b.canPick(2), true, '最右牌一侧空闲可点');
});

test('自由判定：仅一侧被挡、另一侧空闲时可点', () => {
  const b = mkBoard([
    { x: -2, y: 0, layer: 0, kind: 'd1' },
    { x: 0, y: 0, layer: 0, kind: 'd2' },
  ]);
  // 0 号右邻有牌、左侧空 → 可点；1 号左邻有牌、右侧空 → 可点
  assert.equal(b.canPick(0), true, '右邻有牌但左侧空闲可点');
  assert.equal(b.canPick(1), true, '左邻有牌但右侧空闲可点');
});

test('自由判定：同层隔一格（间距 60px）不算挡住', () => {
  const b = mkBoard([
    { x: 0, y: 0, layer: 0, kind: 'd1' },
    { x: 4, y: 0, layer: 0, kind: 'd2' },
  ]);
  assert.equal(b.canPick(0), true, '间距等于一个牌宽（4 格）不遮挡');
});

test('配对成功：两张同面且自由 → 消除', () => {
  const board = createBoard({ seed: 42 });
  const h = board.autoSolvePair();
  assert.ok(h, '应能自动消一对');
  assert.equal(board.remaining, RULES.totalTiles - 2, '剩余牌 -2');
  assert.equal(board.pairsDone, 1, '消对数 +1');
  assert.equal(board.tiles[h[0]].alive, false, '第一张已移除');
  assert.equal(board.tiles[h[1]].alive, false, '第二张已移除');
});

test('不同面不能配对（花牌除外）', () => {
  assert.equal(matches('d1', 'd1'), true);
  assert.equal(matches('d1', 'd2'), false);
  assert.equal(matches('d1', 'b1'), false);
  assert.equal(matches('wE', 'wS'), false);
});

test('花牌任意两张可配', () => {
  assert.equal(isFlower('f1'), true);
  assert.equal(matches('f1', 'f5'), true, '不同花牌可互配');
  assert.equal(matches('f3', 'f3'), true, '同花牌也可配');
});

test('提示返回一对合法可消的牌', () => {
  const board = createBoard({ seed: 7 });
  const pair = board.hint();
  assert.ok(pair, '有提示');
  assert.equal(pair.length, 2);
  const [a, b] = pair;
  assert.ok(board.canPick(a), '第一张自由');
  assert.ok(board.canPick(b), '第二张自由');
  assert.ok(matches(board.tiles[a].kind, board.tiles[b].kind), '两张同面');
});

test('死局时提示返回 null', () => {
  // 换成只有两张互不相同的自由牌 → 无可消对
  const board = createBoard({ seed: 1 });
  board.tiles = [
    { x: 0, y: 0, layer: 0, kind: 'd1', alive: true },
    { x: 4, y: 0, layer: 0, kind: 'd2', alive: true },
  ];
  board.remaining = 2;
  board.hintUsed = 0;
  assert.equal(board.hint(), null, '不同面无可消对 → null');
});

test('乌龟布局恰好 144 个槽位、5 层', () => {
  const slots = createSlots();
  assert.equal(slots.length, 144, '槽位总数 144');
  assert.equal(new Set(slots.map((s) => s.layer)).size, RULES.layers, '共 5 层');
  assert.equal(slots.every((s) => s.layer >= 0 && s.layer < 5), true, '层号 0..4');
});

test('反向发牌生成的对确实可消（可剥离）', () => {
  for (const seed of [1, 2, 3, 99, 12345]) {
    const board = createBoard({ seed });
    assert.equal(board.remaining, 144, '初始 144 张');
    let steps = 0;
    for (const [a, b] of board.solutionPairs()) {
      assert.ok(board.canPick(a), `seed ${seed} 第一张可消`);
      assert.ok(board.canPick(b), `seed ${seed} 第二张可消`);
      assert.ok(matches(board.tiles[a].kind, board.tiles[b].kind), '同面');
      board.removePair(a, b);
      steps += 1;
    }
    assert.equal(board.remaining, 0, '可全部消光');
    assert.equal(steps, 72, '共 72 对');
  }
});

test('洗牌后仍有解', () => {
  const board = createBoard({ seed: 11 });
  // 先乱消几对，再洗牌
  for (let i = 0; i < 5; i += 1) board.autoSolvePair();
  const before = board.remaining;
  assert.equal(board.shuffle(), true, '洗牌成功');
  assert.equal(board.remaining, before, '洗牌不改剩余牌数');
  // 剩余牌面（多重集）不变
  // 洗牌后仍可完整剥离
  let n = 0;
  for (const [a, b] of board.solutionPairs()) {
    assert.ok(board.canPick(a), '洗牌后可消');
    assert.ok(board.canPick(b), '洗牌后可消');
    assert.ok(matches(board.tiles[a].kind, board.tiles[b].kind), '同面');
    board.removePair(a, b);
    n += 1;
  }
  assert.equal(board.remaining, 0, '洗牌后仍可消光');
  assert.equal(n, before / 2, '对数为剩余牌一半');
});

test('道具次数：提示 3 / 撤销 5 / 洗牌 2 用完后置空', () => {
  const board = createBoard({ seed: 5 });
  for (let i = 0; i < RULES.hintLimit; i += 1) assert.ok(board.hint());
  assert.equal(board.hint(), null, '提示用尽返回 null');

  for (let i = 0; i < RULES.undoLimit; i += 1) {
    board.autoSolvePair();
    assert.equal(board.undo(), true, `第 ${i + 1} 次撤销`);
  }
  assert.equal(board.undo(), false, '撤销用尽返回 false');

  for (let i = 0; i < RULES.shuffleLimit; i += 1) assert.equal(board.shuffle(), true);
  assert.equal(board.shuffle(), false, '洗牌用尽返回 false');
});

test('星级按用时：≤180s 三星，≤420s 两星，否则一星', () => {
  assert.equal(computeStars(100), 3);
  assert.equal(computeStars(300), 2);
  assert.equal(computeStars(500), 1);
});

test('存档/配置默认值：语言与限制常量', () => {
  assert.equal(CONFIG.defaultLang, 'en');
  assert.deepEqual(CONFIG.languages, ['en', 'zh']);
  assert.equal(RULES.totalTiles, 144);
});
