import { test } from 'node:test';
import assert from 'node:assert/strict';
import { IDIOMS_ZH, WORDS_EN, RIDDLES_ZH } from '../config/idioms.js';
import { WEAPONS, WEAPON_COUNT } from '../config/weapons.js';
import { LEVELS, LEVEL_COUNT } from '../config/levels.js';

function dup(arr, key) {
  const seen = new Set();
  const out = [];
  for (const x of arr) {
    if (seen.has(x[key])) out.push(x[key]);
    seen.add(x[key]);
  }
  return out;
}

test('词库规模：≥200 成语 + ≥150 英文词', () => {
  assert.ok(IDIOMS_ZH.length >= 200, `成语 ${IDIOMS_ZH.length}`);
  assert.ok(WORDS_EN.length >= 150, `英文词 ${WORDS_EN.length}`);
});

test('成语：无重复、恰好 4 字、释义非空', () => {
  assert.deepEqual(dup(IDIOMS_ZH, 'text'), []);
  for (const i of IDIOMS_ZH) {
    assert.equal([...i.text].length, 4, i.text);
    assert.ok(typeof i.meaning === 'string' && i.meaning.trim().length > 0, `释义空：${i.text}`);
  }
});

test('英文词：无重复、恰好 4 个字母、释义非空', () => {
  assert.deepEqual(dup(WORDS_EN, 'text'), []);
  for (const w of WORDS_EN) {
    assert.match(w.text, /^[A-Z]{4}$/, w.text);
    assert.ok(typeof w.meaning === 'string' && w.meaning.trim().length > 0, `释义空：${w.text}`);
  }
});

test('字谜：无重复、答案为单字', () => {
  assert.deepEqual(dup(RIDDLES_ZH, 'answer'), []);
  for (const r of RIDDLES_ZH) {
    assert.equal([...r.answer].length, 1, r.answer);
    assert.ok(r.clue && r.clue.trim().length > 0, `谜面空：${r.answer}`);
  }
});

test('十二神兵：恰好 12 件、id 唯一、剪影折线归一化在 0..1', () => {
  assert.equal(WEAPON_COUNT, 12);
  assert.deepEqual(dup(WEAPONS, 'id'), []);
  for (const w of WEAPONS) {
    assert.ok(w.en && w.zh, `兵器名缺失：${w.id}`);
    assert.ok(Array.isArray(w.shapes) && w.shapes.length > 0, `剪影缺失：${w.id}`);
    for (const poly of w.shapes) {
      for (const [x, y] of poly) {
        assert.ok(x >= 0 && x <= 1 && y >= 0 && y <= 1, `坐标越界：${w.id} ${x},${y}`);
      }
    }
  }
});

test('12 关推进：题量/缺字数/字格数合法', () => {
  assert.equal(LEVEL_COUNT, 12);
  for (const l of LEVELS) {
    assert.ok(l.questions >= 8 && l.questions <= 12, `题量异常 L${l.index}`);
    assert.ok(l.blanks === 1 || l.blanks === 2, `缺字数异常 L${l.index}`);
    assert.ok(l.gridSize >= 8 && l.gridSize <= 14, `字格数异常 L${l.index}`);
    assert.ok([0, 1, 2].includes(l.scene), `场景异常 L${l.index}`);
    assert.ok(l.time > 0, `时间异常 L${l.index}`);
  }
});
