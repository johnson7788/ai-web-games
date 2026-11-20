import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRun } from '../src/game/sim.js';
import { LEVELS, LEVEL_COUNT } from '../config/levels.js';
import { FORM, STEAM } from '../config/gameplay.js';

function steps(run, n, provider) {
  for (let i = 0; i < n; i += 1) run.step((provider ? provider(i, run) : {}) || {});
}

test('createRun：初始在 playing、第 1 关、3 条命', () => {
  const r = createRun({ seed: 1, level: 1 });
  assert.equal(r.phase, 'playing');
  assert.equal(r.level, 1);
  assert.equal(r.lives, 3);
  assert.equal(r.player.form, FORM.SMALL);
});

test('移动：按住 right 向右推进', () => {
  const r = createRun({ seed: 1, level: 1 });
  const x0 = r.player.x;
  steps(r, 30, () => ({ right: true }));
  assert.ok(r.player.x > x0 + 30, `x 应显著增加（${r.player.x} > ${x0}）`);
});

test('跳跃：按 jump 后 vy < 0（向上）', () => {
  const r = createRun({ seed: 1, level: 1 });
  r.step({ jumpHeld: true });
  assert.ok(r.player.vy < 0, '起跳瞬间 vy 应为负');
});

test('长按跳跃比短按跳得更高', () => {
  function jumpHeight(holdFrames) {
    const r = createRun({ seed: 1, level: 1 });
    const y0 = r.player.y;
    r.step({ jumpHeld: true });
    let minY = Infinity;
    for (let i = 0; i < holdFrames; i += 1) { r.step({ jumpHeld: true }); minY = Math.min(minY, r.player.y); }
    for (let i = 0; i < 140; i += 1) { r.step({ jumpHeld: false }); minY = Math.min(minY, r.player.y); }
    return y0 - minY;
  }
  const longH = jumpHeight(60);
  const shortH = jumpHeight(2);
  assert.ok(longH > shortH, `长按 ${longH}px 应高于短按 ${shortH}px`);
});

test('落地：跳跃后最终回到地面', () => {
  const r = createRun({ seed: 1, level: 1 });
  const y0 = r.player.y;
  r.step({ jumpHeld: true });
  steps(r, 200, () => ({ jumpHeld: false }));
  assert.equal(r.player.y, y0);
  assert.ok(r.player.onGround);
});

test('墙体：向右撞墙会被挡住', () => {
  const r = createRun({ seed: 1, level: 1 });
  const p = r.player;
  r.grid[13][10] = '#'; // 在玩家身体高度放一堵墙（列 10）
  p.x = 10 * 45 - 30;
  p.y = 14 * 45;
  p.onGround = true;
  steps(r, 60, () => ({ right: true }));
  assert.ok(p.x < 10 * 45 + 1, '不应穿透墙');
});

test('顶砖：小形态顶 ? 砖会出道具（M）', () => {
  const r = createRun({ seed: 1, level: 1 });
  // 找 ? 砖位置
  let q = null;
  for (let c = 0; c < r.width; c += 1) for (let rr = 0; rr < 16; rr += 1) if (r.grid[rr][c] === '?') { q = { c, r: rr }; break; }
  assert.ok(q, 'level1 应有 ? 砖');
  const p = r.player;
  p.x = (q.c + 0.5) * 45;
  p.y = 14 * 45; // 站在地面，头顶是 ? 砖
  p.onGround = true;
  r.step({ jumpHeld: true });
  steps(r, 30, () => ({ jumpHeld: true }));
  assert.ok(r.pickups.some((pk) => pk.kind === 'M'), '应顶出扳手包 M');
});

test('顶砖：大形态顶 B 砖会碎砖', () => {
  const r = createRun({ seed: 1, level: 1 });
  let b = null;
  for (let c = 0; c < r.width; c += 1) for (let rr = 0; rr < 16; rr += 1) if (r.grid[rr][c] === 'B') { b = { c, r: rr }; break; }
  assert.ok(b, 'level1 应有 B 砖');
  r.player.form = FORM.BIG;
  r.player.h = 56;
  const p = r.player;
  p.x = (b.c + 0.5) * 45;
  p.y = 14 * 45;
  p.onGround = true;
  r.step({ jumpHeld: true });
  steps(r, 30, () => ({ jumpHeld: true }));
  assert.equal(r.grid[b.r][b.c], '.', '大形态应顶碎 B 砖');
});

test('金币：碰到金币计数 +1', () => {
  const r = createRun({ seed: 1, level: 1 });
  const c = r.coinsList[0];
  r.player.x = c.x;
  r.player.y = c.y + 30;
  r.step({});
  assert.equal(r.coins, 1);
});

test('踩怪：下落踩到敌人头部敌人死亡并得分', () => {
  const r = createRun({ seed: 1, level: 1 });
  const e = r.enemies[0];
  assert.ok(e, 'level1 应有敌人');
  const p = r.player;
  p.x = e.x;
  p.y = e.y - e.h * 0.8; // 脚在敌人中线以上（踩踏判定）
  p.vy = 200; // 下落中
  const before = r.stats.stomps;
  r.step({});
  assert.ok(!e.alive, '敌人应被踩死');
  assert.equal(r.stats.stomps, before + 1);
});

test('撞怪：侧面碰到敌人会变小并受击', () => {
  const r = createRun({ seed: 1, level: 1 });
  const e = r.enemies[0];
  const p = r.player;
  p.form = FORM.BIG;
  p.h = 56;
  p.x = e.x;
  p.y = e.y; // 与敌人同高（侧撞）
  p.invuln = 0;
  r.step({});
  assert.equal(p.form, FORM.SMALL, '大形态应被打回小形态');
});

test('掉坑：落到屏幕下方会死亡并扣命', () => {
  const r = createRun({ seed: 1, level: 3 });
  // level3 有坑
  const p = r.player;
  p.y = 800;
  const lives0 = r.lives;
  r.step({});
  assert.equal(r.lives, lives0 - 1);
  assert.equal(r.stats.deaths, 1);
});

test('扳手：按 wrench 扔出并最终回到手中', () => {
  const r = createRun({ seed: 1, level: 1 });
  r.step({ wrenchHeld: true });
  r.step({ wrenchHeld: false });
  assert.ok(r.wrench, '扳手应已扔出');
  steps(r, 120, () => ({}));
  assert.equal(r.wrench, null, '扳手应回旋回到手中');
});

test('扳手：命中敌人击杀', () => {
  const r = createRun({ seed: 1, level: 1 });
  const e = r.enemies[0];
  const p = r.player;
  p.x = e.x - 100;
  p.y = e.y;
  p.dir = 1;
  r.step({ wrenchHeld: true });
  r.step({ wrenchHeld: false });
  steps(r, 60, () => ({}));
  assert.ok(!e.alive, '扳手去程应命中敌人');
});

test('蒸汽罐：拾取 S 充能 +25', () => {
  const r = createRun({ seed: 1, level: 2 });
  const s = r.pickups.find((pk) => pk.kind === 'S');
  assert.ok(s, 'level2 应有蒸汽罐');
  r.player.x = s.x;
  r.player.y = s.y + 30;
  r.step({});
  assert.equal(r.steam, STEAM.PICKUP);
});

test('蒸汽喷射：满罐按 steam 触发高跳 + 悬停', () => {
  const r = createRun({ seed: 1, level: 1 });
  r.steam = STEAM.MAX;
  r.player.y = 14 * 45;
  r.player.onGround = true;
  r.player.vy = 0;
  r.step({ steamHeld: true });
  r.step({ steamHeld: false });
  assert.ok(r.player.vy < 0, '蒸汽喷射应向上');
  assert.ok(r.player.hover > 0, '应进入悬停');
  assert.equal(r.steam, 0);
});

test('过关：碰到旗杆进入下一关', () => {
  const r = createRun({ seed: 1, level: 1 });
  const flag = LEVELS[0].flag;
  r.player.x = (flag.c + 0.5) * 45;
  r.player.y = 14 * 45;
  r.step({});
  assert.equal(r.level, 2);
  assert.ok(r.events.some((e) => e.type === 'levelClear'));
});

test('通关：第 12 关旗杆后 phase = win', () => {
  const r = createRun({ seed: 1, level: 12 });
  const flag = LEVELS[11].flag;
  r.player.x = (flag.c + 0.5) * 45;
  r.player.y = 14 * 45;
  r.step({});
  assert.equal(r.phase, 'win');
});

test('关卡完整性：12 关每关 16 行、有出生点与旗杆', () => {
  assert.equal(LEVEL_COUNT, 12);
  for (const lv of LEVELS) {
    assert.equal(lv.rows.length, 16, `level ${lv.index} 应为 16 行`);
    assert.ok(lv.playerSpawn, `level ${lv.index} 有出生点`);
    assert.ok(lv.flag, `level ${lv.index} 有旗杆`);
    const w = lv.rows[0].length;
    for (const row of lv.rows) assert.equal(row.length, w, `level ${lv.index} 行宽一致`);
  }
});

test('形态：M 让大形态得分而非再次变大', () => {
  const r = createRun({ seed: 1, level: 1 });
  r.player.form = FORM.BIG;
  r.player.h = 56;
  const score0 = r.score;
  // 直接模拟吃 M（大形态）
  const before = r.player.form;
  r.pickups.push({ id: 999, kind: 'M', x: r.player.x, y: r.player.y - 20, vy: 0, popped: false });
  r.step({});
  assert.equal(r.player.form, before);
  assert.ok(r.score > score0);
});

test('i18n 契约：en/zh 完整且 key 一致', async () => {
  const { locales } = await import('../config/locales.js');
  const en = Object.keys(locales.en);
  const zh = Object.keys(locales.zh);
  assert.deepEqual([...zh].sort(), [...en].sort());
  for (const k of en) assert.ok(typeof locales.zh[k] === 'string' && locales.zh[k].trim(), `zh.${k} 非空`);
});
