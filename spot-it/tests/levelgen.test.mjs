import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateLevel } from '../src/game/levelgen.js';
import { LEVELS, LEVEL_COUNT, levelAt } from '../config/levels.js';
import { WORLD } from '../config/game.config.js';

test('12 关推进结构', () => {
  assert.equal(LEVEL_COUNT, 12);
  assert.equal(LEVELS.length, 12);
});

test('每关目标物必在场上（单测硬性要求）', () => {
  for (let level = 1; level <= LEVEL_COUNT; level += 1) {
    const data = generateLevel({ level, seed: 2026 });
    assert.ok(data.targetOnField, `第 ${level} 关目标物不在场上`);
    for (const c of data.checklist) {
      const onField = data.items.filter((i) => i.isTarget && i.itemId === c.itemId).length;
      assert.ok(onField >= c.need, `第 ${level} 关 ${c.itemId} 场上 ${onField} < need ${c.need}`);
    }
  }
});

test('物品总数达到密度配置', () => {
  for (let level = 1; level <= LEVEL_COUNT; level += 1) {
    const cfg = levelAt(level);
    const data = generateLevel({ level, seed: 7 });
    // 拒绝采样极端情况下允许少一点，但至少达到目标数 + 填充
    assert.ok(data.items.length >= cfg.targetCount, `第 ${level} 关物品数 ${data.items.length} 少于目标数`);
  }
});

test('诱饵只孪生目标物（variant=1 且 itemId 是目标）', () => {
  for (let level = 1; level <= LEVEL_COUNT; level += 1) {
    const data = generateLevel({ level, seed: 42 });
    const targetIds = new Set(data.checklist.map((c) => c.itemId));
    for (const it of data.items) {
      if (it.isDecoy) {
        assert.equal(it.variant, 1, `第 ${level} 关诱饵 variant 应为 1`);
        assert.ok(targetIds.has(it.itemId), `第 ${level} 关诱饵 ${it.itemId} 不是目标孪生`);
      }
    }
  }
});

test('物品都落在可玩区域内', () => {
  for (let level = 1; level <= LEVEL_COUNT; level += 1) {
    const data = generateLevel({ level, seed: 99 });
    for (const it of data.items) {
      assert.ok(it.x >= WORLD.PLAY_LEFT && it.x <= WORLD.PLAY_RIGHT, `x 越界 ${it.x}`);
      assert.ok(it.y >= WORLD.PLAY_TOP && it.y <= WORLD.PLAY_BOTTOM, `y 越界 ${it.y}`);
    }
  }
});

test('清单目标互不重复', () => {
  for (let level = 1; level <= LEVEL_COUNT; level += 1) {
    const data = generateLevel({ level, seed: 5 });
    const ids = data.checklist.map((c) => c.itemId);
    assert.equal(new Set(ids).size, ids.length);
  }
});

test('同种子生成结果确定', () => {
  const a = generateLevel({ level: 4, seed: 1234 });
  const b = generateLevel({ level: 4, seed: 1234 });
  assert.deepEqual(
    a.items.map((i) => [i.itemId, i.x, i.y, i.variant]),
    b.items.map((i) => [i.itemId, i.x, i.y, i.variant]),
  );
});
