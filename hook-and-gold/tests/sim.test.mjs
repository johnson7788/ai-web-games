import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRun, pickTarget, HOOK_STATE } from '../src/game/sim.js';
import { GAME, LAYOUT } from '../config/game.config.js';
import { LEVELS } from '../config/levels.js';

function advance(run, sec) {
  const n = Math.max(1, Math.round(sec * 60));
  for (let i = 0; i < n; i += 1) run.step(1 / 60);
}

test('冒烟：createRun → step → getHud → drainEvents 无异常', () => {
  const r = createRun(0, { seed: 1 });
  r.step(1 / 60);
  const hud = r.getHud();
  assert.equal(hud.level, 1);
  assert.equal(hud.phase, 'playing');
  assert.ok(Array.isArray(r.drainEvents()));
});

test('state 形状：level/scene/phase/money/target/objects', () => {
  const r = createRun(0, { seed: 1 });
  const s = r.state;
  assert.equal(s.level, 1);
  assert.equal(s.scene, 'shallow-reef');
  assert.equal(s.phase, 'playing');
  assert.equal(s.money, 0);
  assert.equal(s.target, LEVELS[0].target);
  assert.ok(s.objects.length > 0);
});

test('物件总价值 ≥ 目标 ×1.6（可通关余量）', () => {
  for (let i = 0; i < LEVELS.length; i += 1) {
    const r = createRun(i, { seed: 1 });
    const total = r.state.objects.reduce((s, o) => s + o.value, 0);
    assert.ok(total >= LEVELS[i].target * 1.6, `L${i + 1} 价值余量不足`);
  }
});

test('确定性：同 seed 生成相同物件位置', () => {
  const a = createRun(3, { seed: 42 });
  const b = createRun(3, { seed: 42 });
  assert.deepEqual(a.state.objects.map((o) => [o.type, o.x, o.y]), b.state.objects.map((o) => [o.type, o.x, o.y]));
});

test('钟摆：待机摆动角度在 ±ROTATE_RANGE 内', () => {
  const r = createRun(0, { seed: 1 });
  for (let i = 0; i < 600; i += 1) {
    r.step(1 / 60);
    const a = Math.abs(r.state.hook.angleDeg);
    assert.ok(a <= GAME.ROTATE_RANGE_DEG + 1e-6);
  }
});

test('fire：待机可发射，钩住中不可发射', () => {
  const r = createRun(0, { seed: 1 });
  assert.equal(r.fire().ok, true);
  assert.equal(r.state.hook.state, HOOK_STATE.EXTEND);
  assert.equal(r.fire().ok, false);
});

test('伸出越界：len 达到 MAX_LEN 转回收并发 hookOutOfRange', () => {
  const r = createRun(0, { seed: 1 });
  for (const o of r.state.objects) o.alive = false;
  r.fire();
  advance(r, 1.2); // 0.95s 伸到 MAX_LEN 后开始回收
  assert.equal(r.state.hook.state, HOOK_STATE.RETURN);
  const ev = r.drainEvents();
  assert.ok(ev.some((e) => e.type === 'hookOutOfRange'));
});

test('grab：瞄准物件发射后命中并转回收', () => {
  const r = createRun(0, { seed: 1 });
  const o = r.state.objects.filter((x) => x.alive && x.value > 0 && x.hazard !== 'clam')
    .sort((a, b) => (a.x - LAYOUT.PIVOT.x) ** 2 + (a.y - LAYOUT.PIVOT.y) ** 2 - ((b.x - LAYOUT.PIVOT.x) ** 2 + (b.y - LAYOUT.PIVOT.y) ** 2))[0];
  r._aim(o.x, o.y);
  r.fire();
  let guard = 240;
  while (guard-- > 0 && r.state.hook.state === HOOK_STATE.EXTEND) r.step(1 / 60);
  assert.equal(r.state.hook.state, HOOK_STATE.RETURN);
  assert.equal(r.state.hook.hooked.length, 1);
  const ev = r.drainEvents();
  assert.ok(ev.some((e) => e.type === 'grab'));
});

test('重量决定回收速度：重物回收比轻物慢', () => {
  const light = createRun(0, { seed: 1 });
  const heavy = createRun(0, { seed: 1 });
  // 直接构造两种已钩住状态，比较单步 len 减少量
  light.state.hook.state = HOOK_STATE.RETURN;
  light.state.hook.weight = 100;
  light.state.hook.len = 400;
  heavy.state.hook.state = HOOK_STATE.RETURN;
  heavy.state.hook.weight = 300;
  heavy.state.hook.len = 400;
  light.step(1 / 60);
  heavy.step(1 / 60);
  const dLight = 400 - light.state.hook.len;
  const dHeavy = 400 - heavy.state.hook.len;
  assert.ok(dHeavy < dLight, `重物回收应更慢：${dHeavy} vs ${dLight}`);
});

test('hookEnd：结算价值、加钱、清空钩子', () => {
  const r = createRun(0, { seed: 1 });
  const o = r.state.objects.find((x) => x.alive && x.value > 0);
  r.state.hook.state = HOOK_STATE.RETURN;
  r.state.hook.hooked = [o.id];
  r.state.hook.weight = o.mass;
  r.state.hook.len = GAME.MIN_LEN + 1;
  r.step(1 / 60);
  assert.equal(r.state.money, o.value);
  assert.equal(r.state.hook.state, HOOK_STATE.IDLE);
  assert.equal(r.state.hook.hooked.length, 0);
  assert.equal(o.alive, false);
});

test('win：money 达到 target → phase won 且发 win', () => {
  const r = createRun(0, { seed: 1 });
  r.state.money = r.state.target;
  r._checkEnd();
  assert.equal(r.state.phase, 'won');
  assert.ok(r.state.result.won);
  assert.ok(r.drainEvents().some((e) => e.type === 'win'));
});

test('lose：倒计时耗尽 → phase lost', () => {
  const r = createRun(0, { seed: 1 });
  r.state.timeLeft = 0;
  r._checkEnd();
  assert.equal(r.state.phase, 'lost');
  assert.equal(r.state.result.won, false);
});

test('星级：时间充裕 = 3 星，时间不足 = 1 星', () => {
  const r = createRun(0, { seed: 1 });
  r.state.money = r.state.target;
  r.state.timeLeft = r.state.initialTime * 0.9;
  r._checkEnd();
  assert.equal(r.state.stars, 3);
  const r2 = createRun(0, { seed: 1 });
  r2.state.money = r2.state.target;
  r2.state.timeLeft = r2.state.initialTime * 0.1;
  r2._checkEnd();
  assert.equal(r2.state.stars, 1);
});

test('水母蜇伤：抓水母扣时间并减 stinged', () => {
  const r = createRun(3, { seed: 1 }); // L4 有水母
  const jelly = r.state.objects.find((o) => o.type === 'JELLYFISH');
  assert.ok(jelly);
  const before = r.state.timeLeft;
  r._grab(jelly);
  assert.equal(r.state.stinged, 1);
  assert.ok(r.state.timeLeft < before);
  assert.ok(r.drainEvents().some((e) => e.type === 'sting'));
});

test('炸药桶爆炸：摧毁周边物件', () => {
  const r = createRun(4, { seed: 1 }); // L5 有炸药桶
  const barrel = r.state.objects.find((o) => o.type === 'DYNAMITE');
  assert.ok(barrel);
  const nearby = r.state.objects.filter((o) => o.id !== barrel.id && o.alive
    && Math.hypot(o.x - barrel.x, o.y - barrel.y) <= GAME.EXPLOSION_RADIUS).length;
  r.state.hook.len = 300; // 模拟已伸出后才钩住
  r._grab(barrel);
  advance(r, 0.6); // 等引信烧完
  const ev = r.drainEvents();
  assert.ok(ev.some((e) => e.type === 'explode'));
  if (nearby > 0) assert.ok(ev.some((e) => e.type === 'objectDestroyed'));
});

test('珍珠贝：闭合时不可钩（pickTarget 跳过）', () => {
  const r = createRun(2, { seed: 1 }); // L3 有珍珠贝
  const clam = r.state.objects.find((o) => o.type === 'PEARL_SHELL');
  assert.ok(clam);
  clam.clamOpen = false;
  // 所有其它物件隐藏，只剩闭合珍珠贝时 greedy 返回 null
  for (const o of r.state.objects) if (o.id !== clam.id) { o.alive = false; o.value = 0; }
  assert.equal(pickTarget(r.state), null);
});

test('pickTarget：倾向黑珍珠（高值轻物）', () => {
  const r = createRun(7, { seed: 1 }); // L8 有黑珍珠
  const pearl = r.state.objects.find((o) => o.type === 'BLACK_PEARL');
  assert.ok(pearl);
  const picked = pickTarget(r.state);
  assert.ok(picked);
  assert.equal(picked.type, 'BLACK_PEARL');
});

test('洋流：物件 x 随流移动', () => {
  const r = createRun(1, { seed: 1 }); // L2 有洋流
  const o = r.state.objects.find((x) => x.alive);
  const x0 = o.x;
  advance(r, 0.5);
  assert.notEqual(o.x, x0);
});

test('abort：弃钩扣炸药并回钩', () => {
  const r = createRun(0, { seed: 1 });
  const dyn = r.state.dynamite;
  r.fire();
  const res = r.abort();
  assert.equal(res.ok, true);
  assert.equal(r.state.dynamite, dyn - 1);
  assert.equal(r.state.hook.state, HOOK_STATE.RETURN);
});

test('abort：炸药用尽不可再弃钩', () => {
  const r = createRun(0, { seed: 1 });
  r.state.dynamite = 0;
  r.fire();
  assert.deepEqual(r.abort(), { ok: false, reason: 'noDynamite' });
});

test('倒计时：整秒发 countdownTick', () => {
  const r = createRun(0, { seed: 1 });
  r.state.timeLeft = 10.1;
  r._lastSecond = Math.ceil(10.1);
  r.drainEvents();
  r.step(0.2);
  assert.ok(r.drainEvents().some((e) => e.type === 'countdownTick'));
});

test('事件密度：待机摆动持续发 swingTick', () => {
  const r = createRun(0, { seed: 1 });
  r.drainEvents();
  advance(r, 1.5);
  assert.ok(r.drainEvents().some((e) => e.type === 'swingTick'));
});
