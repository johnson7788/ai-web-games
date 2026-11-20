import { test } from 'node:test';
import assert from 'node:assert/strict';
import { OWNER } from '../config/gameplay.js';
import { createRun } from '../src/game/sim.js';
import { listFrontier, countTerritory } from '../src/game/board.js';

test('createRun：开局 1 皿、playing、左下蓝 4 格', () => {
  const run = createRun({ seed: 1 });
  assert.equal(run.phase, 'playing');
  assert.equal(run.dish, 1);
  assert.equal(run.size, 7);
  assert.equal(run.turn, 'player');
  assert.equal(countTerritory(run.board, OWNER.PLAYER), 4);
  assert.equal(countTerritory(run.board, OWNER.ENEMY), 4);
});

test('step 感染行动占领格子并切到敌方回合', () => {
  const run = createRun({ seed: 2 });
  const [r, c] = listFrontier(run.board, run.size, OWNER.PLAYER)[0];
  run.step({ action: { kind: 'infect', r, c } });
  assert.equal(run.turn, 'enemy');
  const events = run.drainEvents();
  assert.ok(events.some((e) => e.type === 'infect'));
  assert.ok(events.some((e) => e.type === 'capture'));
});

test('敌方思考后行动并回到玩家回合', () => {
  const run = createRun({ seed: 3 });
  const [r, c] = listFrontier(run.board, run.size, OWNER.PLAYER)[0];
  run.step({ action: { kind: 'infect', r, c } });
  for (let i = 0; i < 120; i += 1) run.step({});
  assert.equal(run.turn, 'player');
});

test('营养滴：消耗行动点并施加光环', () => {
  const run = createRun({ seed: 4 });
  // 找一个己方格
  let pr = -1;
  let pc = -1;
  for (let r = 0; r < run.size; r += 1) {
    for (let c = 0; c < run.size; c += 1) {
      if (run.board[r][c].o === OWNER.PLAYER) { pr = r; pc = c; break; }
    }
    if (pr >= 0) break;
  }
  run.step({ action: { kind: 'nutrient', r: pr, c: pc } });
  assert.equal(run.turn, 'enemy');
  assert.equal(run.playerNutrientAvailable, false);
  assert.ok(run.aura[pr][pc] > 0);
});

test('noinput：自动 pass 直到失败（死亡存在性）', () => {
  const run = createRun({ seed: 5 });
  for (let i = 0; i < 7000 && run.phase === 'playing'; i += 1) run.step({});
  assert.equal(run.phase, 'lost');
});

test('清空敌格后感染触发过关 → cleared → continue 进 2 皿', () => {
  const run = createRun({ seed: 6 });
  // 手动把全部敌格改成中立，模拟敌方被清空
  for (let r = 0; r < run.size; r += 1) {
    for (let c = 0; c < run.size; c += 1) {
      if (run.board[r][c].o === OWNER.ENEMY) run.board[r][c].o = OWNER.NEUTRAL;
    }
  }
  const [r, c] = listFrontier(run.board, run.size, OWNER.PLAYER)[0];
  run.step({ action: { kind: 'infect', r, c } });
  assert.equal(run.phase, 'cleared');
  assert.equal(run.stats.dishesCleared, 1);
  run.continue();
  assert.equal(run.phase, 'playing');
  assert.equal(run.dish, 2);
});

test('getHud 提供皿/回合/领土/充能', () => {
  const run = createRun({ seed: 7 });
  const hud = run.getHud();
  assert.equal(hud.dish, 1);
  assert.equal(hud.totalDishes, 12);
  assert.equal(hud.playerCells, 4);
  assert.equal(hud.enemyCells, 4);
  assert.equal(hud.playerPhageReady, false); // 开局噬菌体充能中（3 回合后才就绪）
});

test('drainEvents 返回并清空', () => {
  const run = createRun({ seed: 8 });
  const e1 = run.drainEvents();
  assert.ok(e1.some((e) => e.type === 'dishStart'));
  assert.deepEqual(run.drainEvents(), []);
});
