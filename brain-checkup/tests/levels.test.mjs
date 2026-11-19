import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS, LEVEL_COUNT } from '../config/levels.js';

test('共 30 关且 id 连续', () => {
  assert.equal(LEVEL_COUNT, 30);
  LEVELS.forEach((lv, i) => assert.equal(lv.id, i + 1));
});

test('有答案的关（choice/select/input）都带 answer', () => {
  for (const lv of LEVELS) {
    if (lv.kind === 'choice' || lv.kind === 'select' || lv.kind === 'input') {
      assert.notEqual(lv.answer, undefined, `L${lv.id} 缺 answer`);
    }
  }
});

test('choice/select 的 options 中英都有且 answer 在范围内', () => {
  for (const lv of LEVELS) {
    if (lv.kind === 'choice' || lv.kind === 'select') {
      assert.ok(Array.isArray(lv.options.en) && Array.isArray(lv.options.zh), `L${lv.id} options 缺中英`);
      assert.ok(lv.answer >= 0 && lv.answer < lv.options.en.length, `L${lv.id} answer 越界`);
    }
  }
});

test('hold 关有 holdSec，timing 关有 sweet 区间，drag 关有方向与阈值', () => {
  for (const lv of LEVELS) {
    if (lv.kind === 'hold') assert.ok(lv.holdSec > 0, `L${lv.id} 缺 holdSec`);
    if (lv.kind === 'timing') assert.ok(lv.sweetMin >= 0 && lv.sweetMax <= 1, `L${lv.id} sweet 区间非法`);
    if (lv.kind === 'drag') assert.ok(lv.direction && lv.threshold > 0, `L${lv.id} drag 参数缺`);
  }
});

test('提示文案中英完整', () => {
  for (const lv of LEVELS) {
    assert.ok(lv.hint?.en && lv.hint?.zh, `L${lv.id} 缺 hint`);
  }
});
