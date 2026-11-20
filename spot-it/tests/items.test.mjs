import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ITEMS, ITEMS_BY_ID, CATEGORIES, itemById, itemLabel } from '../config/items.js';

const SHAPE_KINDS = new Set(['c', 'e', 'r', 'p', 'l', 'a']);

test('物品库 ≥40 种', () => {
  assert.ok(ITEMS.length >= 40, `只有 ${ITEMS.length} 种`);
});

test('物品 id 唯一', () => {
  const ids = ITEMS.map((i) => i.id);
  assert.equal(new Set(ids).size, ids.length);
});

test('每个物品都有 en/zh 名字与合法分类', () => {
  for (const it of ITEMS) {
    assert.ok(it.en && it.en.trim(), `${it.id} 缺英文名`);
    assert.ok(it.zh && it.zh.trim(), `${it.id} 缺中文名`);
    assert.ok(CATEGORIES[it.cat], `${it.id} 分类非法：${it.cat}`);
    assert.ok(it.s > 0, `${it.id} 尺寸非法`);
  }
});

test('每个物品至少一个 accent 细节（孪生诱饵可判定）', () => {
  for (const it of ITEMS) {
    const accents = it.shapes.filter((s) => s.a === 1);
    assert.ok(accents.length >= 1, `${it.id} 没有 accent 细节，诱饵无法区分`);
  }
});

test('每个 shape 类型合法、坐标有限', () => {
  for (const it of ITEMS) {
    for (const sh of it.shapes) {
      assert.ok(SHAPE_KINDS.has(sh.k), `${it.id} 未知 shape 类型 ${sh.k}`);
      if (sh.k === 'p') {
        assert.ok(Array.isArray(sh.pts) && sh.pts.length >= 3, `${it.id} polygon 顶点不足`);
      }
    }
  }
});

test('itemById / itemLabel 正常', () => {
  assert.ok(itemById('cat'));
  assert.equal(itemById('不存在'), null);
  assert.equal(itemLabel('cat', 'zh'), '猫');
  assert.equal(itemLabel('cat', 'en'), 'Cat');
  assert.equal(itemLabel('cat', 'fr'), 'Cat'); // 未知语言回退英文
});

test('ITEMS_BY_ID 覆盖全部物品', () => {
  assert.equal(ITEMS_BY_ID.size, ITEMS.length);
});
