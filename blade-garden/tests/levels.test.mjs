import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS, LEVEL_COUNT } from '../config/levels.js';
import { ENEMIES, SCENE_ENEMIES } from '../config/enemies.js';
import { UPGRADES } from '../config/upgrades.js';
import { GAME } from '../config/game.config.js';

test('关卡表：12 关、index 连续', () => {
  assert.equal(LEVEL_COUNT, 12);
  assert.equal(LEVELS.length, 12);
  LEVELS.forEach((lv, i) => assert.equal(lv.index, i + 1));
});

test('关卡表：三场景包全覆盖且字段合法', () => {
  const scenes = new Set();
  for (const lv of LEVELS) {
    scenes.add(lv.scene);
    assert.ok(lv.duration > 0);
    assert.ok(lv.killTarget > 0);
    assert.ok(lv.spawn.interval > 0);
    assert.ok(lv.spawn.cap <= GAME.ENEMY_CAP, `L${lv.index} cap 超红线`);
    for (const id of lv.enemies) assert.ok(ENEMIES[id], `L${lv.index} 敌人 ${id} 不存在`);
  }
  assert.deepEqual([...scenes].sort(), ['autumn', 'spring', 'summer']);
});

test('关卡表：每关 newElement 唯一', () => {
  const elements = LEVELS.map((lv) => lv.newElement);
  assert.equal(new Set(elements).size, elements.length);
});

test('Boss 分布：L4/L8 药王鼎，L12 山魈王，其余无 Boss', () => {
  assert.equal(LEVELS[3].boss, 'bossCauldron');
  assert.equal(LEVELS[7].boss, 'bossCauldron');
  assert.equal(LEVELS[11].boss, 'bossMandrillKing');
  for (let i = 0; i < 12; i += 1) {
    if (![3, 7, 11].includes(i)) assert.equal(LEVELS[i].boss, null, `L${i + 1} 不应有 boss`);
  }
});

test('特殊地形：L10 毒沼、L11 窄道', () => {
  assert.equal(LEVELS[9].hazard, 'poison');
  assert.ok(LEVELS[9].hazards.length > 0);
  assert.equal(LEVELS[10].narrow, true);
  assert.ok(LEVELS[10].walls.length > 0);
});

test('场景敌人：春/夏/秋各用不同敌人', () => {
  assert.deepEqual(SCENE_ENEMIES.spring, ['boar', 'crow']);
  assert.deepEqual(SCENE_ENEMIES.summer, ['mandrill', 'boar']);
  assert.deepEqual(SCENE_ENEMIES.autumn, ['thief', 'mandrill', 'crow']);
});

test('升级表：≥8 个且 rule 占比 ≥35%', () => {
  assert.ok(UPGRADES.length >= 8);
  const rule = UPGRADES.filter((u) => u.kind === 'rule').length;
  assert.ok(rule / UPGRADES.length >= 0.35, `rule 占比 ${rule}/${UPGRADES.length}`);
});
