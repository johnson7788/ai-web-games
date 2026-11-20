import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS } from '../config/levels.js';
import { createRun } from '../src/game/sim.js';

test('12 关数据齐全且合法', () => {
  assert.equal(LEVELS.length, 12, '应有 12 关');
  for (const lv of LEVELS) {
    assert.ok(lv.goal && lv.goal.x > 0 && lv.goal.x < lv.width, `L${lv.index} goal 应在关卡宽度内`);
    assert.ok(lv.ground.length > 0, `L${lv.index} 应有地面`);
    assert.equal(lv.stars.length, 3, `L${lv.index} 应有 3 颗星`);
    assert.ok(lv.coins.length >= 1, `L${lv.index} 应有金币`);
    assert.ok(lv.spawn && lv.respawn, `L${lv.index} 应有出生/重生点`);
    assert.ok(lv.pack >= 1 && lv.pack <= 3, `L${lv.index} pack 合法`);
  }
});

test('三场景包覆盖：糖果/云端/夜林', () => {
  const packs = new Set(LEVELS.map((l) => l.pack));
  assert.deepEqual([...packs].sort(), [1, 2, 3], '应覆盖三套场景包');
});

test('greedy 直走+遇隙跳可通过第 3 关', () => {
  const run = createRun({ seed: 123, level: 1 });
  const MAX = 150 * 60;
  for (let tick = 0; tick < MAX && run.phase === 'playing'; tick += 1) {
    const p = run.player;
    let move = 1;
    let jump = false;
    if (p.onGround) {
      const gap = !run.level.ground.some((seg) => p.x + p.w + 82 >= seg.x && p.x + p.w + 82 < seg.x + seg.w);
      const enemyAhead = run.enemies.some((e) => e.hp > 0 && e.x > p.x - 10 && e.x - p.x < 96 && Math.abs(e.y - p.y) < 46);
      jump = gap || enemyAhead;
    }
    run.step({ left: move < 0, right: move > 0, jump });
    run.drainEvents();
  }
  assert.ok(run.stats.levelReached >= 3, `greedy 应到第 3 关，实际 ${run.stats.levelReached}`);
});
