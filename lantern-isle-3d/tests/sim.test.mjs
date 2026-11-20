// 纯逻辑单测：sim（负重/点灯/风暴/任务/NPC 校验）、terrain（高度场一致性/阻挡）、npc-agent（意图与降级）。
// 3D 游戏的可测性来自「判定全在 sim」——这里跑不到 WebGL，但玩法数学必须能跑到。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSim, PHASES } from '../src/game/sim.js';
import { CONFIG } from '../config/game.config.js';
import { NPC_PROFILES } from '../config/npc.js';
import { heightAt, blockedAt, slopeAt, isWater } from '../src/game/terrain.js';
import { decide, matchIntent, validate, NpcMemory, affinityTier } from '../src/ai/npc-agent.js';

const P = CONFIG.player;
function simAt(night = 1, seed = 11) {
  const s = createSim(CONFIG, NPC_PROFILES, CONFIG.upgrades);
  s.startNight(night, seed);
  return s;
}
function teleport(sim, x, z) { sim.state.player.x = x; sim.state.player.z = z; }

test('开局：阶段与灯位数量符合关卡配置', () => {
  const s = simAt(1);
  assert.equal(s.state.phase, 'playing');
  const L = CONFIG.levels[0];
  assert.equal(s.state.lanterns.length, CONFIG.stations.filter((x) => L.route.includes(x.zone)).length);
  assert.ok(PHASES.includes('nightEnd'));
});

test('确定性：同 seed 同夜，布局与计时完全一致', () => {
  const a = simAt(3, 2026);
  const b = simAt(3, 2026);
  assert.deepEqual(a.state.lanterns.map((x) => [x.id, x.x, x.z]), b.state.lanterns.map((x) => [x.id, x.x, x.z]));
  assert.deepEqual(a.state.pickups.map((p) => [p.id, +p.x.toFixed(3)]), b.state.pickups.map((p) => [p.id, +p.x.toFixed(3)]));
  for (let i = 0; i < 240; i++) { a.step(1 / 60, {}); b.step(1 / 60, {}); }
  assert.equal(a.state.timeLeft.toFixed(3), b.state.timeLeft.toFixed(3));
});

test('搬灯：负重降速降跳、容量满拒绝、丢灯产生黑暗段', () => {
  const s = simAt(1);
  const p = s.state.pickups.find((x) => x.kind === 'lantern' && !x.big);
  teleport(s, p.x, p.z);
  assert.equal(s.grab().ok, true);
  assert.equal(s.helpers.carryWeight(), 1);
  const mul = s.helpers.carrySpeedMul();
  assert.ok(mul < 1 && mul >= 0.55, `负重应降速，实测 ${mul}`);
  assert.ok(s.helpers.jumpMul() < 1, '负重应削弱跳跃');
  s.state.capacity = 1;
  const p2 = s.state.pickups.find((x) => x.kind === 'lantern' && !x.taken);
  if (p2) { teleport(s, p2.x, p2.z); assert.equal(s.grab().ok, false, '手满了不能再拿'); }
  assert.equal(s.drop().ok, true);
  assert.ok(s.state.darkSegments >= 1);
  assert.equal(s.helpers.carryWeight(), 0);
});

test('点灯：要站近、有灯、有油；引导中移动会打断', () => {
  const s = simAt(1);
  const st = s.state.lanterns[0];
  teleport(s, st.x + 40, st.z);
  assert.equal(s.light().ok, false, '离太远不能点');
  teleport(s, st.x, st.z);
  assert.equal(s.light().ok, false, '手里没灯不能点');
  const lan = s.state.pickups.find((p) => p.kind === 'lantern' && !p.big);
  teleport(s, lan.x, lan.z);
  s.grab();
  teleport(s, st.x, st.z);
  s.state.oil = 0;
  assert.equal(s.light().why, 'no_oil');
  s.state.oil = 5;
  assert.equal(s.light().ok, true);
  s.step(1 / 60, { moved: true });
  assert.equal(s.snapshot().lighting, null, '移动必须打断引导');
  s.light();
  const need = s.snapshot().lighting.need;
  for (let i = 0; i < Math.ceil(need * 60) + 4; i++) s.step(1 / 60, { moved: false });
  assert.equal(s.state.litCount, 1, '站够久必须点亮');
  assert.equal(s.state.oil, 4, '一盏灯烧一份油');
});

test('全点亮 → 夜胜利并结算时间奖励', () => {
  const s = simAt(1);
  s.state.capacity = 9; s.state.oil = 9;
  const pool = s.state.pickups.filter((p) => p.kind === 'lantern');
  for (const st of s.state.lanterns) {
    const l = pool.find((x) => !x.taken);
    if (l) { l.taken = true; s.state.carried.push({ id: l.id, big: false }); }
    teleport(s, st.x, st.z);
    s.light();
    for (let i = 0; i < 400 && s.snapshot().lighting; i++) s.step(1 / 60, {});
  }
  assert.equal(s.state.phase, 'nightEnd');
  assert.equal(s.state.outcome.win, true);
  assert.ok(s.state.outcome.timeBonus > 0);
});

test('风暴归零且有黑灯 → 失败，分数仍进总分', () => {
  const s = simAt(2);
  const before = s.state.totalScore;
  s.state.timeLeft = 0.02;
  for (let i = 0; i < 8; i++) s.step(1 / 60, {});
  assert.equal(s.state.phase, 'nightEnd');
  assert.equal(s.state.outcome.win, false);
  assert.equal(s.state.outcome.why, 'storm');
  assert.ok(s.state.totalScore >= before);
});

test('摔落：回到上一个点亮灯位、掉一盏灯、扣时间', () => {
  const s = simAt(2);
  s.state.respawn = { x: -20, y: 0, z: 5 };
  s.state.carried.push({ id: 'x', big: false });
  const t0 = s.state.timeLeft;
  s.state.player.x = 9; s.state.player.z = 9;
  s.fall();
  assert.equal(s.state.player.x, -20);
  assert.equal(s.state.carried.length, 0);
  assert.ok(s.state.timeLeft < t0);
  assert.equal(s.state.stats.deaths, 1);
});

test('阵风：未解锁预警时崖顶点灯被拒，解锁后允许', () => {
  const s = simAt(4);
  const cliff = s.state.lanterns.find((x) => x.zone === 'cliff');
  assert.ok(cliff, '夜4 应有崖顶灯位');
  s.state.capacity = 6;
  const lan = s.state.pickups.find((p) => p.kind === 'lantern' && !p.taken);
  if (lan) { lan.taken = true; s.state.carried.push({ id: lan.id, big: false }); }
  teleport(s, cliff.x, cliff.z);
  s.state.gustActive = 2;
  assert.equal(s.light().why, 'too_windy');
  s.api.buyUpgrade('warden_warning');
  assert.equal(s.light().ok, true, '解锁看守人预警后应允许在风口点灯');
});

test('任务：NPC 只给规则里的任务，重复给会被拦', () => {
  const s = simAt(3);
  const w = CONFIG.npcs.warden;
  teleport(s, w.x, w.z);
  const r1 = s.talk('warden', { choice: 'oil' });
  assert.equal(r1.ok, true);
  assert.ok(s.state.quests.active.length <= 1, '任务槽位不应爆掉');
  s.state.oil += 2;
  const r2 = s.talk('warden', { choice: 'oil' });
  assert.ok(r2.reply.downgraded || r2.reply.quest_id === null || r2.reply.action === 'dialogue_only', '冷却/重复不该再发同一任务');
});

test('NPC 记忆：会话写进 memory，反序列化后决策一致', () => {
  const s = simAt(1);
  const w = CONFIG.npcs.warden;
  teleport(s, w.x, w.z);
  s.talk('warden', { choice: 'thanks' });
  const mem = s.state.npcState.warden;
  assert.ok(mem.affinity >= 1, `亲和度应上升，实测 ${mem.affinity}`);
  assert.equal(mem.lastTopic, 'thanks');
  const again = createSim(CONFIG, NPC_PROFILES, CONFIG.upgrades);
  again.startNight(1, 11);
  again.state.npcState.warden = JSON.parse(JSON.stringify(mem));
  teleport(again, w.x, w.z);
  assert.equal(again.talk('warden', { choice: 'thanks' }).ok, true);
});

test('地形：sim 与 render 共用同一高度函数；岛外不可走', () => {
  for (const [x, z] of [[-46, 4], [50, -6], [12, -6], [0, 0]]) {
    assert.equal(Number.isFinite(heightAt(x, z)), true);
    assert.ok(slopeAt(x, z) >= 0);
  }
  assert.equal(blockedAt(0, 58), true, '岛外应不可走');
  assert.equal(isWater(58, 58), true, '岛外就是海');
  const spawn = CONFIG.levels[0].spawn;
  assert.equal(blockedAt(spawn.x, spawn.z), false, '出生点必须可站');
});

test('npc-agent：未知输入不抛异常，只降级为对话', () => {
  const prof = NPC_PROFILES.netmender;
  const out = decide({ profile: prof, text: 'asdf qwer 1234', state: { distance: 2, memory: new NpcMemory({}).serialize() }, now: 0 });
  assert.equal(out.action, 'dialogue_only');
  assert.equal(typeof out.dialogueKey, 'string');
  assert.equal(matchIntent('zzz', prof), null);
});

test('npc-agent：坏 quest_id、非法动画、距离过远都被规则层拦下', () => {
  const bad = validate({ dialogueKey: 'x', action: 'offer_quest', quest_id: 'not_a_quest', animation: 'fly' },
    { actions: { offer_quest: {} }, quests: [], animations: ['idle', 'talk'] }, { distance: 2 });
  assert.equal(bad.quest_id, null);
  assert.equal(bad.action, 'dialogue_only');
  assert.equal(bad.animation, 'talk', '非法动画要回落到 talk');
  const far = decide({ profile: NPC_PROFILES.warden, text: 'oil', state: { distance: 40, memory: new NpcMemory({}).serialize() }, now: 0 });
  assert.equal(far.action, 'dialogue_only');
  assert.equal(far.source, 'distance');
  assert.equal(affinityTier(5), 'warm');
  assert.equal(affinityTier(-3), 'cold');
});

test('文案完整性：每个 NPC intent 的 replyKey 在 en/zh 都存在', async () => {
  const { locales } = await import('../config/locales.js');
  for (const prof of Object.values(NPC_PROFILES)) {
    const keys = [
      ...(prof.intents || []).map((i) => i.replyKey),
      prof.idleReply && prof.idleReply.replyKey,
      ...(prof.reactions || []).map((r) => r.replyKey),
    ].filter(Boolean);
    for (const k of keys) {
      for (const lang of ['en', 'zh']) {
        assert.ok(Object.prototype.hasOwnProperty.call(locales[lang], k), `${lang} 缺 key ${k}`);
        assert.ok(String(locales[lang][k]).length > 0, `${lang} 的 ${k} 是空串`);
      }
    }
  }
});

test('升级：规则型与数值型都真的改变机制参数', () => {
  const s = simAt(2);
  s.state.capacity = 4;
  s.state.carried.push({ id: 'a', big: true });
  const before = s.helpers.jumpMul();
  s.api.buyUpgrade('sure_hands');
  assert.equal(s.helpers.jumpMul(), 1, '稳手后负重不再削弱跳跃');
  assert.ok(before < 1);
  assert.equal(s.api.buyUpgrade('cap1').ok, true);
  assert.equal(s.state.capacity, 5);
  assert.equal(s.api.buyUpgrade('cap1').ok, false, '同一升级不能买两次');
});

test('P 输入宽容：coyote 与 jump buffer 写在 config 且被断言', () => {
  assert.ok(P.coyoteMs >= 100 && P.coyoteMs <= 150, 'coyote time 100–150ms');
  assert.ok(P.jumpBufferMs >= 100 && P.jumpBufferMs <= 200, 'jump buffer 100–200ms');
  assert.ok(P.runSpeed > P.walkSpeed * 1.5, '跑应明显快于走');
});
