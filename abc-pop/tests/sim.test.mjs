import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRun, currentTarget, difficultyFor, getHud } from '../src/game/sim.js';
import { LETTER_COUNT, TOTAL_LEVELS, letterAt } from '../config/levels.js';
import { BRIDGE, ROUND } from '../config/gameplay.js';

function findBubble(run, pred) {
  return run.bubbles.find((b) => pred(b));
}

function tapCorrect(run) {
  const target = currentTarget(run);
  const b = findBubble(run, (x) => target.forms.includes(x.letter));
  if (!b) return false;
  run.step({ tap: { x: b.x, y: b.y } });
  return true;
}

function tapWrong(run) {
  const target = currentTarget(run);
  const b = findBubble(run, (x) => !target.forms.includes(x.letter));
  if (!b) return false;
  run.step({ tap: { x: b.x, y: b.y } });
  return true;
}

function lastEvent(run, type) {
  return run.events.filter((e) => e.type === type);
}

test('开局：level 1 = 字母 A 认读轮', () => {
  const run = createRun({ seed: 1 });
  assert.equal(run.phase, 'playing');
  assert.equal(run.levelIndex, 0);
  assert.equal(getHud(run).letter, 'A');
  assert.equal(getHud(run).round, 0);
});

test('无输入 step 推进时间', () => {
  const run = createRun({ seed: 1 });
  const t0 = run.time;
  run.step({});
  assert.ok(run.time > t0);
});

test('认读轮初始必含 2 个目标字母', () => {
  const run = createRun({ seed: 1 });
  const count = run.bubbles.filter((b) => b.letter === 'A').length;
  assert.ok(count >= 2, `目标 A 应至少 2 个，实际 ${count}`);
});

test('点对：得分 + 连击 + bubblePop 事件', () => {
  const run = createRun({ seed: 1 });
  run.drainEvents();
  tapCorrect(run);
  const evs = run.drainEvents();
  assert.ok(evs.some((e) => e.type === 'bubblePop'));
  assert.equal(run.score, 10);
  assert.equal(run.streak, 1);
});

test('点错：只抖动不扣分，打断连击', () => {
  const run = createRun({ seed: 1 });
  run.drainEvents();
  tapCorrect(run);
  run.drainEvents();
  assert.equal(run.streak, 1);
  const scoreBefore = run.score;
  tapWrong(run);
  const evs = run.drainEvents();
  assert.ok(evs.some((e) => e.type === 'bubbleMiss'));
  assert.equal(run.score, scoreBefore, '点错不扣分');
  assert.equal(run.streak, 0, '点错打断连击');
});

test('连续 5 对触发彩虹桥 + 加分', () => {
  const run = createRun({ seed: 2 });
  run.drainEvents();
  let bridge = false;
  let scoreBefore = 0;
  for (let i = 0; i < 5; i += 1) {
    if (i === 4) scoreBefore = run.score;
    tapCorrect(run);
    const evs = run.drainEvents();
    if (evs.some((e) => e.type === 'bridge')) bridge = true;
  }
  assert.ok(bridge, '第 5 连击应触发 bridge');
  assert.ok(run.score > scoreBefore, '彩虹桥应有加分');
  assert.equal(run.maxStreak, 5);
});

test('认读轮点对 2 次后清关进入大小写轮', () => {
  const run = createRun({ seed: 3 });
  run.drainEvents();
  tapCorrect(run);
  tapCorrect(run);
  const evs = run.drainEvents();
  assert.ok(evs.some((e) => e.type === 'roundClear'));
  assert.ok(evs.some((e) => e.type === 'levelEnter' && e.round === 1));
  assert.equal(getHud(run).round, 1);
});

test('大小写轮：两形态各点一次才清关', () => {
  const run = createRun({ seed: 3 });
  run.jump(0, 1);
  run.drainEvents();
  // 点大写两次：不应清关
  for (let i = 0; i < 2; i += 1) {
    const b = findBubble(run, (x) => x.letter === 'A');
    if (b) run.step({ tap: { x: b.x, y: b.y } });
    run.drainEvents();
  }
  assert.equal(run.round, 1, '只点大写不应清关');
  // 再点小写
  const low = findBubble(run, (x) => x.letter === 'a');
  assert.ok(low, '小写 a 应在场');
  run.step({ tap: { x: low.x, y: low.y } });
  const evs = run.drainEvents();
  assert.ok(evs.some((e) => e.type === 'roundClear'));
  assert.equal(getHud(run).round, 2);
});

test('首词轮：目标带单词', () => {
  const run = createRun({ seed: 4 });
  run.jump(0, 2);
  const hud = getHud(run);
  assert.equal(hud.round, 2);
  assert.ok(hud.target.word, '首词轮应有单词');
  assert.equal(hud.target.word.first, 'A');
});

function clearRound(run) {
  if (run.round === 1) {
    for (const form of currentTarget(run).forms) {
      const b = run.bubbles.find((x) => x.letter === form);
      if (b) run.step({ tap: { x: b.x, y: b.y } });
      run.drainEvents();
    }
  } else {
    for (let i = 0; i < ROUND.GOAL; i += 1) { tapCorrect(run); run.drainEvents(); }
  }
}

test('三个轮次完成后字母递进', () => {
  const run = createRun({ seed: 5 });
  run.jump(0, 0);
  run.drainEvents();
  // 完成 A 的三轮
  for (let round = 0; round < 3; round += 1) {
    clearRound(run);
    if (round < 2) assert.equal(run.round, round + 1);
  }
  assert.equal(run.letterIndex, 1, 'A 完成后应进入 B');
  assert.equal(getHud(run).letter, 'B');
});

test('通关：跳到最后字母完成三轮后 phase=cleared', () => {
  const run = createRun({ seed: 6 });
  run.jump(LETTER_COUNT - 1, 2);
  run.drainEvents();
  tapCorrect(run);
  tapCorrect(run);
  const evs = run.drainEvents();
  assert.ok(evs.some((e) => e.type === 'cleared'));
  assert.equal(run.phase, 'cleared');
});

test('难度曲线：风速/摆动/干扰随 level 递增', () => {
  const d0 = difficultyFor(0);
  const d20 = difficultyFor(20);
  const d60 = difficultyFor(60);
  assert.ok(d60.wind >= d20.wind && d20.wind >= d0.wind);
  assert.ok(d60.swayAmp >= d20.swayAmp && d20.swayAmp >= d0.swayAmp);
  assert.ok(d60.distractors >= d0.distractors);
});

test('同 seed 生成一致（确定性）', () => {
  const a = createRun({ seed: 99 });
  const b = createRun({ seed: 99 });
  assert.deepEqual(a.bubbles.map((x) => x.letter), b.bubbles.map((x) => x.letter));
});

test('drainEvents 清空事件队列', () => {
  const run = createRun({ seed: 1 });
  run.drainEvents();
  tapCorrect(run);
  const evs = run.drainEvents();
  assert.ok(evs.length > 0);
  assert.equal(run.events.length, 0);
});

test('tapMiss：点空处不改变得分', () => {
  const run = createRun({ seed: 1 });
  run.drainEvents();
  run.step({ tap: { x: -100, y: -100 } });
  const evs = run.drainEvents();
  assert.ok(evs.some((e) => e.type === 'tapMiss'));
  assert.equal(run.score, 0);
});

test('getHud 形状完整', () => {
  const run = createRun({ seed: 1 });
  const hud = getHud(run);
  for (const k of ['phase', 'level', 'letter', 'round', 'scene', 'score', 'streak', 'maxStreak', 'progress', 'goal', 'target']) {
    assert.ok(k in hud, `缺字段 ${k}`);
  }
  assert.equal(hud.totalLevels, TOTAL_LEVELS);
});

test('字母表数据：26 字母 ×3 轮', () => {
  assert.equal(LETTER_COUNT, 26);
  assert.equal(TOTAL_LEVELS, 78);
  assert.equal(letterAt(0).char, 'A');
  assert.equal(letterAt(25).char, 'Z');
});

test('场景包：A-J-S 分别落在三章', () => {
  assert.equal(letterAt(0).scene, 0);   // A 晨云
  assert.equal(letterAt(9).scene, 1);   // J 雨后
  assert.equal(letterAt(18).scene, 2);  // S 夜空
});
