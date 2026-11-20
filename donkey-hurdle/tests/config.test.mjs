// tests/config.test.mjs — 配置完整性：语言 key 一致 / 设计源结构 / 数值约束
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { locales } from '../config/locales.js';
import { CONFIG } from '../config/game.config.js';
import { SEGMENTS } from '../config/levels.js';
import { DONKEY, JARS, SPEED } from '../config/gameplay.js';

const HERE = dirname(fileURLToPath(import.meta.url));

test('默认英文且 en/zh 都存在', () => {
  assert.equal(CONFIG.defaultLang, 'en');
  assert.ok(locales.en && locales.zh);
});

test('en 与 zh 的 key 完全一致', () => {
  const en = Object.keys(locales.en).sort();
  const zh = Object.keys(locales.zh).sort();
  assert.deepEqual(zh, en);
});

test('没有空文案', () => {
  for (const lang of ['en', 'zh']) {
    for (const [k, v] of Object.entries(locales[lang])) {
      assert.ok(typeof v === 'string' && v.trim().length > 0, `${lang}.${k} 为空`);
    }
  }
});

test('design.json 结构满足 fun-audit 关键项', () => {
  const d = JSON.parse(readFileSync(join(HERE, '..', 'config', 'design.json'), 'utf8'));
  assert.ok(d.verbs.length >= 1 && d.verbs.length <= 3);
  assert.ok(d.decisions.filter((x) => x.atSec <= 180).length >= 6);
  assert.ok(d.levels.length >= 12);
  assert.ok(d.upgrades.length >= 8);
  assert.ok(d.replayHooks.length >= 2);
  assert.ok(d.verbs.every((v) => v.cost && v.feedback.length >= 2));
});

test('物理常数在合理范围（可玩性单测）', () => {
  assert.ok(DONKEY.JUMP_V < 0);
  assert.ok(DONKEY.GRAVITY > 0);
  assert.ok(DONKEY.JUMP_CUT > 0 && DONKEY.JUMP_CUT < 1);
  assert.ok(JARS.START >= 1 && JARS.MAX >= JARS.START);
  assert.ok(SPEED.BASE > 0 && SPEED.MAX_MULT > 1);
});
