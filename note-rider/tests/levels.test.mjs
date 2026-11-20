import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS, LEVEL_COUNT, SCENES } from '../config/levels.js';
import { SKILLS, GAME } from '../config/game.config.js';
import { createRun } from '../src/game/sim.js';

test('关卡表：12 关、index 连续', () => {
  assert.equal(LEVEL_COUNT, 12);
  assert.equal(LEVELS.length, 12);
  LEVELS.forEach((lv, i) => assert.equal(lv.index, i + 1));
});

test('关卡表：字段完整且类型合法', () => {
  for (const lv of LEVELS) {
    assert.ok(SCENES.includes(lv.scene), `L${lv.index} scene 非法`);
    assert.ok(lv.bpm >= 80 && lv.bpm <= 160);
    assert.ok(lv.chartDuration > 30);
    assert.ok(lv.leadTime > 0);
    assert.ok(lv.lanes === 1 || lv.lanes === 2);
    assert.ok(lv.noteDensity > 0 && lv.noteDensity <= 1);
    assert.equal(typeof lv.features.hold, 'boolean');
    assert.equal(typeof lv.features.red, 'boolean');
    assert.equal(typeof lv.features.double, 'boolean');
    assert.ok(lv.bossHp >= 1);
    assert.ok(lv.noteDamage > 0);
    assert.ok(lv.bossDamage > 0);
    assert.equal(typeof lv.skillSelect, 'boolean');
    assert.ok(lv.name && lv.name.en && lv.name.zh);
    assert.ok(lv.newElement && lv.newElement.trim());
  }
});

test('三章场景分配：L1-4 dawn、L5-8 rain、L9-12 star', () => {
  for (const lv of LEVELS) {
    const expect = lv.index <= 4 ? 'dawn' : lv.index <= 8 ? 'rain' : 'star';
    assert.equal(lv.scene, expect, `L${lv.index} 场景错误`);
  }
});

test('特性渐进：L1 无 hold/red/double，L2 起 hold，L3 起双弦，L4 起 red，L7 起 double', () => {
  assert.equal(LEVELS[0].features.hold, false);
  assert.equal(LEVELS[0].features.red, false);
  assert.equal(LEVELS[0].features.double, false);
  assert.equal(LEVELS[0].lanes, 1);
  assert.equal(LEVELS[1].features.hold, true);
  assert.equal(LEVELS[2].lanes, 2);
  assert.equal(LEVELS[3].features.red, true);
  assert.equal(LEVELS[6].features.double, true);
});

test('技能升级点：L5/L8/L11 skillSelect=true，其余 false', () => {
  for (const lv of LEVELS) {
    assert.equal(lv.skillSelect, lv.index === 5 || lv.index === 8 || lv.index === 11);
  }
});

test('变速乐章：仅 L6 tempoShift=true', () => {
  for (const lv of LEVELS) {
    assert.equal(lv.tempoShift, lv.index === 6);
  }
});

test('难度递增：bossHp 单调不减，BPM 单调不减', () => {
  for (let i = 1; i < LEVEL_COUNT; i += 1) {
    assert.ok(LEVELS[i].bossHp >= LEVELS[i - 1].bossHp, `L${i + 1} bossHp 回退`);
    assert.ok(LEVELS[i].bpm >= LEVELS[i - 1].bpm, `L${i + 1} bpm 回退`);
  }
});

test('技能表：护盾/爆发/吸血/治疗 4 个还原，字段齐全', () => {
  for (const id of ['shield', 'burst', 'lifesteal', 'heal']) {
    const s = SKILLS[id];
    assert.ok(s, `缺技能 ${id}`);
    assert.ok(s.cost >= 1 && s.cooldown >= 1);
  }
});

test('判定窗：perfect < great < good 且为正', () => {
  const w = GAME.HIT_WINDOWS;
  assert.ok(w.perfect > 0 && w.great > w.perfect && w.good > w.great);
});

test('谱面可解性：每关生成的谱面都存在至少一条 tap 且总 note 数 > 0', () => {
  for (let i = 0; i < LEVEL_COUNT; i += 1) {
    const r = createRun(i, { seed: 5 });
    assert.ok(r.state.notes.length > 0, `L${i + 1} 谱面为空`);
    assert.ok(r.state.notes.some((n) => n.type === 'tap' || n.type === 'hold'), `L${i + 1} 无可击打 note`);
  }
});
