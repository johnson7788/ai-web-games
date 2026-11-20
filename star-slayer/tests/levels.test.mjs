import { test } from 'node:test';
import assert from 'node:assert/strict';
import { WAVES, WAVE_COUNT, waveAt, buildSpawnQueue, hpMult, ENEMY_TYPES, SCENES } from '../config/levels.js';
import { CARDS, drawChoices, cardById } from '../config/cards.js';
import { createRun } from '../src/game/sim.js';

test('12 波结构：每 3 波一个 Boss，三场景按 4 波换章', () => {
  assert.equal(WAVE_COUNT, 12);
  assert.equal(SCENES.length, 3);
  for (let i = 1; i <= 12; i += 1) {
    const w = waveAt(i);
    assert.equal(w.wave, i);
    assert.equal(!!w.boss, i % 3 === 0, `wave ${i} boss 标记错误`);
    const expectScene = i <= 4 ? 0 : i <= 8 ? 1 : 2;
    assert.equal(w.scene, expectScene, `wave ${i} 场景错误`);
  }
});

test('生成队列：Boss 波先出 Boss，普通波数量正确', () => {
  const q1 = buildSpawnQueue(1);
  assert.equal(q1.length, 6);
  assert.equal(q1[0].type, 'raider');
  const q3 = buildSpawnQueue(3);
  assert.equal(q3[0].type, 'boss');
  assert.equal(q3.length, 4); // boss + 3 raider
});

test('血量倍率随波次递增', () => {
  assert.equal(hpMult(1), 1);
  assert.ok(hpMult(12) > hpMult(1));
});

test('敌型齐全：5 类 + Boss 都有 hp/速度/接触伤害', () => {
  for (const t of ['raider', 'striker', 'weaver', 'shuttle', 'turret', 'boss']) {
    const e = ENEMY_TYPES[t];
    assert.ok(e.hp > 0, t);
    assert.ok(e.speed >= 0, t);
    assert.ok(e.touchDmg >= 0, t);
  }
});

test('卡牌 ≥8 且规则型占比 ≥35%', () => {
  assert.ok(CARDS.length >= 8);
  const rule = CARDS.filter((c) => c.kind === 'rule').length;
  assert.ok(rule / CARDS.length >= 0.35);
});

test('drawChoices 返回 3 张不同且可应用', () => {
  const run = createRun({ seed: 1 });
  const picks = drawChoices(run, run.rng);
  assert.equal(picks.length, 3);
  assert.equal(new Set(picks.map((p) => p.id)).size, 3);
  for (const p of picks) {
    assert.equal(typeof p.apply, 'function');
    assert.equal(typeof p.descKey, 'string');
  }
});

test('stat 卡应用后数值变化', () => {
  const run = createRun({ seed: 2 });
  const before = run.mods.dmgMul;
  cardById('bigMag').apply(run);
  assert.ok(run.mods.dmgMul > before);
  cardById('rapidFire').apply(run);
  assert.ok(run.mods.fireIntervalMul < 1);
  cardById('movespeed').apply(run);
  assert.ok(run.mods.speedMul > 1);
});

test('rule 卡应用后挂到 run.cards', () => {
  const run = createRun({ seed: 3 });
  cardById('pierce').apply(run);
  assert.equal(run.cards.pierce, true);
  cardById('twinCore').apply(run);
  assert.equal(run.cards.twinCore, true);
});
