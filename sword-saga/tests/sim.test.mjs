import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRun } from '../src/game/sim.js';
import { TOTAL_CHAPTERS, CHAPTERS, chapterDef, MAP } from '../config/gameplay.js';
import { STORY } from '../config/story.js';

test('5 行 smoke test：createRun / step / getHud / drainEvents', () => {
  const r = createRun({ seed: 1 });
  assert.equal(r.phase, 'playing');
  r.step({});
  const hud = r.getHud();
  assert.ok(hud && typeof hud === 'object');
  const evs = r.drainEvents();
  assert.ok(Array.isArray(evs));
});

test('开局：chapter=1 scene=1 mode=map，出生在安全区', () => {
  const r = createRun({ seed: 2 });
  assert.equal(r.chapter, 1);
  assert.equal(r.scene, 1);
  assert.equal(r.mode, 'map');
  assert.ok(r.map.px > 0 && r.map.py > 0);
});

test('走向 NPC 触发开场对话（walk → dialog）', () => {
  const r = createRun({ seed: 3 });
  // 直接瞬移到 NPC 附近（用内部状态验证模式迁移）
  r.map.px = MAP.npc.x;
  r.map.py = MAP.npc.y;
  r.step({ dir: { x: 0, y: 0 } });
  assert.equal(r.mode, 'dialog');
  assert.ok(r.dialog.lines.length > 0);
});

test('对话逐句推进后回到地图（opening → map）', () => {
  const r = createRun({ seed: 4 });
  r.map.px = MAP.npc.x;
  r.map.py = MAP.npc.y;
  r.step({});
  assert.equal(r.mode, 'dialog');
  const n = r.dialog.lines.length;
  for (let i = 0; i < n; i += 1) r.step({ advance: true });
  assert.equal(r.mode, 'map');
  assert.equal(r.map.openingDone, true);
});

test('走到门触发战斗，胜利后回写血量并进入下一章', () => {
  const r = createRun({ seed: 5 });
  r.map.openingDone = true;
  r.map.px = MAP.door.x;
  r.map.py = MAP.door.y;
  r.step({});
  assert.equal(r.mode, 'battle');
  assert.ok(r.battle);

  // 作弊清空敌人，验证胜利 → closing 对话 → 章节推进
  for (const u of r.battle.units) if (u.side === 'enemy') u.hp = 1;
  // 跑到 hero 回合并普攻（逐步喂入攻击命令直到战斗结束）
  let guard = 0;
  while (r.mode === 'battle' && guard < 600) {
    guard += 1;
    r.step({ menu: r.battle && r.battle.pending ? { type: 'attack', target: 'enemy0' } : null });
  }
  assert.notEqual(r.mode, 'battle', '战斗应已结束');
  // 清掉 closing 对话
  while (r.mode === 'dialog' && guard < 1200) { guard += 1; r.step({ advance: true }); }
  assert.equal(r.chapter, 2);
  assert.equal(r.stats.battlesWon, 1);
});

test('12 章配置：每章 scene 合法，Boss 在第 4/8/12 章', () => {
  assert.equal(TOTAL_CHAPTERS, 12);
  const bossChapters = CHAPTERS.filter((c) => c.boss).map((c) => c.chapter);
  assert.deepEqual(bossChapters, [4, 8, 12]);
  for (const c of CHAPTERS) {
    assert.ok(c.scene >= 1 && c.scene <= 3);
    assert.ok(c.battles.length >= 1);
  }
});

test('三场景包：每 4 章换场景', () => {
  assert.equal(chapterDef(1).scene, 1);
  assert.equal(chapterDef(4).scene, 1);
  assert.equal(chapterDef(5).scene, 2);
  assert.equal(chapterDef(8).scene, 2);
  assert.equal(chapterDef(9).scene, 3);
  assert.equal(chapterDef(12).scene, 3);
});

test('剧情数据：12 章全部存在且每章对白 ≤8 句', () => {
  for (let c = 1; c <= 12; c += 1) {
    const s = STORY[c];
    assert.ok(s, `第 ${c} 章剧情缺失`);
    const total = (s.npc?.length || 0) + (s.opening?.length || 0) + (s.closing?.length || 0);
    assert.ok(total <= 8, `第 ${c} 章对白 ${total} 句超 8`);
    assert.ok(total >= 2);
    for (const line of [...(s.npc || []), ...(s.opening || []), ...(s.closing || [])]) {
      assert.ok(line.en && line.en.trim().length > 0, `第 ${c} 章英文缺失`);
      assert.ok(line.zh && line.zh.trim().length > 0, `第 ${c} 章中文缺失`);
    }
  }
});

test('失败：我方全灭 → phase=dead', () => {
  const r = createRun({ seed: 6 });
  r.map.openingDone = true;
  r.map.px = MAP.door.x;
  r.map.py = MAP.door.y;
  r.step({});
  // 关掉替身，敌人秒杀
  r.battle.foxGuard = false;
  r.battle.byId.hero.hp = 1;
  r.battle.byId.fox.hp = 1;
  for (const u of r.battle.units) if (u.side === 'enemy') { u.atb = 1000; u.atk = 999; }
  r.battle.byId.hero.atb = 0;
  r.battle.byId.fox.atb = 0;
  let guard = 0;
  while (r.mode === 'battle' && guard < 600) { guard += 1; r.step({}); }
  assert.equal(r.phase, 'dead');
});

test('通关 12 章 → phase=victory（taleComplete）', () => {
  const r = createRun({ seed: 7, startChapter: 12 });
  r.map.openingDone = true;
  r.map.px = MAP.door.x;
  r.map.py = MAP.door.y;
  r.step({});
  for (const u of r.battle.units) if (u.side === 'enemy') u.hp = 1;
  let guard = 0;
  while (r.mode === 'battle' && guard < 600) { guard += 1; r.step({ menu: r.battle && r.battle.pending ? { type: 'attack', target: 'enemy0' } : null }); }
  while (r.mode === 'dialog' && guard < 1200) { guard += 1; r.step({ advance: true }); }
  assert.equal(r.phase, 'victory');
  assert.ok(r.drainEvents().some((e) => e.type === 'taleComplete') || r.stats.chaptersCleared === 12);
});
