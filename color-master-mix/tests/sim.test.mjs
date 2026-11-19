import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRun, mulberry32 } from '../src/game/sim.js';
import { LEVELS, validateLevel } from '../config/shapes.js';
import { GAME } from '../config/game.config.js';
import { PALETTE, colorHex } from '../config/colors.js';

function firstFree(run) {
  return run.regions.find((r) => !r.locked);
}

test('createRun：初始为 playing，total>0，levelStart 已入队', () => {
  const run = createRun(0);
  assert.equal(run.state.phase, 'playing');
  assert.ok(run.state.total > 0);
  const evs = run.drainEvents();
  assert.ok(evs.some((e) => e.type === 'levelStart'));
});

test('tap 给分格上色并发出 regionFill', () => {
  const run = createRun(0);
  run.drainEvents();
  const r = firstFree(run);
  const res = run.tap(r.id);
  assert.equal(res.ok, true);
  assert.equal(run.regions[r.id].colored, true);
  assert.equal(run.state.filled, 1);
  assert.ok(run.drainEvents().some((e) => e.type === 'regionFill'));
});

test('tap 同一格两次：第二次拒绝', () => {
  const run = createRun(0);
  run.drainEvents();
  const r = firstFree(run);
  run.tap(r.id);
  const res = run.tap(r.id);
  assert.equal(res.ok, false);
  assert.equal(run.state.filled, 1);
});

test('selectFamily/selectShade 设置颜色索引', () => {
  const run = createRun(0);
  run.drainEvents();
  assert.equal(run.selectFamily(3).ok, true);
  assert.equal(run.selectShade(5).ok, true);
  assert.equal(run.colorIndex(), 3 * GAME.SHADES + 5);
});

test('undo 撤销最近一次上色并断连击', () => {
  const run = createRun(0);
  run.drainEvents();
  const r = firstFree(run);
  run.tap(r.id);
  run.tap(run.regions.find((x) => x.id !== r.id && !x.locked).id);
  assert.equal(run.state.filled, 2);
  run.undo();
  assert.equal(run.state.filled, 1);
  assert.equal(run.state.combo, 0);
  assert.equal(run.regions[r.id].colored, true);
});

test('全部上色即胜利并结算星级', () => {
  const run = createRun(0);
  run.drainEvents();
  let guard = 0;
  while (run.state.phase === 'playing' && guard < 500) {
    const t = run.regions.find((x) => !x.colored && x.unlocked);
    if (!t) break;
    run.tap(t.id);
    guard += 1;
  }
  assert.equal(run.state.phase, 'won');
  assert.equal(run.state.filled, run.state.total);
  assert.ok(run.state.stars >= 1 && run.state.stars <= 3);
  assert.ok(run.drainEvents().some((e) => e.type === 'win'));
});

test('封印格：未解锁不可涂，邻居上色后解锁', () => {
  const lv = LEVELS.findIndex((l) => l.cells.some((c) => c.locked));
  const run = createRun(lv);
  run.drainEvents();
  const rock = run.regions.find((r) => r.locked);
  assert.equal(run.tap(rock.id).ok, false);
  const freeNeighbor = rock.neighbors.find((n) => !run.regions[n].locked);
  run.tap(freeNeighbor);
  assert.equal(run.regions[rock.id].unlocked, true);
  assert.equal(run.tap(rock.id).ok, true);
});

test('超时判定为失败', () => {
  const run = createRun(0);
  run.drainEvents();
  run.step(run.state.totalTime + 0.1);
  assert.equal(run.state.phase, 'lost');
  assert.equal(run.state.outcome, 'lose');
  assert.ok(run.drainEvents().some((e) => e.type === 'lose'));
});

test('magicFill 免费填充一格且扣次数', () => {
  const run = createRun(0);
  run.drainEvents();
  const before = run.state.magicFillsLeft;
  const res = run.magicFill();
  assert.equal(res.ok, true);
  assert.equal(run.state.filled, 1);
  assert.equal(run.state.magicFillsLeft, before - 1);
  assert.ok(run.drainEvents().some((e) => e.type === 'magicFill'));
});

test('连击：窗口内连涂叠加，超窗归零', () => {
  const run = createRun(0);
  run.drainEvents();
  const a = run.regions[0];
  const b = run.regions[1];
  run.tap(a.id); // combo 1
  run.tap(b.id); // 窗口内 → combo 2
  assert.equal(run.state.combo, 2);
  run.step(GAME.COMBO_WINDOW + 0.5);
  const c = run.regions.find((x) => x.id !== a.id && x.id !== b.id);
  run.tap(c.id); // 超窗 → 重新从 1
  assert.equal(run.state.combo, 1);
  assert.ok(run.state.maxCombo >= 2);
});

test('分数随连击递增', () => {
  const run = createRun(0);
  run.drainEvents();
  run.tap(run.regions[0].id);
  const s1 = run.state.score;
  run.tap(run.regions[1].id);
  const s2 = run.state.score;
  assert.ok(s2 - s1 > GAME.FILL_SCORE, '连击第二格分数应高于基础分');
});

test('getHud 返回关键字段', () => {
  const run = createRun(0);
  const hud = run.getHud();
  assert.equal(hud.level, 1);
  assert.equal(hud.filled, 0);
  assert.equal(hud.total, run.state.total);
  assert.equal(typeof hud.score, 'number');
});

test('mulberry32 可复现', () => {
  const a = mulberry32(42);
  const b = mulberry32(42);
  for (let i = 0; i < 10; i += 1) assert.equal(a(), b());
});

test('所有关卡结构合法且可解', () => {
  for (const lv of LEVELS) {
    assert.ok(lv.cells.length >= 6, `${lv.shape} 分格太少`);
    assert.deepEqual(validateLevel(lv), [], `${lv.shape} 不可解`);
  }
});

test('色板为 8×8 且全部唯一', () => {
  assert.equal(PALETTE.length, GAME.FAMILIES);
  const all = [];
  for (const fam of PALETTE) {
    assert.equal(fam.shades.length, GAME.SHADES);
    for (const c of fam.shades) all.push(c);
  }
  assert.equal(new Set(all).size, 64);
  for (const c of all) assert.match(c, /^#[0-9a-f]{6}$/i);
  assert.equal(colorHex(0), PALETTE[0].shades[0]);
});
