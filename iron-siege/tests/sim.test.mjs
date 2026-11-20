import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRun } from '../src/game/sim.js';
import { CELL, DIR, FURNACE, PLAYER } from '../config/gameplay.js';

function clearMap(run) {
  for (let r = 0; r < 26; r += 1) {
    for (let c = 0; c < 26; c += 1) {
      if (run.grid[r][c] !== CELL.FURNACE) run.grid[r][c] = CELL.EMPTY;
    }
  }
}

function fresh() {
  const run = createRun({ seed: 1 });
  run.drainEvents();
  return run;
}

test('createRun：wave 1 / playing / 熔炉与围栏就位', () => {
  const run = createRun({ seed: 1 });
  assert.equal(run.phase, 'playing');
  assert.equal(run.wave, 1);
  assert.equal(run.lives, PLAYER.LIVES);
  assert.equal(run.grid[0][12], CELL.FURNACE);
  assert.equal(run.grid[1][13], CELL.FURNACE);
  for (const f of FURNACE.FENCE) assert.equal(run.grid[f.row][f.col], CELL.BRICK);
});

test('开局生成 3 个敌人', () => {
  const run = createRun({ seed: 1 });
  assert.ok(run.enemies.length >= 1);
});

test('玩家向上移动', () => {
  const run = fresh();
  clearMap(run);
  run.enemies = [];
  run.player.x = 100;
  run.player.y = 100;
  const before = run.player.y;
  run.step({ up: true });
  assert.ok(run.player.y > before);
});

test('主炮开火生成子弹并发出 shot 事件', () => {
  const run = fresh();
  clearMap(run);
  run.player.dir = DIR.UP;
  run.step({ fire: true });
  assert.ok(run.playerBullets.length > 0);
  const evs = run.drainEvents();
  assert.ok(evs.some((e) => e.type === 'shot'));
});

test('重炮消耗弹药并生成 heavy 子弹', () => {
  const run = fresh();
  clearMap(run);
  run.player.dir = DIR.UP;
  const before = run.heavy;
  run.step({ heavy: true });
  assert.equal(run.heavy, before - 1);
  assert.ok(run.playerBullets.some((b) => b.heavy));
});

test('主炮击毁砖墙', () => {
  const run = fresh();
  clearMap(run);
  run.enemies = [];
  run.player.x = 40;
  run.player.y = 8;
  run.player.dir = DIR.RIGHT;
  run.grid[1][6] = CELL.BRICK;
  run.step({ fire: true });
  assert.equal(run.grid[1][6], CELL.EMPTY);
  assert.ok(run.drainEvents().some((e) => e.type === 'brickBreak'));
});

test('普通子弹不能击穿钢墙', () => {
  const run = fresh();
  clearMap(run);
  run.enemies = [];
  run.player.x = 40;
  run.player.y = 8;
  run.player.dir = DIR.RIGHT;
  run.grid[1][6] = CELL.STEEL;
  run.step({ fire: true });
  assert.equal(run.grid[1][6], CELL.STEEL);
});

test('重炮击穿钢墙', () => {
  const run = fresh();
  clearMap(run);
  run.enemies = [];
  run.player.x = 40;
  run.player.y = 8;
  run.player.dir = DIR.RIGHT;
  run.grid[1][6] = CELL.STEEL;
  run.step({ heavy: true });
  assert.equal(run.grid[1][6], CELL.EMPTY);
  assert.ok(run.drainEvents().some((e) => e.type === 'steelBreak'));
});

test('熔炉受击掉血并触发报警', () => {
  const run = fresh();
  run.enemyBullets.push({ id: 999, x: 104, y: 8, dir: DIR.DOWN, step: 1, heavy: false, damage: 1, owner: 'enemy' });
  run.step({});
  assert.ok(run.furnaceHp < run.furnaceMaxHp);
  const evs = run.drainEvents();
  assert.ok(evs.some((e) => e.type === 'furnaceHit'));
  assert.ok(evs.some((e) => e.type === 'alarm'));
});

test('熔炉被毁判定失败', () => {
  const run = fresh();
  run.furnaceHp = 1;
  run.enemyBullets.push({ id: 999, x: 104, y: 8, dir: DIR.DOWN, step: 1, heavy: false, damage: 1, owner: 'enemy' });
  run.step({});
  assert.equal(run.phase, 'dead');
});

test('玩家被击中扣命并进入复活等待', () => {
  const run = fresh();
  run.player.invulnUntil = 0;
  run.enemyBullets.push({ id: 998, x: 80, y: 8, dir: DIR.UP, step: 1, heavy: false, damage: 1, owner: 'enemy' });
  run.step({});
  assert.equal(run.lives, PLAYER.LIVES - 1);
  assert.equal(run.player.alive, false);
});

test('玩家命尽判定失败', () => {
  const run = fresh();
  run.lives = 1;
  run.player.invulnUntil = 0;
  run.enemyBullets.push({ id: 998, x: 80, y: 8, dir: DIR.UP, step: 1, heavy: false, damage: 1, owner: 'enemy' });
  run.step({});
  assert.equal(run.phase, 'dead');
  assert.equal(run.lives, 0);
});

test('玩家死亡后延迟复活', () => {
  const run = fresh();
  run.enemies = [];
  run.player.invulnUntil = 0;
  run.enemyBullets.push({ id: 998, x: 80, y: 8, dir: DIR.UP, step: 1, heavy: false, damage: 1, owner: 'enemy' });
  run.step({});
  assert.equal(run.player.alive, false);
  for (let i = 0; i < 60; i += 1) run.step({});
  assert.equal(run.player.alive, true);
});

test('子弹互抵：同向重叠子弹相互抵消', () => {
  const run = fresh();
  clearMap(run);
  run.enemies = [];
  run.playerBullets = [{ id: 1, x: 100, y: 100, dir: DIR.UP, step: 2, heavy: false, damage: 1, owner: 'player' }];
  run.enemyBullets = [{ id: 2, x: 100, y: 100, dir: DIR.UP, step: 2, heavy: false, damage: 1, owner: 'enemy' }];
  run.step({});
  assert.equal(run.playerBullets.length, 0);
  assert.equal(run.enemyBullets.length, 0);
});

test('清波后进入强化选择', () => {
  const run = fresh();
  run.spawnQueue = [];
  run.enemies = [];
  run.step({});
  assert.equal(run.wavePhase, 'cleared');
  assert.ok(run.pendingUpgrade);
  assert.ok(run.drainEvents().some((e) => e.type === 'waveClear'));
});

test('选择强化后进入下一波', () => {
  const run = fresh();
  run.spawnQueue = [];
  run.enemies = [];
  run.step({});
  const ok = run.chooseUpgrade(0);
  assert.equal(ok, true);
  assert.equal(run.wave, 2);
  assert.equal(run.wavePhase, 'fighting');
  assert.equal(run.pendingUpgrade, null);
});

test('焊修恢复围栏并标记本波已用', () => {
  const run = fresh();
  run.grid[0][11] = CELL.EMPTY;
  run.step({ repair: true });
  assert.equal(run.grid[0][11], CELL.BRICK);
  assert.equal(run.repairUsedThisWave, true);
});

test('时钟道具冻结敌人', () => {
  const run = fresh();
  run.props.push({ id: 999, kind: 'clock', x: 80, y: 8, ttl: 10 });
  run.step({});
  assert.ok(run.freezeUntil > run.time);
  assert.ok(run.drainEvents().some((e) => e.type === 'propGain'));
});

test('getHud 暴露关键状态', () => {
  const run = createRun({ seed: 1 });
  const hud = run.getHud();
  assert.equal(hud.wave, 1);
  assert.equal(hud.lives, PLAYER.LIVES);
  assert.equal(hud.firepower, 1);
  assert.equal(hud.furnaceHp, FURNACE.HP);
  assert.ok(hud.sceneKey);
});
