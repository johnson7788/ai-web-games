import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS, LEVEL_COUNT } from '../config/levels.js';

test('12 关，index 连续', () => {
  assert.equal(LEVEL_COUNT, 12);
  LEVELS.forEach((lv, i) => assert.equal(lv.index, i + 1));
});

test('三场景包各占 4 关：mist/rain/snow 顺序', () => {
  for (let i = 0; i < 12; i += 1) {
    const expect = i < 4 ? 'mist' : i < 8 ? 'rain' : 'snow';
    assert.equal(LEVELS[i].scene, expect, `L${i + 1} scene`);
  }
});

test('每关 newElement/feature 唯一且非空', () => {
  const feats = LEVELS.map((l) => l.feature);
  assert.equal(new Set(feats).size, feats.length);
  for (const f of feats) assert.ok(f && f.trim().length);
});

test('每关 name 含 en 与 zh', () => {
  for (const lv of LEVELS) {
    assert.ok(lv.name.en && lv.name.zh, `L${lv.index} name`);
  }
});

test('目标分单调不减且 ≥5', () => {
  for (const lv of LEVELS) assert.ok(lv.target >= 5, `L${lv.index} target`);
  for (let i = 1; i < LEVELS.length; i += 1) {
    assert.ok(LEVELS[i].target >= LEVELS[i - 1].target, `L${i + 1} target 下降`);
  }
});

test('缝几何合法：gapH>0 且缝不越界', () => {
  for (const lv of LEVELS) {
    assert.ok(lv.gapH > 100, `L${lv.index} gapH`);
    assert.ok(lv.gapYMin >= 140 && lv.gapYMax <= 510, `L${lv.index} gap 范围`);
    assert.ok(lv.scroll >= 150 && lv.spacing >= 240, `L${lv.index} 卷轴`);
  }
});

test('气流关才有 glideGravity', () => {
  for (const lv of LEVELS) {
    const hasGlide = lv.feature.includes('updraft') || lv.feature === 'master';
    assert.equal(lv.glideGravity > 0, hasGlide, `L${lv.index} glide`);
  }
});

test('逆风关才有 windVx + flapVx', () => {
  for (const lv of LEVELS) {
    const hasWind = lv.feature.includes('wind') || lv.feature === 'master';
    assert.equal(lv.windVx > 0, hasWind, `L${lv.index} wind`);
    assert.equal(lv.flapVx > 0, hasWind, `L${lv.index} flapVx`);
  }
});

test('双缝关才有 doubleGap 参数', () => {
  for (const lv of LEVELS) {
    const hasDouble = lv.feature.includes('doubleGap') || lv.feature === 'master';
    assert.equal(lv.doubleGap, hasDouble, `L${lv.index} doubleGap`);
  }
});

test('转轮关才有 wheel 参数且半径 < 半缝', () => {
  for (const lv of LEVELS) {
    const hasWheel = lv.feature.includes('wheel') || lv.feature === 'master';
    assert.equal(lv.wheel, hasWheel, `L${lv.index} wheel`);
    if (lv.wheel) assert.ok(lv.wheelR > 0 && lv.wheelR < lv.gapH / 2, `L${lv.index} wheelR`);
  }
});
