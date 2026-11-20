import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS, LEVEL_COUNT, BOOST } from '../config/levels.js';
import { generatePlatforms, solveLaunch } from '../src/game/level.js';
import { PHYS } from '../config/game.config.js';

const SCENES = ['dawn', 'noon', 'night'];
const KINDS = ['pod', 'pumpkin', 'basket', 'broken'];

test('关卡表：12 关、index 连续、场景三段均匀分布', () => {
  assert.equal(LEVEL_COUNT, 12);
  assert.equal(LEVELS.length, 12);
  LEVELS.forEach((lv, i) => assert.equal(lv.index, i + 1));
  assert.equal(LEVELS[0].scene, 'dawn');
  assert.equal(LEVELS[4].scene, 'noon');
  assert.equal(LEVELS[8].scene, 'night');
});

test('关卡表：字段完整且类型合法', () => {
  for (const lv of LEVELS) {
    assert.ok(lv.goalJumps >= 4);
    assert.ok(lv.perfectGoal >= 1);
    assert.ok(lv.gapMin > 0 && lv.gapMax >= lv.gapMin);
    assert.ok(lv.yMin < lv.yMax);
    assert.ok(lv.width > 0);
    assert.ok(SCENES.includes(lv.scene));
    assert.ok(typeof lv.wind === 'number' && lv.wind > 0);
    assert.ok(['pod', 'pumpkin', 'basket', 'broken'].every((k) => !(k in lv.kinds) || typeof lv.kinds[k] === 'number'));
    assert.equal(typeof lv.moving, 'boolean');
    assert.equal(typeof lv.broken, 'boolean');
    assert.equal(typeof lv.twoTier, 'boolean');
    assert.ok(lv.newElement && lv.newElement.trim().length > 0);
  }
});

test('关卡表：每关 newElement 不重复', () => {
  const els = LEVELS.map((lv) => lv.newElement.trim());
  assert.equal(new Set(els).size, els.length);
});

test('BOOST：平台类型倍率合法', () => {
  assert.equal(BOOST.pod, 1);
  assert.equal(BOOST.pumpkin, 1.3);
  assert.equal(BOOST.basket, 0.7);
  assert.equal(BOOST.broken, 1);
});

test('平台生成：每个平台类型都在合法集合内、platforms 覆盖 goalJumps+5', () => {
  for (const lv of LEVELS) {
    for (const seed of [3, 5, 11]) {
      const plats = generatePlatforms(lv, seed);
      assert.equal(plats.length, lv.goalJumps + 5);
      for (const p of plats) {
        assert.ok(KINDS.includes(p.kind), `非法平台类型 ${p.kind}`);
        assert.ok(p.w > 0);
      }
    }
  }
});

test('可解性：任意关卡的相邻平台（含弹力/风力）都可用 solveLaunch 命中', () => {
  for (const lv of LEVELS) {
    for (const seed of [3, 5, 11, 42]) {
      const plats = generatePlatforms(lv, seed);
      let boost = BOOST.pod;
      for (let i = 1; i < plats.length; i += 1) {
        const dx = plats[i].wx - plats[i - 1].wx;
        const dy = plats[i].wy - plats[i - 1].wy;
        const vCap = PHYS.MAX_SPEED * (lv.wind ?? 1) * boost;
        const eff = solveLaunch(dx, dy, PHYS.GRAVITY, vCap);
        assert.ok(eff, `L${lv.index} seed${seed} 平台 ${i} 不可达（dx=${dx.toFixed(0)} dy=${dy.toFixed(0)} vCap=${vCap.toFixed(0)}）`);
        boost = BOOST[plats[i].kind] || 1;
      }
    }
  }
});

test('断藤关：broken 平台只出现在 broken=true 的关卡', () => {
  for (const lv of LEVELS) {
    const plats = generatePlatforms(lv, 3);
    for (const p of plats) {
      if (p.broken) assert.equal(lv.broken, true, `L${lv.index} 出现断藤但 broken=false`);
    }
  }
});

test('移动关：moving 平台只出现在 moving=true 的关卡', () => {
  for (const lv of LEVELS) {
    const plats = generatePlatforms(lv, 3);
    for (const p of plats) {
      if (p.moving) assert.equal(lv.moving, true, `L${lv.index} 出现移动平台但 moving=false`);
    }
  }
});
