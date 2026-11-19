import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createRun, reflect, stepDir, mulberry32, DIR, OPPOSITE,
} from '../src/game/sim.js';
import { LEVELS, LEVEL_COUNT } from '../config/levels.js';
import { GAME } from '../config/game.config.js';

// 以 1/60 步长推进 sec 秒
function advance(run, sec) {
  const n = Math.max(1, Math.round(sec * 60));
  for (let i = 0; i < n; i += 1) run.step(1 / 60);
}

test('冒烟：createRun → step → getHud → drainEvents 无异常', () => {
  const r = createRun(0, { seed: 1 });
  r.step(1 / 60);
  const hud = r.getHud();
  assert.equal(hud.level, 1);
  assert.equal(hud.phase, 'countdown');
  assert.ok(Array.isArray(r.drainEvents()));
});

test('state 形状：level/phase/size/grid/start/end/arrow', () => {
  const r = createRun(0, { seed: 1 });
  const s = r.state;
  assert.equal(s.level, 1);
  assert.equal(s.phase, 'countdown');
  assert.equal(s.size, LEVELS[0].grid + 2);
  assert.equal(s.grid.length, s.size);
  assert.equal(s.grid[0].length, s.size);
  assert.ok(s.start.x === 0 || s.start.y === 0 || s.start.x === s.size - 1 || s.start.y === s.size - 1);
  assert.ok([DIR.LEFT, DIR.RIGHT, DIR.TOP, DIR.BOTTOM].includes(s.arrow));
  assert.equal(s.grid[s.end.x][s.end.y].kind, 'gate');
});

test('镜面反射：reflect 覆盖 "/" 与 "\\" 四向且可逆', () => {
  assert.equal(reflect(1, DIR.RIGHT), DIR.BOTTOM);
  assert.equal(reflect(1, DIR.BOTTOM), DIR.RIGHT);
  assert.equal(reflect(1, DIR.LEFT), DIR.TOP);
  assert.equal(reflect(1, DIR.TOP), DIR.LEFT);
  assert.equal(reflect(2, DIR.RIGHT), DIR.TOP);
  assert.equal(reflect(2, DIR.TOP), DIR.RIGHT);
  assert.equal(reflect(2, DIR.LEFT), DIR.BOTTOM);
  assert.equal(reflect(2, DIR.BOTTOM), DIR.LEFT);
});

test('stepDir 与 OPPOSITE 语义', () => {
  assert.deepEqual(stepDir({ x: 2, y: 2 }, DIR.RIGHT), { x: 3, y: 2 });
  assert.deepEqual(stepDir({ x: 2, y: 2 }, DIR.TOP), { x: 2, y: 1 });
  assert.equal(OPPOSITE[DIR.LEFT], DIR.RIGHT);
  assert.equal(OPPOSITE[DIR.TOP], DIR.BOTTOM);
});

test('每关生成：棱镜数量、出口门、起终不同、路径合法', () => {
  for (let i = 0; i < LEVEL_COUNT; i += 1) {
    const r = createRun(i, { seed: 99 + i });
    const s = r.state;
    let mirrors = 0;
    let voids = 0;
    for (const col of s.grid) {
      for (const c of col) {
        if (c.kind === 'mirror') mirrors += 1;
        else if (c.kind === 'void') voids += 1;
      }
    }
    assert.ok(mirrors >= 1, `L${i + 1} 至少 1 块棱镜`);
    assert.ok(mirrors <= LEVELS[i].pad, `L${i + 1} 棱镜不超过 pad`);
    assert.equal(voids, LEVELS[i].voidCount, `L${i + 1} 黑洞数量`);
    assert.notDeepEqual(s.start, s.end, `L${i + 1} 起终不同`);
    assert.equal(s.path[0].x, s.start.x, `L${i + 1} 路径起点`);
    assert.equal(s.path[s.path.length - 1].x, s.end.x, `L${i + 1} 路径终点`);
    assert.ok(s.path.length === mirrors + 2, `L${i + 1} 路径长度=棱镜+2`);
  }
});

test('倒计时：step 扣减并跨整秒发 countdownTick', () => {
  const r = createRun(0, { seed: 1 });
  r.drainEvents();
  r.step(0.5);
  assert.ok(r.state.timeLeft < LEVELS[0].duration);
  const before = Math.ceil(r.state.countdown);
  while (Math.ceil(r.state.countdown) === before) r.step(1 / 60);
  const ev = r.drainEvents();
  assert.ok(ev.some((e) => e.type === 'countdownTick' && typeof e.timeLeft === 'number'));
});

test('倒计时结束进入 memorize，再进入 predict，棱镜先显后隐', () => {
  const r = createRun(0, { seed: 1 });
  advance(r, GAME.COUNTDOWN + 0.2);
  assert.equal(r.state.phase, 'memorize');
  assert.equal(r.state.mirrorsVisible, true);
  advance(r, LEVELS[0].memorizeSec + 0.2);
  assert.equal(r.state.phase, 'predict');
  assert.equal(r.state.mirrorsVisible, false);
});

test('predict：猜中 → resolving → won（3 星，连击+1）', () => {
  const r = createRun(0, { seed: 1, combo: 0 });
  advance(r, GAME.COUNTDOWN + LEVELS[0].memorizeSec + 0.2);
  const s = r.state;
  const p = r.predict(s.end.x, s.end.y);
  assert.equal(p.ok, true);
  assert.equal(p.correct, true);
  assert.equal(s.phase, 'resolving');
  advance(r, 5);
  assert.equal(s.phase, 'won');
  assert.equal(s.result.won, true);
  assert.equal(s.stars, 3);
  assert.equal(s.combo, 1);
  assert.ok(s.score > 0);
  const ev = r.drainEvents();
  assert.ok(ev.some((e) => e.type === 'win'));
  assert.ok(ev.some((e) => e.type === 'star'));
});

test('predict：猜错 → lost wrong，连击清零', () => {
  const r = createRun(0, { seed: 1, combo: 3 });
  advance(r, GAME.COUNTDOWN + LEVELS[0].memorizeSec + 0.2);
  const s = r.state;
  // 找一块非 end 的门
  let wrong = null;
  for (let x = 0; x < s.size && !wrong; x += 1) {
    for (let y = 0; y < s.size; y += 1) {
      if (s.grid[x][y].kind === 'gate' && !(x === s.end.x && y === s.end.y) && !(x === s.start.x && y === s.start.y)) {
        wrong = { x, y };
        break;
      }
    }
  }
  assert.ok(wrong, '存在错误门可选');
  const p = r.predict(wrong.x, wrong.y);
  assert.equal(p.ok, true);
  assert.equal(p.correct, false);
  advance(r, 5);
  assert.equal(s.phase, 'lost');
  assert.equal(s.result.reason, 'wrong');
  assert.equal(s.combo, 0);
  assert.equal(s.mistakes, 1);
});

test('timeOut：predict 阶段等太久 → lost timeOut', () => {
  const r = createRun(0, { seed: 1 });
  advance(r, LEVELS[0].duration + GAME.COUNTDOWN + LEVELS[0].memorizeSec + 2);
  assert.equal(r.state.phase, 'lost');
  assert.equal(r.state.result.reason, 'timeOut');
});

test('peek：predict 阶段重显棱镜且可重复，标记 peekUsed', () => {
  const r = createRun(0, { seed: 1 });
  advance(r, GAME.COUNTDOWN + LEVELS[0].memorizeSec + 0.2);
  assert.equal(r.state.phase, 'predict');
  const p = r.peek();
  assert.equal(p.ok, true);
  assert.equal(r.state.mirrorsVisible, true);
  assert.equal(r.state.peekUsed, true);
  assert.deepEqual(r.peek(), { ok: true });
  advance(r, GAME.PEEK_SECONDS + 0.2);
  assert.equal(r.state.mirrorsVisible, false);
});

test('predict：非 predict 阶段/非门格 拒绝', () => {
  const r = createRun(0, { seed: 1 });
  assert.deepEqual(r.predict(1, 1), { ok: false, reason: 'notPredictable' });
  advance(r, GAME.COUNTDOWN + LEVELS[0].memorizeSec + 0.2);
  assert.deepEqual(r.predict(1, 1), { ok: false, reason: 'notGate' });
  assert.deepEqual(r.predict(0, 0), { ok: false, reason: 'notGate' });
});

test('mulberry32 可复现', () => {
  const a = mulberry32(7);
  const b = mulberry32(7);
  assert.equal(a(), b());
  assert.equal(a(), b());
  assert.equal(a(), b());
});

test('combo 传入：跨关连击随分数增长', () => {
  const r1 = createRun(0, { seed: 5, combo: 4 });
  advance(r1, GAME.COUNTDOWN + LEVELS[0].memorizeSec + 0.2);
  r1.predict(r1.state.end.x, r1.state.end.y);
  advance(r1, 5);
  assert.equal(r1.state.combo, 5);
  assert.equal(r1.state.score, Math.round(10 * r1.state.stars * 1.5));
});
