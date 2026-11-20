import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mulberry32 } from '../src/game/rng.js';
import { PATHS, pathById } from '../config/paths.js';
import { FISHES, fishById, BOSS_FISH_ID } from '../config/fishes.js';
import { STAGES, STAGE_COUNT, stageAt, clampStage } from '../config/levels.js';
import { stepFish, fishOffScreen, makeFish, spawnGroup, spawnBoss } from '../src/game/spawner.js';

test('paths：至少 3 条，pathById 命中', () => {
  assert.ok(PATHS.length >= 3);
  for (const p of PATHS) {
    assert.ok(p.points.length >= 2);
    assert.deepEqual(pathById(p.id), p);
  }
});

test('fishes：10 种，含 Boss 巨口鲨', () => {
  assert.equal(FISHES.length, 10);
  const boss = fishById(BOSS_FISH_ID);
  assert.equal(boss.boss, true);
  assert.ok(boss.value > 100, 'Boss 高倍率');
  for (const f of FISHES) {
    assert.ok(f.hp >= 1 && f.value >= 1);
  }
});

test('levels：12 场，营收目标递增，含 Boss 场', () => {
  assert.equal(STAGE_COUNT, 12);
  for (let i = 1; i < STAGE_COUNT; i += 1) {
    assert.ok(stageAt(i + 1).revenueTarget > stageAt(i).revenueTarget);
  }
  assert.ok(STAGES.some((s) => s.boss));
  assert.equal(clampStage(0), 1);
  assert.equal(clampStage(99), STAGE_COUNT);
});

test('stepFish：沿折线移动并最终到达终点', () => {
  const f = { x: 0, y: 0, speed: 100, seg: 0, path: [[0, 0], [100, 0], [200, 0]], travel: 0, phase: 0, sway: 0 };
  assert.equal(stepFish(f, 0.5), false);
  assert.equal(f.x, 50);
  assert.equal(stepFish(f, 0.5), false); // 到达第一个拐点，seg=1
  assert.equal(f.seg, 1);
  stepFish(f, 1.0); // 到达终点，seg=2
  assert.equal(f.seg, 2);
  assert.equal(fishOffScreen(f), true, '到达终点即离场');
  assert.equal(stepFish(f, 1.0), true, '已到终点不再移动');
});

test('makeFish：从路径起点出发，字段齐全', () => {
  const rng = mulberry32(1);
  const f = makeFish(rng, 1, 1, 0.5);
  assert.equal(f.species, 1);
  assert.equal(f.pathId, 1);
  assert.deepEqual([f.x, f.y], PATHS[0].points[0]);
  assert.equal(f.delay, 0.5);
  assert.equal(f.alive, true);
});

test('spawnGroup：群大小在 stage.groupSize 范围内且路径合法', () => {
  const rng = mulberry32(2);
  const stage = stageAt(3);
  let nextId = 1;
  for (let i = 0; i < 10; i += 1) {
    const { fish, pathId, nextId: n } = spawnGroup(rng, stage, nextId);
    nextId = n;
    assert.ok(fish.length >= stage.groupSize[0] && fish.length <= stage.groupSize[1]);
    assert.ok(stage.paths.includes(pathId));
    assert.ok(stage.roster.includes(fish[0].species));
  }
});

test('spawnBoss：产出单条 Boss 巨口鲨', () => {
  const rng = mulberry32(3);
  const { fish, speciesId } = spawnBoss(rng, 100);
  assert.equal(fish.length, 1);
  assert.equal(speciesId, BOSS_FISH_ID);
  assert.equal(fish[0].boss, true);
});
