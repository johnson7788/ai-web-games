// tests/sim.test.mjs — 纯逻辑回归（node --test）
import test from 'node:test';
import assert from 'node:assert/strict';
import { createSim, updateSim, drainEvents, getHud, teleportTo, ratingFor } from '../src/game/sim.js';
import { createCourse, cranePlatformX } from '../src/game/course.js';
import { RUN, ACTION, SCORE, LEVELS } from '../config/game.config.js';

const STEP = 1 / 60;
const drive = (run, sec, input = {}) => { for (let i = 0; i < Math.round(sec * 60); i++) updateSim(run, input); };
const find = (run, type) => run.events.some((e) => e.type === type);

test('course: 5 段 / 终点 / 障碍按 z 有序', () => {
  const c = createCourse(() => 0.5);
  assert.equal(c.finishZ, 2000);
  assert.equal(c.sections.length, 5);
  for (let i = 1; i < c.obstacles.length; i++) assert.ok(c.obstacles[i].z >= c.obstacles[i - 1].z);
  const kinds = new Set(c.obstacles.map((o) => o.type));
  for (const t of ['vault', 'slide', 'wallrun', 'crane']) assert.ok(kinds.has(t), `缺障碍类型 ${t}`);
});

test('course: 签名三连矮墙 z=120/132/144', () => {
  const c = createCourse(() => 0.5);
  const zs = c.obstacles.filter((o) => o.type === 'vault' && o.z >= 115 && o.z <= 150).map((o) => o.z);
  assert.ok(zs.includes(120) && zs.includes(132) && zs.includes(144), `签名三连缺失: ${zs}`);
});

test('course: sectionAt / halfWidthAt / checkpointAt', () => {
  const c = createCourse(() => 0.5);
  assert.equal(c.sectionAt(100), 1);
  assert.equal(c.sectionAt(850), 3);
  assert.equal(c.sectionAt(1650), 5);
  assert.equal(c.halfWidthAt(100), LEVELS[0].halfWidth);
  assert.equal(c.halfWidthAt(850), LEVELS[2].halfWidth);
  assert.deepEqual(c.checkpointAt(500), { z: 400, section: 2 });
});

test('createSim: 初始状态（计时 300 / 速度 / 位置）', () => {
  const r = createSim({ seed: 1 });
  assert.equal(r.phase, 'running');
  assert.equal(r.clock, RUN.clockStart);
  assert.equal(r.speed, RUN.speedBase);
  assert.equal(r.player.z, 0);
});

test('自动前进：无输入 z 持续推进（noinput 基线）', () => {
  const r = createSim({ seed: 1 });
  drive(r, 2);
  assert.ok(r.player.z > 15, `2s 应推进 >15m，实际 ${r.player.z.toFixed(1)}`);
});

test('vault: 障碍前按动作 → 成功得分', () => {
  const r = createSim({ seed: 1 });
  teleportTo(r, 38.5);
  const s0 = r.score;
  updateSim(r, { action: true });
  drive(r, 0.8);
  assert.ok(find(r, 'vault'), '应有 vault 事件');
  assert.equal(r.stats.vault, 1);
  assert.ok(r.score > s0, '翻越应得分');
});

test('vault 失败: 不按动作 → 撞停扣 3s', () => {
  const r = createSim({ seed: 1 });
  teleportTo(r, 36);
  drive(r, 0.8);
  assert.ok(find(r, 'hit'), '应有 hit 事件');
  assert.ok(r.clock <= RUN.clockStart - RUN.hitPenalty + 1, '撞墙应扣时间');
  assert.ok(r.stats.hits >= 1);
});

test('slide: 管道前按动作 → 成功', () => {
  const r = createSim({ seed: 1 });
  teleportTo(r, 418.5);
  updateSim(r, { action: true });
  drive(r, 0.9);
  assert.ok(find(r, 'slide'), '应有 slide 事件');
  assert.equal(r.stats.slide, 1);
});

test('wallrun 成功: 缺口前按动作跨越不坠落', () => {
  const r = createSim({ seed: 1 });
  teleportTo(r, 848.5);
  updateSim(r, { action: true });
  drive(r, 1.6);
  assert.ok(find(r, 'wallrun'), '应有 wallrun 事件');
  assert.equal(r.stats.falls, 0, 'wallrun 成功不应坠落');
  assert.ok(r.player.z > 858, '应跨越缺口');
});

test('wallrun 失败: 不按动作 → 坠落回检查点扣 10s', () => {
  const r = createSim({ seed: 1 });
  teleportTo(r, 848);
  for (let i = 0; i < 120 && r.stats.falls === 0; i++) updateSim(r, {});
  assert.equal(r.stats.falls, 1);
  assert.ok(r.clock <= RUN.clockStart - RUN.fallPenalty + 1);
  assert.equal(r.player.z, 800, '应回段 3 检查点 800');
});

test('crane: 对齐平台跨越，错位坠落', () => {
  // 对齐平台 → 跨越缺口不坠落
  const b = createSim({ seed: 1 });
  const crane = b.course.obstacles.find((o) => o.type === 'crane');
  teleportTo(b, crane.z - 1.5, cranePlatformX(crane, 0.3));
  drive(b, 0.6);
  assert.equal(b.stats.falls, 0, '对齐应跨越');
  assert.ok(b.player.z > crane.z, '应推进越过缺口');
  // 错位 → 坠落
  const a = createSim({ seed: 1 });
  const ca = a.course.obstacles.find((o) => o.type === 'crane');
  const px = cranePlatformX(ca, 0.3);
  teleportTo(a, ca.z - 1.5, px + 6);
  drive(a, 0.6);
  assert.ok(a.stats.falls >= 1, '错位应坠落');
});

test('侧向坠落: 超出段宽度 → 回检查点', () => {
  const r = createSim({ seed: 1 });
  teleportTo(r, 100, 50); // 远超段 1 宽度 9
  updateSim(r, {});
  assert.ok(find(r, 'fall'));
  assert.equal(r.player.z, 0);
});

test('combo: 连续成功 ×2 叠倍率', () => {
  const r = createSim({ seed: 1 });
  teleportTo(r, 118);
  for (let i = 0; i < 60 * 6 && r.stats.vault < 3; i++) {
    const next = r.course.obstacles.find((o) => !o.cleared && o.type === 'vault' && o.z > r.player.z);
    const dz = next ? next.z - r.player.z : 99;
    updateSim(r, { action: dz < ACTION.trigger - 0.2 && dz > 0.3 });
  }
  assert.equal(r.stats.vault, 3);
  assert.ok(r.stats.topCombo >= 2, `连击应 ≥2，实际 ${r.stats.topCombo}`);
});

test('冲刺: 耗体力，停止后回复', () => {
  const r = createSim({ seed: 1 });
  drive(r, 2, { sprint: true });
  assert.ok(r.stamina < RUN.staminaMax, '冲刺应耗体力');
  const low = r.stamina;
  drive(r, 2, { sprint: false });
  assert.ok(r.stamina > low, '停止冲刺应回体力');
});

test('时间加成拾取: +10s', () => {
  const r = createSim({ seed: 1 });
  teleportTo(r, 228);
  drive(r, 0.6);
  assert.ok(find(r, 'pickup'), '应有 pickup 事件');
  assert.ok(r.clock > RUN.clockStart - 5, '拾取后时间应回升');
});

test('里程碑: 每 100m 发事件', () => {
  const r = createSim({ seed: 1 });
  teleportTo(r, 99);
  drive(r, 0.6);
  assert.ok(find(r, 'milestone'), '应有 milestone 事件');
});

test('冲线: 到终点 → finished / win', () => {
  const r = createSim({ seed: 1 });
  teleportTo(r, RUN.finishZ - 10);
  drive(r, 3);
  assert.equal(r.phase, 'finished');
  assert.equal(r.win, true);
});

test('超时: 时间归零 → finished / timeout', () => {
  const r = createSim({ seed: 1 });
  r.clock = 0.05;
  drive(r, 0.2);
  assert.equal(r.phase, 'finished');
  assert.equal(r.win, false);
});

test('rating: 分档', () => {
  assert.equal(ratingFor(7000), 'S');
  assert.equal(ratingFor(4500), 'A');
  assert.equal(ratingFor(2500), 'B');
  assert.equal(ratingFor(10), 'C');
});

test('hud 形状完整', () => {
  const r = createSim({ seed: 1 });
  drive(r, 3);
  const h = getHud(r);
  for (const k of ['phase', 'time', 'dist', 'speed', 'score', 'combo', 'stamina', 'section']) assert.ok(k in h, `缺 hud 字段 ${k}`);
});

test('perf: 3600 步 < 1.5s', () => {
  const r = createSim({ seed: 5 });
  const t0 = performance.now();
  for (let i = 0; i < 3600; i++) updateSim(r, { steer: Math.sin(i / 40), action: i % 90 === 0, sprint: i % 300 < 100 });
  assert.ok(performance.now() - t0 < 1500);
});
