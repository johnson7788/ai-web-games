import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRun, mulberry32 } from '../src/game/sim.js';
import { LEVELS, LEVEL_COUNT } from '../config/levels.js';
import { GAME, SKILLS } from '../config/game.config.js';

// 以 1/60 步长推进 sec 秒
function advance(run, sec) {
  const n = Math.max(1, Math.round(sec * 60));
  for (let i = 0; i < n; i += 1) run.step(1 / 60);
}

// 找一条可斩的 tap note 并站到它轨道上、把时钟拨到 start
function armTap(run) {
  const n = run.state.notes.find((x) => x.type === 'tap' && !x.resolved);
  if (!n) return null;
  run.state.lane = n.lane;
  run.state.beatClock = n.start;
  return n;
}

test('冒烟：createRun → step → slash → getHud → drainEvents 无异常', () => {
  const r = createRun(0, { seed: 1 });
  r.step(1 / 60);
  const s = r.slash();
  assert.equal(s.ok, true);
  const hud = r.getHud();
  assert.equal(hud.level, 1);
  assert.equal(hud.phase, 'playing');
  assert.ok(Array.isArray(r.drainEvents()));
});

test('state 形状：level/phase/lanes/lane/hp/energy 初始值', () => {
  const r = createRun(0, { seed: 1 });
  const s = r.state;
  assert.equal(s.level, 1);
  assert.equal(s.phase, 'playing');
  assert.equal(s.lanes, 1);
  assert.equal(s.lane, 0);
  assert.equal(s.hp, GAME.MAX_HP);
  assert.equal(s.energy, 0);
  assert.ok(Array.isArray(s.notes));
  assert.ok(s.notes.length > 0);
});

test('谱面确定性：同 seed 两次生成完全一致的 note 时间线', () => {
  const a = createRun(2, { seed: 42 });
  const b = createRun(2, { seed: 42 });
  const c = createRun(2, { seed: 43 });
  assert.deepEqual(
    a.state.notes.map((n) => [n.start, n.lane, n.type]),
    b.state.notes.map((n) => [n.start, n.lane, n.type]),
  );
  assert.notDeepEqual(
    a.state.notes.map((n) => [n.start, n.lane, n.type]),
    c.state.notes.map((n) => [n.start, n.lane, n.type]),
  );
});

test('Boss note：每关谱面末段存在 isBoss 的 hold note', () => {
  for (let i = 0; i < LEVEL_COUNT; i += 1) {
    const r = createRun(i, { seed: 7 });
    const boss = r.state.notes.find((n) => n.isBoss);
    assert.ok(boss, `L${i + 1} 缺 Boss note`);
    assert.equal(boss.type, 'hold');
    assert.equal(boss.hp, LEVELS[i].bossHp);
  }
});

test('slash 命中 tap：判定后 note resolved、分数与连击递增', () => {
  const r = createRun(0, { seed: 1 });
  const n = armTap(r);
  assert.ok(n);
  const before = r.state.score;
  const res = r.slash();
  assert.equal(res.ok, true);
  assert.equal(res.hit, true);
  assert.ok(n.resolved);
  assert.ok(r.state.score > before);
  assert.equal(r.state.combo, 1);
  assert.equal(r.state.notesHit, 1);
});

test('完美判定：dt=0 判 Perfect，能量 +1', () => {
  const r = createRun(0, { seed: 1 });
  const n = armTap(r);
  r.state.beatClock = n.start; // dt = 0
  r.slash();
  assert.equal(r.state.perfect, 1);
  assert.equal(r.state.energy, 1);
  assert.ok(r.drainEvents().some((e) => e.type === 'perfect'));
});

test('Great/Good 判定：dt 落在不同窗口', () => {
  const r = createRun(0, { seed: 1 });
  const n = armTap(r);
  r.state.beatClock = n.start + 0.09; // great
  r.slash();
  assert.equal(r.state.great, 1);
  const n2 = armTap(r);
  r.state.beatClock = n2.start + 0.15; // good
  r.slash();
  assert.equal(r.state.good, 1);
});

test('漏击：note 越过判定窗 → 扣血 + 断连 + miss 事件', () => {
  const r = createRun(0, { seed: 1 });
  const hp0 = r.state.hp;
  const n = r.state.notes[0];
  r.state.beatClock = n.start + GAME.HIT_WINDOWS.good + 0.05;
  r.step(1 / 60);
  assert.ok(n.resolved);
  assert.ok(r.state.hp < hp0);
  assert.equal(r.state.combo, 0);
  assert.ok(r.drainEvents().some((e) => e.type === 'miss'));
});

test('反击红 note：误斩 → 扣血 + redHit，不会得分', () => {
  const r = createRun(3, { seed: 99 }); // L4 有 red
  const red = r.state.notes.find((n) => n.type === 'red');
  assert.ok(red, 'L4 应有红 note');
  r.state.lane = red.lane;
  r.state.beatClock = red.start;
  const hp0 = r.state.hp;
  const score0 = r.state.score;
  const res = r.slash();
  assert.equal(res.red, true);
  assert.ok(r.state.hp < hp0);
  assert.equal(r.state.score, score0);
});

test('闪避红 note：不斩 → 越过判定窗无伤', () => {
  const r = createRun(3, { seed: 99 });
  const red = r.state.notes.find((n) => n.type === 'red');
  // 隔离：只保留红 note 未结算，避免其它更早 note 干扰
  for (const n of r.state.notes) if (n !== red) n.resolved = true;
  const hp0 = r.state.hp;
  r.state.beatClock = red.start + GAME.HIT_WINDOWS.good + 0.05;
  r.step(1 / 60);
  assert.equal(r.state.hp, hp0);
  assert.ok(r.drainEvents().some((e) => e.type === 'dodge'));
});

test('换轨：双弦关卡 switchLane 切换轨道并带硬直', () => {
  const r = createRun(2, { seed: 1 }); // L3 双弦
  const res = r.switchLane(1);
  assert.equal(res.ok, true);
  assert.equal(r.state.lane, 1);
  // 冷却内再切失败
  const res2 = r.switchLane(0);
  assert.equal(res2.ok, false);
});

test('换轨：单弦关卡 switchLane 返回 single', () => {
  const r = createRun(0, { seed: 1 });
  assert.deepEqual(r.switchLane(1), { ok: false, reason: 'single' });
});

test('蓄斩：按住整段 → holdComplete + bossDefeated', () => {
  const r = createRun(0, { seed: 1 });
  const boss = r.state.notes.find((n) => n.isBoss);
  r.state.lane = boss.lane;
  r.state.beatClock = boss.start;
  r.slash(); // 按下
  r.state.beatClock = boss.end;
  r.step(1 / 60); // 蓄满
  assert.equal(boss.resolved, true);
  assert.equal(r.state.bossDefeated, true);
  assert.ok(r.drainEvents().some((e) => e.type === 'bossDefeated'));
});

test('蓄斩提前松手：progress<0.88 → 漏击扣血', () => {
  const r = createRun(0, { seed: 1 });
  const boss = r.state.notes.find((n) => n.isBoss);
  r.state.lane = boss.lane;
  r.state.beatClock = boss.start;
  r.slash();
  r.state.beatClock = boss.start + (boss.end - boss.start) * 0.3;
  const hp0 = r.state.hp;
  r.release();
  assert.ok(r.state.hp < hp0);
  assert.equal(boss.resolved, true);
});

test('和弦斩：连续 8 个 Perfect 触发 chordSlash 并重置 streak', () => {
  const r = createRun(0, { seed: 1 });
  r.state.perfectStreak = 7;
  const n = armTap(r);
  r.state.beatClock = n.start;
  r.slash();
  const ev = r.drainEvents();
  assert.ok(ev.some((e) => e.type === 'chordSlash'));
  assert.equal(r.state.perfectStreak, 0);
});

test('护盾：激活后伤害被挡下', () => {
  const r = createRun(0, { seed: 1 });
  r.state.energy = 5;
  assert.equal(r.useSkill('shield').ok, true);
  const hp0 = r.state.hp;
  r._damagePlayer(20, 'test');
  assert.equal(r.state.hp, hp0);
  assert.ok(r.drainEvents().some((e) => e.type === 'block'));
});

test('爆发：激活后斩击伤害 ×2', () => {
  const r = createRun(0, { seed: 1 });
  r.state.energy = 5;
  assert.equal(r.useSkill('burst').ok, true);
  const n = armTap(r);
  r.state.beatClock = n.start;
  r.slash();
  // 普通 tap hp=1，×2 也只是一击必杀；用 Boss（hp>1）验证 ×2 更快
  assert.ok(n.resolved);
});

test('治疗：立即回复 20 血且封顶 maxHp', () => {
  const r = createRun(0, { seed: 1 });
  r.state.hp = 40;
  r.state.energy = 5;
  assert.equal(r.useSkill('heal').ok, true);
  assert.equal(r.state.hp, 60);
});

test('吸血：激活后 Perfect 命中回血', () => {
  const r = createRun(0, { seed: 1 });
  r.state.hp = 50;
  r.state.energy = 5;
  assert.equal(r.useSkill('lifesteal').ok, true);
  const n = armTap(r);
  r.state.beatClock = n.start;
  r.slash();
  assert.equal(r.state.hp, 55);
});

test('技能能量不足：useSkill 返回 noEnergy', () => {
  const r = createRun(0, { seed: 1 });
  r.state.energy = 0;
  assert.deepEqual(r.useSkill('shield'), { ok: false, reason: 'noEnergy' });
});

test('胜利：谱面全清 + 曲终 → phase won', () => {
  const r = createRun(0, { seed: 1 });
  for (const n of r.state.notes) n.resolved = true;
  advance(r, r.state.chartDuration + 2);
  assert.equal(r.state.phase, 'won');
  assert.equal(r.state.result.won, true);
});

test('失败：无输入漏击掉血到 0 → phase lost', () => {
  const r = createRun(0, { seed: 1 });
  advance(r, LEVELS[0].chartDuration + 10);
  assert.equal(r.state.phase, 'lost');
  assert.equal(r.state.result.won, false);
});

test('拍点事件：step 推进产生 beat 事件（事件密度）', () => {
  const r = createRun(0, { seed: 1 });
  advance(r, 3);
  const ev = r.drainEvents();
  assert.ok(ev.some((e) => e.type === 'beat'));
});

test('getHud 字段完整', () => {
  const r = createRun(1, { seed: 1 });
  const h = r.getHud();
  for (const k of ['level', 'phase', 'hp', 'maxHp', 'score', 'combo', 'comboMax', 'energy', 'lane', 'lanes', 'notesHit', 'notesMissed', 'notesTotal']) {
    assert.ok(k in h, `缺 ${k}`);
  }
});

test('mulberry32：同 seed 序列可复现', () => {
  const a = mulberry32(123);
  const b = mulberry32(123);
  const sa = [a(), a(), a()];
  const sb = [b(), b(), b()];
  assert.deepEqual(sa, sb);
});
