import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createSim, select, pop, tick, drainEvents, findGroup, allGroups, hasMove, countStars,
  rocksForLevel,
} from '../src/game/sim.js';
import { GAME, targetFor } from '../config/game.config.js';

const empty = () => Array.from({ length: GAME.GRID }, () => Array(GAME.GRID).fill(0));

test('createSim：10×10 且初始必有可消除团', () => {
  const s = createSim(1, 7);
  assert.equal(s.grid.length, GAME.GRID);
  assert.equal(s.grid[0].length, GAME.GRID);
  assert.equal(s.phase, 'playing');
  assert.equal(hasMove(s.grid), true);
});

test('level1 无岩石，level2/3 岩石递增', () => {
  assert.equal(rocksForLevel(1), 0);
  assert.equal(rocksForLevel(2), 2);
  assert.equal(rocksForLevel(3), 4);
  const s1 = createSim(1, 3);
  const s2 = createSim(2, 3);
  const rockCount = (grid) => grid.flat().filter((v) => v === GAME.ROCK_TYPE).length;
  assert.equal(rockCount(s1.grid), 0);
  assert.equal(rockCount(s2.grid), 2);
});

test('findGroup 返回连通同色且 ≥2', () => {
  const s = createSim(1, 5);
  const groups = allGroups(s.grid);
  const g = groups[0];
  assert.ok(g.length >= 2);
  assert.deepEqual(findGroup(s.grid, g[0][0], g[0][1]).length, g.length);
});

test('select 选中团并返回尺寸；选空格/岩石失败', () => {
  const s = createSim(1, 5);
  const g = allGroups(s.grid)[0];
  const r = select(s, g[0][0], g[0][1]);
  assert.equal(r.ok, true);
  assert.equal(s.selected.length, g.length);
  s.grid[0][0] = 0;
  assert.equal(select(s, 0, 0).ok, false);
});

test('pop 基础得分 n²×5（首爆无连击加成）', () => {
  const s = createSim(1, 1);
  s.grid = empty();
  s.grid[0][0] = 1; s.grid[0][1] = 1;
  s.grid[9][0] = 3; s.grid[9][1] = 3;
  s.selected = [[0, 0], [0, 1]];
  const r = pop(s);
  assert.equal(r.ok, true);
  assert.equal(s.score, 2 * 2 * GAME.BASE_SCORE);
});

test('重力下落：清除后上方星体落下', () => {
  const s = createSim(1, 1);
  s.grid = empty();
  s.grid[0][0] = 1; s.grid[0][1] = 1;   // 待消除团
  s.grid[0][3] = 2;                      // 悬浮星
  s.grid[9][0] = 3; s.grid[9][1] = 3;    // 保留可动
  s.selected = [[0, 0], [0, 1]];
  pop(s);
  assert.equal(s.grid[0][0], 2);
  assert.equal(s.grid[0][3], 0);
});

test('左靠：整列清空后右侧列左移', () => {
  const s = createSim(1, 1);
  s.grid = empty();
  s.grid[0][0] = 1; s.grid[0][1] = 1;
  s.grid[1][0] = 2;
  s.grid[9][0] = 3; s.grid[9][1] = 3;
  s.selected = [[0, 0], [0, 1]];
  pop(s);
  assert.equal(s.grid[0][0], 2);
  assert.equal(s.grid[9][0], 0);
});

test('岩石：相邻引爆碎裂并 +50', () => {
  const s = createSim(1, 1);
  s.grid = empty();
  s.grid[0][0] = 1; s.grid[0][1] = 1;
  s.grid[1][0] = GAME.ROCK_TYPE;
  s.grid[9][0] = 3; s.grid[9][1] = 3;
  s.selected = [[0, 0], [0, 1]];
  pop(s);
  assert.equal(s.grid[1][0], 0);
  assert.equal(s.score, 2 * 2 * GAME.BASE_SCORE + GAME.ROCK_BONUS);
});

test('连击：窗口内连续引爆产生 combo 加成', () => {
  const s = createSim(1, 1);
  s.grid = empty();
  s.grid[0][0] = 1; s.grid[0][1] = 1;
  s.grid[0][3] = 2; s.grid[0][4] = 2;
  s.grid[9][0] = 3; s.grid[9][1] = 3;
  s.selected = [[0, 0], [0, 1]];
  pop(s);
  tick(s, 0.5);
  s.selected = [[0, 0], [0, 1]]; // 第二团已落下到 (0,0),(0,1)
  pop(s);
  assert.equal(s.combo, 2);
  assert.equal(s.score, (2 * 2 * 5) + (2 * 2 * 5 + GAME.COMBO_STEP));
  assert.ok(drainEvents(s).some((e) => e.type === 'combo'));
});

test('死局结算：无相邻同色时推进关卡并给出评级', () => {
  const s = createSim(1, 1);
  s.grid = empty();
  s.grid[0][0] = 1; s.grid[0][1] = 1;
  s.grid[0][2] = 1; s.grid[0][3] = 1;
  s.selected = [[0, 0], [0, 1], [0, 2], [0, 3]];
  pop(s); // 清空整板 → 完美
  const evs = drainEvents(s);
  assert.ok(evs.some((e) => e.type === 'perfect'));
  assert.ok(evs.some((e) => e.type === 'levelClear'));
});

test('完美清空：+PERFECT_BONUS', () => {
  const s = createSim(1, 1);
  s.grid = empty();
  s.grid[0][0] = 1; s.grid[0][1] = 1; s.grid[0][2] = 1; s.grid[0][3] = 1;
  s.selected = [[0, 0], [0, 1], [0, 2], [0, 3]];
  pop(s);
  assert.equal(s.score, 4 * 4 * 5 + GAME.PERFECT_BONUS);
});

test('三关战役：贪心打完到 won，且事件种类充足', () => {
  const s = createSim(1, 7);
  const seen = new Set();
  let guard = 0;
  while (s.phase === 'playing' && guard < 800) {
    guard += 1;
    const groups = allGroups(s.grid);
    if (!groups.length) break;
    groups.sort((a, b) => b.length - a.length);
    const g = groups[0];
    select(s, g[0][0], g[0][1]);
    pop(s);
    tick(s, 0.4);
    for (const e of drainEvents(s)) seen.add(e.type);
  }
  assert.equal(s.phase, 'won');
  assert.equal(s.level, GAME.MAX_LEVEL);
  assert.ok(seen.has('win'));
  assert.ok(seen.size >= 8);
});

test('countStars 统计正确', () => {
  const s = createSim(1, 1);
  s.grid = empty();
  s.grid[0][0] = 1; s.grid[0][1] = 5; s.grid[1][0] = GAME.ROCK_TYPE;
  assert.equal(countStars(s.grid), 2);
});

test('targetFor 随关卡递增', () => {
  assert.equal(targetFor(1), 4000);
  assert.ok(targetFor(3) > targetFor(2));
});
