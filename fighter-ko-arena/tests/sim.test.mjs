import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRun, mulberry32 } from '../src/game/sim.js';
import { FIGHT, LEVELS, LEVEL_COUNT } from '../config/game.config.js';

function approach(run, maxSteps = 240) {
  let n = 0;
  while (n < maxSteps && !run.state.fight.inRange) {
    run.step(1 / 60);
    n += 1;
  }
  return n;
}

test('开局状态：phase=fight、第 1 关、满血、双方拉开距离', () => {
  const run = createRun(0);
  assert.equal(run.state.phase, 'fight');
  assert.equal(run.state.level, 1);
  assert.equal(run.state.fight.playerHp, FIGHT.PLAYER_HP);
  assert.equal(run.state.fight.enemyHp, LEVELS[0].enemyHp);
  assert.ok(run.state.fight.distance > FIGHT.ATTACK_RANGE);
});

test('靠近：step 后距离缩小，最终进入射程', () => {
  const run = createRun(0);
  const d0 = run.state.fight.distance;
  approach(run);
  assert.ok(run.state.fight.inRange, '应该进入射程');
  assert.ok(run.state.fight.distance <= FIGHT.ATTACK_RANGE);
  assert.ok(run.state.fight.distance < d0);
});

test('射程外 strike 无效', () => {
  const run = createRun(0);
  const res = run.strike();
  assert.equal(res.ok, false);
  assert.equal(run.state.fight.enemyHp, LEVELS[0].enemyHp, '未命中不扣血');
});

test('射程内首击为快拳，命中扣血并发出 punch/hitEnemy 事件', () => {
  const run = createRun(0);
  approach(run);
  const hp0 = run.state.fight.enemyHp;
  const res = run.strike();
  assert.equal(res.ok, true);
  assert.ok(run.state.fight.enemyHp < hp0);
  const types = run.drainEvents().map((e) => e.type);
  assert.ok(types.includes('punch'));
  assert.ok(types.includes('hitEnemy'));
});

test('连续快拳叠连击，伤害随 combo 上升', () => {
  const run = createRun(0);
  approach(run);
  run.strike();
  const c1 = run.state.fight.combo;
  run.step(FIGHT.PUNCH_COOLDOWN + 0.01);
  run.strike();
  assert.ok(run.state.fight.combo > c1, '连击应递增');
});

test('等待超 1s 再出手变成扫腿，连击清零并击退', () => {
  const run = createRun(0);
  approach(run);
  run.strike(); // punch
  run.step(FIGHT.ATTACK_WINDOW + 0.2);
  const d0 = run.state.fight.distance;
  run.strike(); // kick
  const types = run.drainEvents().map((e) => e.type);
  assert.ok(types.includes('kick'), '应该判定为扫腿');
  assert.equal(run.state.fight.combo, 0, '扫腿清空连击');
  assert.ok(run.state.fight.distance > d0, '扫腿击退敌人');
});

test('格挡把敌方伤害削减到 20% 左右', () => {
  const run = createRun(0);
  approach(run);
  run.blockStart();
  assert.equal(run.state.fight.blocking, true);
  // 手动触发一次敌方命中
  run.state.fight.enemyWindup = 0.0001;
  const hp0 = run.state.fight.playerHp;
  run.step(1 / 60);
  const dmg = hp0 - run.state.fight.playerHp;
  assert.ok(dmg > 0, '仍然受到少量伤害');
  assert.ok(dmg <= Math.ceil(LEVELS[0].enemyDamage * (1 - FIGHT.BLOCK_REDUCE)), '格挡减免生效');
});

test('超必杀：能量不足时无效，攒满后造成大伤害并清空能量', () => {
  const run = createRun(0);
  approach(run);
  assert.equal(run.superMove().ok, false, '能量不足应失败');
  // 攒能量
  run.state.fight.playerMeter = FIGHT.SUPER_METER_MAX;
  const hp0 = run.state.fight.enemyHp;
  const res = run.superMove();
  assert.equal(res.ok, true);
  assert.ok(hp0 - run.state.fight.enemyHp >= FIGHT.SUPER_DAMAGE);
  assert.equal(run.state.fight.playerMeter, 0);
});

test('noinput：只推进时间，最终被击倒进入 lost', () => {
  const run = createRun(0);
  for (let i = 0; i < 60 * 30 && run.state.phase === 'fight'; i += 1) run.step(1 / 60);
  assert.equal(run.state.phase, 'lost');
  assert.equal(run.state.fight.playerHp, 0);
});

test('快速连击能击倒第 1 关对手并推进到第 2 关', () => {
  const run = createRun(0);
  for (let i = 0; i < 60 * 12 && run.state.phase === 'fight' && run.state.level < 2; i += 1) {
    const f = run.state.fight;
    if (f.inRange && f.playerCooldown <= 0 && f.superLock <= 0) {
      run.strike();
    } else {
      run.step(1 / 60);
    }
  }
  assert.ok(run.state.level >= 2 || run.state.phase === 'won', '应至少进入第 2 关或直接通关');
});

test('三关连续击倒后 phase 变 won', () => {
  const run = createRun(0);
  let guard = 60 * 60;
  while (run.state.phase === 'fight' && guard-- > 0) {
    const f = run.state.fight;
    if (f.inRange && f.playerCooldown <= 0 && f.superLock <= 0) {
      if (f.playerMeter >= FIGHT.SUPER_METER_MAX) run.superMove();
      else run.strike();
    } else {
      run.step(1 / 60);
    }
  }
  assert.equal(run.state.phase, 'won');
  assert.equal(run.state.level, LEVEL_COUNT);
});

test('drainEvents 会清空已消费事件', () => {
  const run = createRun(0);
  approach(run);
  run.strike();
  assert.ok(run.drainEvents().length > 0);
  assert.equal(run.drainEvents().length, 0);
});

test('mulberry32 是确定性随机', () => {
  const a = mulberry32(42);
  const b = mulberry32(42);
  assert.equal(a(), b());
  assert.equal(a(), b());
});
