import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRun, mulberry32 } from '../src/game/sim.js';
import { JUDGE, HP, SCORE, GROOVE, GAME, TRACK_COUNT } from '../config/game.config.js';
import { LEVELS, LEVEL_COUNT } from '../config/levels.js';

const REAL = new Set(['tap', 'hold', 'slide', 'slideEnd']);

function stepCountdown(run) {
  let guard = 0;
  while (run.state.phase === 'countdown' && guard++ < 500) run.step(1 / 60);
}

function seek(run, t) {
  stepCountdown(run);
  let guard = 0;
  while (run.state.time < t && run.state.phase === 'playing' && guard++ < 200000) {
    run.step(Math.min(1 / 60, t - run.state.time));
  }
}

// 完美地命中 t 之前的所有真实 note，保证血量满格到达目标时刻。
function playPerfectTo(run, t) {
  const real = run.state.notes.filter((n) => REAL.has(n.kind) && n.time < t - 1e-6);
  for (const n of real) {
    seek(run, n.time);
    if (run.state.phase !== 'playing') break;
    run.tap(n.track);
    if (n.kind === 'hold') {
      seek(run, n.time + n.dur);
      run.release(n.track);
    }
  }
  seek(run, t);
}

function firstRealNote(run) {
  return run.state.notes.find((n) => REAL.has(n.kind));
}

test('判定窗口常量正确写入 config', () => {
  assert.equal(JUDGE.PERFECT_MS, 60);
  assert.equal(JUDGE.GREAT_MS, 120);
  assert.equal(JUDGE.GROOVE_PERFECT_MS, 75);
  assert.equal(JUDGE.GROOVE_GREAT_MS, 140);
});

test('createRun 以 countdown 开始且四轨就绪', () => {
  const run = createRun(0, { seed: 1 });
  assert.equal(run.state.phase, 'countdown');
  assert.equal(run.state.hp, HP.START);
  assert.equal(run.state.heldTrack.length, TRACK_COUNT);
  assert.equal(run.state.level, 1);
});

test('越界关卡回退到第 1 关', () => {
  const run = createRun(999, { seed: 1 });
  assert.equal(run.state.level, LEVELS[0].index);
});

test('同 seed 谱面可复现', () => {
  const a = createRun(4, { seed: 42 });
  const b = createRun(4, { seed: 42 });
  assert.equal(a.state.notes.length, b.state.notes.length);
  for (let i = 0; i < a.state.notes.length; i += 1) {
    assert.equal(a.state.notes[i].time, b.state.notes[i].time);
    assert.equal(a.state.notes[i].track, b.state.notes[i].track);
  }
});

test('mulberry32 是确定性 RNG', () => {
  const r1 = mulberry32(7);
  const r2 = mulberry32(7);
  assert.equal(r1(), r2());
  assert.equal(r1(), r2());
});

test('倒计时结束后进入 playing 并发出 songStart', () => {
  const run = createRun(0, { seed: 1 });
  stepCountdown(run);
  assert.equal(run.state.phase, 'playing');
  assert.ok(run.drainEvents().some((e) => e.type === 'songStart'));
});

test('Perfect 判定：恰好命中 +100 分、连击 +1', () => {
  const run = createRun(0, { seed: 1 });
  const n = firstRealNote(run);
  seek(run, n.time);
  const res = run.tap(n.track);
  assert.equal(res.ok, true);
  assert.equal(res.grade, 'perfect');
  assert.equal(run.state.score, SCORE.PERFECT);
  assert.equal(run.state.combo, 1);
});

test('Great 判定：晚 90ms 命中 +50 分', () => {
  const run = createRun(0, { seed: 1 });
  const n = firstRealNote(run);
  seek(run, n.time + 0.09);
  const res = run.tap(n.track);
  assert.equal(res.grade, 'great');
  assert.equal(run.state.score, SCORE.GREAT);
  assert.equal(run.state.perfect, 0);
  assert.equal(run.state.great, 1);
});

test('Miss：不点会漏判扣血并断连', () => {
  const run = createRun(0, { seed: 1 });
  const n = firstRealNote(run);
  seek(run, n.time + 0.2);
  assert.equal(n.status, 'missed');
  assert.equal(run.state.hp, HP.START - HP.MISS_DAMAGE);
  assert.equal(run.state.miss, 1);
});

test('HP 归零判负', () => {
  const run = createRun(0, { seed: 1 });
  let guard = 0;
  while ((run.state.phase === 'countdown' || run.state.phase === 'playing') && guard++ < 200000) {
    run.step(1 / 60);
  }
  assert.equal(run.state.phase, 'lost');
  assert.equal(run.state.result.won, false);
});

test('推到谱面结束且血量 >0 判胜并结算星级', () => {
  const run = createRun(0, { seed: 1 });
  const real = run.state.notes.filter((n) => REAL.has(n.kind));
  for (const n of real) {
    seek(run, n.time);
    run.tap(n.track);
    if (n.kind === 'hold') { seek(run, n.time + n.dur); run.release(n.track); }
  }
  seek(run, run.state.duration);
  assert.equal(run.state.phase, 'won');
  assert.ok(run.state.result.stars >= 1);
});

test('假 note：点击扣血断连且不计入命中', () => {
  const run = createRun(6, { seed: 3 });
  const fake = run.state.notes.find((n) => n.kind === 'fake');
  assert.ok(fake, 'L7 应有假 note');
  playPerfectTo(run, fake.time);
  const before = run.state.hp;
  run.tap(fake.track);
  assert.equal(run.state.hp, before - HP.FAKE_DAMAGE);
  assert.equal(fake.status, 'missed');
  assert.equal(fake.grade, null);
});

test('长按：按满时长发 holdEnd 且加奖励分', () => {
  const run = createRun(2, { seed: 5 });
  const hold = run.state.notes.find((n) => n.kind === 'hold');
  assert.ok(hold, 'L3 应有长按 note');
  playPerfectTo(run, hold.time);
  run.tap(hold.track);
  assert.equal(run.state.heldTrack[hold.track], hold.id);
  const before = run.state.score;
  seek(run, hold.time + hold.dur + 0.01);
  assert.equal(hold.holdComplete, true);
  assert.equal(run.state.score, before + SCORE.HOLD_BONUS);
});

test('长按提前松手断连扣血', () => {
  const run = createRun(2, { seed: 5 });
  const hold = run.state.notes.find((n) => n.kind === 'hold');
  playPerfectTo(run, hold.time);
  run.tap(hold.track);
  const hpBefore = run.state.hp;
  run.release(hold.track);
  assert.equal(hold.holdBroken, true);
  assert.equal(run.state.hp, hpBefore - HP.HOLD_BREAK_DAMAGE);
  assert.equal(run.state.combo, 0);
});

test('滑键：slideStart 接 slideEnd 触发 slideChain 加分', () => {
  const run = createRun(3, { seed: 9 });
  const slide = run.state.notes.find((n) => n.kind === 'slide');
  assert.ok(slide, 'L4 应有滑键');
  const end = run.state.notes.find((n) => n.kind === 'slideEnd' && n.track === slide.toTrack);
  assert.ok(end, '滑键应带 slideEnd');
  playPerfectTo(run, slide.time);
  run.tap(slide.track);
  const before = run.state.score;
  seek(run, end.time);
  run.tap(end.track);
  assert.ok(run.drainEvents().some((e) => e.type === 'slideChain'));
  assert.ok(run.state.score > before);
});

test('连续 8 次 Perfect 触发律动模式', () => {
  const run = createRun(0, { seed: 1 });
  const real = run.state.notes.filter((n) => REAL.has(n.kind)).slice(0, GROOVE.STREAK);
  for (const n of real) {
    seek(run, n.time);
    run.tap(n.track);
  }
  assert.equal(run.state.groove, true);
  assert.ok(run.drainEvents().some((e) => e.type === 'grooveOn'));
});

test('律动模式下判定窗口放宽：+70ms 仍算 Perfect', () => {
  const run = createRun(0, { seed: 1 });
  const real = run.state.notes.filter((n) => REAL.has(n.kind));
  for (let i = 0; i < GROOVE.STREAK; i += 1) {
    seek(run, real[i].time);
    run.tap(real[i].track);
  }
  const next = real[GROOVE.STREAK];
  seek(run, next.time + 0.07);
  const res = run.tap(next.track);
  assert.equal(res.grade, 'perfect');
});

test('Great 会重置 Perfect 连击并退出律动模式', () => {
  const run = createRun(0, { seed: 1 });
  const real = run.state.notes.filter((n) => REAL.has(n.kind));
  for (let i = 0; i < GROOVE.STREAK; i += 1) {
    seek(run, real[i].time);
    run.tap(real[i].track);
  }
  const next = real[GROOVE.STREAK];
  seek(run, next.time + 0.09);
  run.tap(next.track);
  assert.equal(run.state.perfectStreak, 0);
  assert.equal(run.state.groove, false);
});

test('每 10 连击发一次 combo 事件', () => {
  const run = createRun(0, { seed: 1 });
  const real = run.state.notes.filter((n) => REAL.has(n.kind)).slice(0, GAME.COMBO_EVENT_STEP);
  for (const n of real) {
    seek(run, n.time);
    run.tap(n.track);
  }
  assert.ok(run.drainEvents().some((e) => e.type === 'combo' && e.combo === GAME.COMBO_EVENT_STEP));
});

test('getHud 返回关键遥测字段', () => {
  const run = createRun(0, { seed: 1 });
  const hud = run.getHud();
  assert.equal(typeof hud.score, 'number');
  assert.equal(typeof hud.combo, 'number');
  assert.equal(typeof hud.hp, 'number');
  assert.equal(hud.totalNotes, run.state.totalNotes);
});

test('12 关全部可生成谱面且 note 时间落在 [0, duration)', () => {
  assert.equal(LEVEL_COUNT, 12);
  for (let i = 0; i < LEVEL_COUNT; i += 1) {
    const run = createRun(i, { seed: 11 });
    const real = run.state.notes.filter((n) => REAL.has(n.kind));
    assert.ok(real.length >= 10, `L${i + 1} note 数过少`);
    for (const n of run.state.notes) {
      assert.ok(n.time >= 0 && n.time < run.state.duration, `L${i + 1} note 时间越界`);
      assert.ok(n.track >= 0 && n.track < TRACK_COUNT);
    }
  }
});
