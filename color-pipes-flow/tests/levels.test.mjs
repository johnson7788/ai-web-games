import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS, LEVEL_COUNT } from '../config/levels.js';

test('共 12 关', () => {
  assert.equal(LEVEL_COUNT, 12);
});

test('每个关卡：正解路径覆盖全部非岩石格且互不相交', () => {
  for (const level of LEVELS) {
    const total = level.rows * level.cols;
    const covered = new Set();
    const rockSet = new Set(level.rocks.map(([r, c]) => `${r},${c}`));

    for (const pair of level.pairs) {
      // 路径首尾分别是两个端口
      assert.deepEqual(pair.path[0], pair.a, `L${level.index} pair ${pair.id} 首端`);
      assert.deepEqual(pair.path[pair.path.length - 1], pair.b, `L${level.index} pair ${pair.id} 尾端`);

      for (let i = 0; i < pair.path.length; i += 1) {
        const [r, c] = pair.path[i];
        const k = `${r},${c}`;
        assert.ok(!rockSet.has(k), `L${level.index} 路径不能经过岩石`);
        assert.ok(!covered.has(k), `L${level.index} 路径不能重叠`);
        covered.add(k);
        if (i > 0) {
          const [pr, pc] = pair.path[i - 1];
          const dist = Math.abs(r - pr) + Math.abs(c - pc);
          assert.equal(dist, 1, `L${level.index} 路径相邻`);
        }
      }
    }

    // 覆盖数 = 总格 - 岩石数
    assert.equal(covered.size, total - level.rocks.length, `L${level.index} 覆盖全部非岩石格`);
  }
});

test('每个关卡：端口两两颜色唯一且端口不在岩石上', () => {
  for (const level of LEVELS) {
    const rockSet = new Set(level.rocks.map(([r, c]) => `${r},${c}`));
    const seen = new Set();
    for (const pair of level.pairs) {
      assert.ok(!seen.has(pair.id), `L${level.index} id 唯一`);
      seen.add(pair.id);
      assert.ok(!rockSet.has(`${pair.a[0]},${pair.a[1]}`), `L${level.index} 端口 a 不在岩石上`);
      assert.ok(!rockSet.has(`${pair.b[0]},${pair.b[1]}`), `L${level.index} 端口 b 不在岩石上`);
    }
    assert.equal(level.pairs.length, level.colorCount, `L${level.index} colorCount 一致`);
  }
});

test('每个关卡：空格数 = 总格 - 岩石 - 端口数×2', () => {
  for (const level of LEVELS) {
    const expect = level.rows * level.cols - level.rocks.length - level.pairs.length * 2;
    assert.equal(level.emptyCount, expect, `L${level.index} emptyCount`);
    assert.ok(level.emptyCount >= level.pairs.length, `L${level.index} 至少每条管道有空格可填`);
  }
});
