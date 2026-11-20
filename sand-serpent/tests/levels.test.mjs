import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS, LEVEL_COUNT } from '../config/levels.js';
import { GAME } from '../config/game.config.js';

const SCENES = ['dunes', 'oasis', 'starlight'];

test('关卡表：12 关、index 连续、章节三分', () => {
  assert.equal(LEVEL_COUNT, 12);
  assert.equal(LEVELS.length, 12);
  LEVELS.forEach((lv, i) => assert.equal(lv.index, i + 1));
  assert.deepEqual(LEVELS.slice(0, 4).map((l) => l.scene), ['dunes', 'dunes', 'dunes', 'dunes']);
  assert.deepEqual(LEVELS.slice(4, 8).map((l) => l.scene), ['oasis', 'oasis', 'oasis', 'oasis']);
  assert.deepEqual(LEVELS.slice(8, 12).map((l) => l.scene), ['starlight', 'starlight', 'starlight', 'starlight']);
});

test('关卡表：字段完整且类型合法', () => {
  for (const lv of LEVELS) {
    assert.equal(lv.rows, 12);
    assert.equal(lv.cols, 20);
    assert.ok(lv.interval > 0);
    assert.ok(lv.goalLength > GAME.START_LENGTH);
    assert.ok(lv.foodCount >= 1 && lv.foodCount <= 2);
    assert.ok(SCENES.includes(lv.scene));
    assert.ok(['up', 'down', 'left', 'right'].includes(lv.start.dir));
    assert.equal(typeof lv.wrap, 'boolean');
    assert.equal(typeof lv.walls, 'boolean');
    assert.equal(typeof lv.scorpion, 'boolean');
    assert.equal(typeof lv.thorn, 'boolean');
    assert.equal(typeof lv.sandstorm, 'boolean');
    assert.equal(typeof lv.difficulty, 'number');
    assert.ok(lv.newElement && lv.newElement.length > 4);
  }
});

test('关卡表：start 与 3 节身体都在界内', () => {
  const DIRV = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };
  for (const lv of LEVELS) {
    const [dc, dr] = DIRV[lv.start.dir];
    for (let i = 0; i < GAME.START_LENGTH; i += 1) {
      const r = lv.start.r - dr * i;
      const c = lv.start.c - dc * i;
      assert.ok(r >= 0 && r < lv.rows && c >= 0 && c < lv.cols, `L${lv.index} 蛇身越界 (${r},${c})`);
    }
  }
});

test('关卡表：障碍（cacti/hard/boosts）在界内、内部、不压蛇身、互不重叠', () => {
  const body = new Set([`6,9`, `6,8`, `6,7`]);
  for (const lv of LEVELS) {
    const seen = new Set();
    const all = [...lv.cacti, ...lv.hard, ...lv.boosts];
    for (const [r, c] of all) {
      assert.ok(r >= 1 && r < lv.rows - 1, `L${lv.index} 障碍贴边 r=${r}`);
      assert.ok(c >= 1 && c < lv.cols - 1, `L${lv.index} 障碍贴边 c=${c}`);
      assert.ok(!body.has(`${r},${c}`), `L${lv.index} 障碍压蛇身 (${r},${c})`);
      assert.ok(!seen.has(`${r},${c}`), `L${lv.index} 障碍重叠 (${r},${c})`);
      seen.add(`${r},${c}`);
    }
  }
});

test('关卡表：L1 穿边无墙，其余有墙', () => {
  assert.equal(LEVELS[0].wrap, true);
  assert.equal(LEVELS[0].walls, false);
  for (let i = 1; i < 12; i += 1) {
    assert.equal(LEVELS[i].wrap, false);
    assert.equal(LEVELS[i].walls, true);
  }
});

test('关卡表：特性开关按关卡解锁（scorpion L4+ / thorn L9+ / sandstorm L8 与 L12 / 双食 L5+）', () => {
  for (const lv of LEVELS) {
    assert.equal(lv.scorpion, lv.index >= 4, `L${lv.index} scorpion`);
    assert.equal(lv.thorn, lv.index >= 9, `L${lv.index} thorn`);
    assert.equal(lv.foodCount, lv.index >= 5 ? 2 : 1, `L${lv.index} foodCount`);
  }
  assert.equal(LEVELS[7].sandstorm, true);
  assert.equal(LEVELS[11].sandstorm, true);
  assert.equal(LEVELS[0].sandstorm, false);
});

test('关卡表：目标长度单调递增', () => {
  for (let i = 1; i < 12; i += 1) {
    assert.ok(LEVELS[i].goalLength >= LEVELS[i - 1].goalLength, `L${i + 1} 目标长度倒挂`);
  }
});

test('关卡表：每关 newElement 唯一', () => {
  const els = LEVELS.map((l) => l.newElement);
  assert.equal(new Set(els).size, els.length);
});
