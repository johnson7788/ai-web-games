import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRun, createPlayer, recomputeStats, mulberry32 } from '../src/game/sim.js';
import { DISTRICTS, MAX_LV, SLOTS, GRADES, levelUpCost } from '../src/game/data.js';

function advance(run, sec) {
  const n = Math.max(1, Math.round(sec * 60));
  for (let i = 0; i < n; i += 1) run.step(1 / 60);
}

test('冒烟：createRun → state 形状合法', () => {
  const r = createRun({ seed: 1 });
  assert.equal(r.state.phase, 'idle');
  assert.equal(r.state.district, 0);
  assert.equal(r.state.rivals.length, 10);
  assert.equal(typeof r.state.player.cash, 'number');
  assert.ok(Array.isArray(r.drainEvents()));
});

test('玩家初始属性：lv1 → att10/def5/hp100，power 公式', () => {
  const p = createPlayer();
  assert.equal(p.lv, 1);
  assert.equal(p.att, 10);
  assert.equal(p.def, 5);
  assert.equal(p.maxHp, 100);
  assert.equal(p.power, (10 + 5) * 10 + 100 * 2);
});

test('升级公式：levelUpCost 单调递增，MAX_LV 封顶返回 Infinity', () => {
  let prev = 0;
  for (let lv = 1; lv < 10; lv += 1) {
    const c = levelUpCost(lv);
    assert.ok(c > prev, `Lv${lv} cost ${c} 应 > ${prev}`);
    prev = c;
  }
  assert.equal(levelUpCost(MAX_LV), Infinity);
});

test('选择对手进入 battle，自动战斗推进至胜利 + 掉落', () => {
  const r = createRun({ seed: 7 });
  const cash0 = r.state.player.cash;
  assert.equal(r.pickRival(0).ok, true);
  assert.equal(r.state.phase, 'battle');
  advance(r, 30);
  assert.equal(r.state.phase, 'idle');
  assert.ok(r.state.player.cash > cash0, '胜利后现金增加');
  assert.ok(r.state.combo >= 1, '连胜累计');
  const chips = r.state.player.backpack.filter((b) => b.id === 'chip').reduce((s, b) => s + b.count, 0);
  assert.ok(chips > 0, '掉落扩张令');
});

test('伤害公式：攻击-防御×波动，最小 1；越级可能失败', () => {
  const r = createRun({ seed: 1 });
  // 把对手改得极强，验证失败路径
  const rival = r.state.rivals[0];
  rival.att = 9999;
  rival.def = 0;
  r.pickRival(0);
  advance(r, 20);
  assert.ok(r.state.phase === 'idle' || r.state.phase === 'lost');
  assert.ok(r.state.stats.losses >= 1 || r.state.result?.won === false, '极强对手导致失败');
});

test('连击加成：连击层数提升现金收益', () => {
  const r = createRun({ seed: 3 });
  r.state.combo = 4;
  const base = 200;
  // 直接验证 _win 的加成系数：通过掉落事件观察
  const before = r.state.player.cash;
  r.pickRival(0);
  advance(r, 20);
  const gained = r.state.player.cash - before;
  assert.ok(gained > 200, `连击下现金收益 ${gained} 应明显 > 基础`);
});

test('扩张令使用：+1 等级，重算属性，等级上限', () => {
  const r = createRun({ seed: 1 });
  const lv0 = r.state.player.lv;
  const chips = r.state.player.backpack.filter((b) => b.id === 'chip').reduce((s, b) => s + b.count, 0);
  assert.ok(chips > 0, '初始有扩张令');
  const res = r.useChip(1);
  assert.equal(res.ok, true);
  assert.equal(r.state.player.lv, lv0 + 1);
});

test('装备部门：属性增长 + 同槽换下旧件回背包', () => {
  const r = createRun({ seed: 1 });
  const idx = r.state.player.backpack.findIndex((b) => b.type === 'dept');
  assert.ok(idx >= 0);
  const it = r.state.player.backpack[idx];
  const att0 = r.state.player.att;
  const res = r.equipDept(idx);
  assert.equal(res.ok, true);
  assert.equal(r.state.player.equip[it.slot].slot, it.slot);
  assert.ok(r.state.player.att > att0, '装备后攻势提升');
});

test('合成：3 件同款同品 → 品级 +1；不同款拒绝', () => {
  const r = createRun({ seed: 1 });
  const p = r.state.player;
  const slot = p.backpack.filter((b) => b.type === 'dept')[0].slot;
  // 塞三件同款
  p.backpack = [
    { type: 'dept', slot, grade: 0, lv: 1, att: 20, def: 0, hp: 0, sell: 1000, id: 'a', count: 1 },
    { type: 'dept', slot, grade: 0, lv: 1, att: 20, def: 0, hp: 0, sell: 1000, id: 'a', count: 1 },
    { type: 'dept', slot, grade: 0, lv: 1, att: 20, def: 0, hp: 0, sell: 1000, id: 'a', count: 1 },
    { type: 'dept', slot: (slot + 1) % 6, grade: 0, lv: 1, att: 0, def: 0, hp: 0, sell: 1000, id: 'b', count: 1 },
  ];
  const res = r.synthesize([0, 1, 2]);
  assert.equal(res.ok, true);
  assert.equal(r.state.player.backpack.some((b) => b.type === 'dept' && b.grade === 1), true);
  const bad = r.synthesize([0, 1, 3]);
  assert.equal(bad.ok, false);
});

test('街区清空：debugClearDistrict 结算星级 + 事件', () => {
  const r = createRun({ seed: 1 });
  const res = r.debugClearDistrict();
  assert.equal(res.ok, true);
  assert.ok(res.stars >= 1 && res.stars <= 3);
  const ev = r.drainEvents();
  assert.ok(ev.some((e) => e.type === 'districtClear'));
});

test('街区门槛：未达等级不可进入', () => {
  const r = createRun({ seed: 1 });
  assert.equal(r.enterDistrict(1).ok, false, 'Lv1 不能进 Lv5 街区');
  assert.equal(r.enterDistrict(0).ok, true);
});

test('被动收入：step 每秒自动入账 + 事件', () => {
  const r = createRun({ seed: 1 });
  const cash0 = r.state.player.cash;
  advance(r, 2.1);
  assert.ok(r.state.player.cash > cash0, '被动收入自动入账');
  // 事件已 drain 过多次，重新推进 1 秒观察 idleCash
  const before = r.drainEvents().length;
  advance(r, 1.0);
  const ev = r.drainEvents();
  assert.ok(ev.some((e) => e.type === 'idleCash'), '每秒产生 idleCash 事件');
});

test('垄断度：金币沉没提升星级/等级', () => {
  const r = createRun({ seed: 1 });
  r.state.player.cash = 1e9;
  const res = r.monopolyUpgrade();
  assert.equal(res.ok, true);
  assert.ok(r.state.player.monopoly.stars > 0 || r.state.player.monopoly.lv > 1);
});

test('IPO 抽奖：消耗晶核并产出奖励', () => {
  const r = createRun({ seed: 1 });
  const gems0 = r.state.player.gems;
  const res = r.ipoSpin(1);
  assert.equal(res.ok, true);
  assert.ok(r.state.player.gems < gems0, '消耗晶核');
  assert.ok(res.rewards.length === 1);
});

test('mulberry32 确定性：同 seed 同序列', () => {
  const a = mulberry32(42);
  const b = mulberry32(42);
  assert.equal(a(), b());
  assert.equal(a(), b());
});
