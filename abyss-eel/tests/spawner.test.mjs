import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mulberry32, randInt } from '../src/game/rng.js';
import { wallValueAt, WALL, WORLD, BOSS, URCHIN } from '../config/gameplay.js';
import { ZONES, ZONE_COUNT, zoneIndex, zoneAt } from '../config/levels.js';
import {
  wallValueFor, spawnSingle, spawnGap, spawnCorridor, spawnFork, spawnUrchins, spawnBossSpecs, spawnWave, spawnMoving,
} from '../src/game/spawner.js';

// ---------- rng ----------
test('mulberry32 同 seed 同序列，取值 [0,1)', () => {
  const a = mulberry32(99);
  const b = mulberry32(99);
  for (let i = 0; i < 10; i += 1) {
    const v = a();
    assert.equal(v, b());
    assert.ok(v >= 0 && v < 1);
  }
});

test('mulberry32 不同 seed 不同序列', () => {
  const a = mulberry32(1);
  const b = mulberry32(2);
  const seqA = [a(), a(), a()];
  const seqB = [b(), b(), b()];
  assert.notDeepEqual(seqA, seqB);
});

test('randInt 在闭区间内', () => {
  const rng = mulberry32(7);
  for (let i = 0; i < 50; i += 1) {
    const v = randInt(rng, 3, 5);
    assert.ok(v >= 3 && v <= 5);
  }
});

// ---------- 墙值公式 ----------
test('wallValueAt 深度 0 → 1；大深度 clamp 到 60', () => {
  assert.equal(wallValueAt(0, mulberry32(1)), 1);
  assert.equal(wallValueAt(100000, mulberry32(2)), WALL.MAX);
  const mid = wallValueAt(5000, mulberry32(3));
  assert.ok(mid >= WALL.MIN && mid <= WALL.MAX);
});

// ---------- 深度带 ----------
test('zoneIndex/zoneAt 五带边界', () => {
  const cases = [
    [0, 1], [299, 1], [300, 2], [699, 2], [700, 3],
    [1199, 3], [1200, 4], [1799, 4], [1800, 5], [2099, 5], [2100, 5], [9999, 5],
  ];
  for (const [depth, zi] of cases) {
    assert.equal(zoneIndex(depth), zi, `depth=${depth}`);
    assert.equal(zoneAt(depth).index, zi);
  }
  assert.equal(ZONE_COUNT, 5);
  assert.deepEqual(ZONES.map((z) => z.scroll), [140, 165, 190, 215, 240]);
});

// ---------- 生成模式 ----------
test('spawnSingle：一堵珊瑚墙，值在带范围内且不越界', () => {
  const zone = ZONES[0];
  const rng = mulberry32(5);
  for (let i = 0; i < 20; i += 1) {
    const { walls } = spawnSingle(rng, zone, 100, 2000);
    assert.equal(walls.length, 1);
    const w = walls[0];
    assert.equal(w.kind, 'coral');
    assert.ok(w.value >= zone.wallValue[0] && w.value <= zone.wallValue[1]);
    assert.ok(w.x >= 0 && w.x + w.w <= WORLD.WIDTH);
  }
});

test('spawnMoving：移动墙带 vx', () => {
  const zone = ZONES[1];
  const { walls } = spawnMoving(mulberry32(6), zone, 400, 4000);
  assert.equal(walls[0].moving, true);
  assert.notEqual(walls[0].vx, 0);
});

test('spawnGap：两墙留缝，缝宽 ≥200', () => {
  const zone = ZONES[1];
  const { walls } = spawnGap(mulberry32(7), zone, 400, 4000);
  assert.equal(walls.length, 2);
  const sorted = [...walls].sort((a, b) => a.x - b.x);
  const gap = sorted[1].x - (sorted[0].x + sorted[0].w);
  assert.ok(gap >= 200, `gap=${gap}`);
  assert.equal(sorted[0].x, 0);
  assert.equal(sorted[1].x + sorted[1].w, WORLD.WIDTH);
});

test('spawnCorridor：窄缝 + ≥3 串珠食物', () => {
  const zone = ZONES[2];
  const { walls, foods } = spawnCorridor(mulberry32(8), zone, 800, 8000);
  assert.equal(walls.length, 2);
  assert.ok(foods.length >= 3);
  for (const f of foods) assert.ok(f.kind === 'spark' || f.kind === 'gold');
});

test('spawnFork：三墙两条缝，各放食物', () => {
  const zone = ZONES[3];
  const { walls, foods } = spawnFork(mulberry32(9), zone, 1400, 14000);
  assert.equal(walls.length, 3);
  assert.equal(foods.length, 2);
  const sorted = [...walls].sort((a, b) => a.x - b.x);
  const g1 = sorted[1].x - (sorted[0].x + sorted[0].w);
  const g2 = sorted[2].x - (sorted[1].x + sorted[1].w);
  assert.ok(g1 >= 150 && g2 >= 150, `gaps=${g1},${g2}`);
});

test('spawnUrchins：2–4 只海胆，value=999', () => {
  const zone = ZONES[3];
  const { walls } = spawnUrchins(mulberry32(10), zone, 1400, 14000);
  assert.ok(walls.length >= 2 && walls.length <= 4);
  for (const w of walls) {
    assert.equal(w.kind, 'urchin');
    assert.equal(w.value, URCHIN.VALUE);
  }
});

test('spawnBossSpecs：5 段铺满 1280，每段 = 带墙值×8', () => {
  const rng = mulberry32(11);
  const parts = spawnBossSpecs(rng, 2100, 21000);
  assert.equal(parts.length, BOSS.SEGMENTS);
  const totalW = parts.reduce((s, p) => s + p.w, 0);
  assert.equal(totalW, WORLD.WIDTH);
  const base = wallValueFor(rng, 2100, zoneAt(2100));
  for (let i = 0; i < parts.length; i += 1) {
    assert.equal(parts[i].kind, 'bossPart');
    assert.equal(parts[i].partIndex, i);
    assert.equal(parts[i].value, base * BOSS.VALUE_MULT);
  }
});

test('spawnWave：按带模式返回 walls/foods 数组', () => {
  const zone = ZONES[1];
  const { walls, foods } = spawnWave(mulberry32(12), zone, 400, 4000);
  assert.ok(Array.isArray(walls) && Array.isArray(foods));
  assert.ok(walls.length > 0);
});

test('wallValueFor 钳制到带墙值范围', () => {
  const zone = ZONES[0];
  for (let i = 0; i < 30; i += 1) {
    const v = wallValueFor(mulberry32(13 + i), 100, zone);
    assert.ok(v >= 1 && v <= 9);
  }
});
