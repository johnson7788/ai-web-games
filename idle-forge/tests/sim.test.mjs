// IDLE FORGE · 模拟层纯逻辑测试（node --test，零 DOM）
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createRun, mulberry32, forgeIntervalSec, incomePerForge,
  upgradeCost, offlineEarnings, masterpieceGainPerForge,
} from '../src/game/sim.js';
import { LEVELS } from '../config/levels.js';
import { GAME } from '../config/game.config.js';

const forge = (run, sec, dt = 1 / 60) => {
  const steps = Math.ceil(sec / dt);
  for (let i = 0; i < steps; i += 1) run.step(dt);
};

test('createRun 初始状态：第 1 关、active、零金币、目标 30', () => {
  const r = createRun(0, {});
  assert.equal(r.state.level, 1);
  assert.equal(r.state.phase, 'active');
  assert.equal(r.state.coins, 0);
  assert.equal(r.state.target, LEVELS[0].target);
  assert.equal(r.state.forges, 0);
});

test('自动锻造产金币：1 秒 1 锤，产量 = 本关基础值', () => {
  const r = createRun(0, {});
  forge(r, 1);
  assert.equal(r.state.forges, 1);
  assert.equal(r.state.coins, LEVELS[0].yield);
});

test('锤力升级：扣金币、产量 +15%', () => {
  const r = createRun(0, {});
  forge(r, 3); // 30 金币
  const res = r.buy('power');
  assert.equal(res.ok, true);
  assert.equal(r.state.upgrades.power, 1);
  assert.equal(r.state.coins, 30 - GAME.UPGRADE_BASE.power);
  const inc = incomePerForge(r.state);
  assert.equal(inc, Math.round(LEVELS[0].yield * (1 + GAME.POWER_PER_LV)));
});

test('金币不足时升级失败且不扣钱', () => {
  const r = createRun(0, {});
  const res = r.buy('apprentice'); // 起步 50，0 金币
  assert.equal(res.ok, false);
  assert.equal(res.reason, 'poor');
  assert.equal(r.state.upgrades.apprentice, 0);
  assert.equal(r.state.coins, 0);
});

test('锤速升级缩短锻造间隔', () => {
  const r = createRun(0, {});
  const before = forgeIntervalSec(r.state);
  r.state.upgrades.speed = 5;
  const after = forgeIntervalSec(r.state);
  assert.ok(after < before);
  assert.equal(after, GAME.BASE_FORGE_SEC / (1 + 5 * GAME.SPEED_PER_LV));
});

test('价格指数递增：第 N 级成本 = base * growth^(N-1)', () => {
  const r = createRun(0, {});
  const c0 = upgradeCost(r.state, 'power');
  r.state.upgrades.power = 5;
  const c5 = upgradeCost(r.state, 'power');
  assert.equal(c0, GAME.UPGRADE_BASE.power);
  assert.equal(c5, Math.round(GAME.UPGRADE_BASE.power * Math.pow(GAME.UPGRADE_GROWTH, 5)));
  assert.ok(c5 > c0);
});

test('手动敲击有冷却：0.3s 内第二次 tap 被拒', () => {
  const r = createRun(0, {});
  assert.equal(r.tap().ok, true);
  assert.equal(r.tap().ok, false);
  assert.equal(r.tap().reason, 'cooldown');
});

test('大师之作满后自动进入下一关（保留金币/升级，不重置）', () => {
  const r = createRun(0, {});
  forge(r, 3); // 30 金币
  assert.equal(r.buy('power').ok, true);
  assert.equal(r.state.upgrades.power, 1);
  const coinsBefore = r.state.coins;
  forge(r, LEVELS[0].target); // 打满大师之作
  assert.equal(r.state.level, 2);
  assert.equal(r.state.phase, 'active');
  assert.equal(r.state.upgrades.power, 1);      // 升级保留
  assert.ok(r.state.coins >= coinsBefore);      // 金币不被清空
});

test('第 12 关完成大师之作 → won（含罢工减速，留足时间）', () => {
  const r = createRun(11, {});
  forge(r, 500);
  assert.equal(r.state.phase, 'won');
  assert.equal(r.state.result.won, true);
});

test('离线收益：按时长 × 产出 × 50% 折算', () => {
  const r = createRun(0, {});
  const perSec = (LEVELS[0].yield) / GAME.BASE_FORGE_SEC; // 10/1
  const earned = offlineEarnings(r.state, 3600);
  assert.equal(earned, Math.round(3600 * perSec * GAME.OFFLINE_RATE));
});

test('离线收益封顶 8 小时', () => {
  const r = createRun(0, {});
  const perSec = (LEVELS[0].yield) / GAME.BASE_FORGE_SEC;
  const earned = offlineEarnings(r.state, 100 * 3600);
  assert.equal(earned, Math.round(GAME.OFFLINE_CAP_SEC * perSec * GAME.OFFLINE_RATE));
});

test('材料短缺：第 3 关锤力线涨价 1.6 倍', () => {
  const r = createRun(2, {}); // 第 3 关 shortage=power
  const normal = GAME.UPGRADE_BASE.power;
  const cost = upgradeCost(r.state, 'power');
  assert.equal(cost, Math.round(normal * GAME.SHORTAGE_MULT));
});

test('炉候窗口：第 5 关 5s 后开启，加温 +25%', () => {
  const r = createRun(4, {}); // 第 5 关 furnace
  assert.equal(r.state.furnaceWindow.active, false);
  forge(r, 5.2);
  assert.equal(r.state.furnaceWindow.active, true);
  const res = r.stoke();
  assert.equal(res.ok, true);
  assert.equal(r.state.buffs.temp.active, true);
});

test('学徒罢工：第 8 关 15s 触发，安抚后解除', () => {
  const r = createRun(7, {}); // 第 8 关 strike
  forge(r, 15.2);
  assert.equal(r.state.strike.active, true);
  const res = r.appease();
  assert.equal(res.ok, true);
  assert.equal(r.state.strike.active, false);
});

test('稀有矿脉：第 6 关开局 ×3 收益', () => {
  const r = createRun(5, {}); // 第 6 关 vein
  assert.equal(r.state.buffs.vein.active, true);
  const inc = incomePerForge(r.state);
  assert.equal(inc, Math.round(LEVELS[5].yield * GAME.VEIN_MULT));
});

test('订单限时：限时内完成大师之作发奖励', () => {
  const r = createRun(8, {}); // 第 9 关 order
  assert.equal(r.state.order.active, true);
  const n = LEVELS[8].target;
  const done = [];
  for (let i = 0; i < n; i += 1) {
    r.step(0.31);
    r.tap();
    done.push(...r.drainEvents());
  }
  done.push(...r.drainEvents());
  const orderDone = done.find((e) => e.type === 'orderDone');
  assert.ok(orderDone, '应发出 orderDone 事件');
  assert.ok(orderDone.bonus > 0, '订单奖励 > 0');
  assert.equal(r.state.level, 10); // 完成后进下一关
});

test('mulberry32 确定性：同 seed 同序列', () => {
  const a = mulberry32(123);
  const b = mulberry32(123);
  assert.deepEqual([a(), a(), a()], [b(), b(), b()]);
});

test('事件总线：forge/upgrade/tap/win 均被发出', () => {
  const r = createRun(0, {});
  forge(r, 3);
  const types = new Set(r.drainEvents().map((e) => e.type));
  assert.ok(types.has('forge'));
  r.buy('power');
  assert.ok(r.drainEvents().some((e) => e.type === 'upgrade'));
  r.tap();
  assert.ok(r.drainEvents().some((e) => e.type === 'tap'));
});

test('大师之作进度：火温升级加速进度', () => {
  const r = createRun(0, {});
  const base = masterpieceGainPerForge(r.state);
  r.state.upgrades.temp = 4;
  const boosted = masterpieceGainPerForge(r.state);
  assert.ok(boosted > base);
});
