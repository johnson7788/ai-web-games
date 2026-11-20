import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS, LEVEL_COUNT } from '../config/levels.js';

const SCENES = ['dawn', 'lantern', 'storm'];

test('12 关，index 连续从 1 开始', () => {
  assert.equal(LEVEL_COUNT, 12);
  LEVELS.forEach((lv, i) => assert.equal(lv.index, i + 1));
});

test('每关场景合法且三场景包各有分布', () => {
  const used = new Set(LEVELS.map((lv) => lv.scene));
  for (const s of SCENES) assert.ok(used.has(s), `缺场景 ${s}`);
  for (const lv of LEVELS) assert.ok(SCENES.includes(lv.scene));
});

test('每关 newElement 唯一且非空', () => {
  const elems = LEVELS.map((lv) => lv.newElement);
  for (const e of elems) assert.ok(e && e.trim().length > 0);
  assert.equal(new Set(elems).size, elems.length);
});

test('每关 feature 唯一', () => {
  const feats = LEVELS.map((lv) => lv.feature);
  assert.equal(new Set(feats).size, feats.length);
});

test('BPM 90–140 且整体递增（允许变速段带 bpm2）', () => {
  for (const lv of LEVELS) {
    assert.ok(lv.bpm >= 90 && lv.bpm <= 140);
    if (lv.bpm2) assert.ok(lv.bpm2 > lv.bpm);
  }
  for (let i = 1; i < LEVELS.length; i += 1) {
    assert.ok(LEVELS[i].bpm >= LEVELS[i - 1].bpm);
  }
});

test('轨道数 1–3，单轨仅第 1 关', () => {
  assert.equal(LEVELS[0].lanes, 1);
  assert.equal(LEVELS[1].lanes, 2);
  for (let i = 2; i < LEVELS.length; i += 1) assert.equal(LEVELS[i].lanes, 3);
});

test('每关目标连击为正且递增', () => {
  for (let i = 0; i < LEVELS.length; i += 1) {
    assert.ok(LEVELS[i].targetCombo > 0);
    if (i > 0) assert.ok(LEVELS[i].targetCombo > LEVELS[i - 1].targetCombo);
  }
});
