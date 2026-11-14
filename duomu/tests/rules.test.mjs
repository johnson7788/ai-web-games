import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createRun, startRun, step, strike, pauseRun, resumeRun, getSnapshot,
  makeRng, actConfig, tierAt, drainEvents, reviveRun, SIDE, PHASE,
} from '../src/game/rules.js';
import { MATCH } from '../config/game.config.js';

function fresh(opts = {}) {
  const run = createRun({ mode: 'duo', seed: 7, ...opts });
  startRun(run, 0);
  return run;
}

/** 测试专用：强行指定这一节的雷印，并同步截止时间 */
function force(run, brand) {
  const seg = run.segs[0];
  seg.brand = brand;
  const cfg = actConfig(run);
  seg.idleAt = seg.activeAt + (brand === SIDE.BOTH ? cfg.passMs : cfg.idleMs);
  return seg;
}

test('开局：9 节可见木段，进入 playing，双方满血', () => {
  const run = fresh();
  assert.equal(run.phase, PHASE.PLAYING);
  assert.equal(run.segs.length, 9);
  assert.deepEqual(run.players.map((p) => p.hp), [3, 3]);
  assert.equal(run.totalLogs, 0);
  assert.equal(run.actIndex, 0);
});

test('三层时间窗：蒙面 → 微光 → 明牌', () => {
  const run = fresh();
  const seg = run.segs[0];
  assert.equal(tierAt(seg, 100), 'blind');
  assert.equal(tierAt(seg, 500), 'hint');
  assert.equal(tierAt(seg, 1000), 'sure');
});

test('盲劈：蒙面期劈对边拿最高分 + 先手奖励', () => {
  const run = fresh();
  force(run, SIDE.L);
  assert.equal(strike(run, 0, SIDE.R, 100), 'blind');
  assert.equal(run.players[0].logs, MATCH.score.blind + MATCH.firstBonus);
  assert.equal(run.players[0].blind, 1);
  assert.equal(run.players[0].first, 1);
});

test('先手只归第一个出手的人，后手照拿档次分', () => {
  const run = fresh();
  force(run, SIDE.L);
  step(run, 1000);
  strike(run, 0, SIDE.R, 1000);          // 先手：1 + 1
  strike(run, 1, SIDE.R, 1300);          // 后手：1 + 0（雷印在左，右边才安全）
  assert.equal(run.players[0].logs, MATCH.score.sure + MATCH.firstBonus);
  assert.equal(run.players[1].logs, MATCH.score.sure);
});

test('赌微光：微光期劈对边拿中档分', () => {
  const run = fresh();
  force(run, SIDE.L);
  step(run, 500);
  assert.equal(strike(run, 0, SIDE.R, 500), 'hint');
  assert.equal(run.players[0].logs, MATCH.score.hint + MATCH.firstBonus);
});

test('等明牌：明牌期稳拿最低分', () => {
  const run = fresh();
  force(run, SIDE.L);
  step(run, 1000);
  assert.equal(strike(run, 0, SIDE.R, 1000), 'sure');
  assert.equal(run.players[0].logs, MATCH.score.sure + MATCH.firstBonus);
});

test('劈到雷印那一边 = 掉血 + 硬直，且硬直期间输入无效', () => {
  const run = fresh();
  force(run, SIDE.L);
  step(run, 1000);
  assert.equal(strike(run, 0, SIDE.L, 1000), 'death');
  assert.equal(run.players[0].hp, 2);
  assert.equal(run.players[0].killed, 1);
  assert.equal(strike(run, 0, SIDE.R, 1050), 'ignored');
});

test('无雷印的木段两边都能劈', () => {
  const run = fresh();
  force(run, SIDE.NONE);
  step(run, 1000);
  assert.equal(strike(run, 0, SIDE.L, 1000), 'sure');
});

test('双雷段：碰哪边都死，但干等不罚', () => {
  const a = fresh();
  force(a, SIDE.BOTH);
  step(a, 700);
  assert.equal(strike(a, 0, SIDE.L, 700), 'death');

  const b = fresh();
  force(b, SIDE.BOTH);
  step(b, 1200);
  assert.deepEqual(b.players.map((p) => p.hp), [3, 3], '双雷段等待不扣血');
});

test('该出手不出手：只有犹豫的那个人挨天雷', () => {
  const run = fresh();
  force(run, SIDE.L);
  step(run, 1000);
  strike(run, 0, SIDE.R, 1000);          // 玩家一出了手
  step(run, run.segs[0].idleAt + 10);    // 玩家二一直不动
  assert.equal(run.players[0].hp, MATCH.hp, '出过手的人不受罚');
  assert.equal(run.players[1].hp, MATCH.hp - 1, '干等的人吃天雷');
});

test('两边都不动：一起挨天雷，木段照常推进', () => {
  const run = fresh();
  force(run, SIDE.L);
  step(run, run.segs[0].idleAt + 10);
  assert.equal(run.players[0].hp, MATCH.hp - 1);
  assert.equal(run.players[1].hp, MATCH.hp - 1);
  assert.equal(run.totalLogs, 1);
});

test('血掉光即出局，对手判胜', () => {
  const run = fresh();
  run.players[0].hp = 1;
  force(run, SIDE.L);
  step(run, 1000);
  strike(run, 0, SIDE.L, 1000);
  assert.equal(run.phase, PHASE.RESULT);
  assert.equal(run.winner, 1);
});

test('先夺到目标木数即取胜', () => {
  const run = fresh();
  run.players[0].logs = MATCH.targetLogs - 1;
  force(run, SIDE.NONE);
  step(run, 1000);
  strike(run, 0, SIDE.R, 1000);
  assert.equal(run.phase, PHASE.RESULT);
  assert.equal(run.winner, 0);
});

test('累计夺木推进劫数', () => {
  const run = fresh();
  run.totalLogs = 13;                     // 只差一节就进第二劫
  force(run, SIDE.NONE);
  step(run, 1000);
  strike(run, 0, SIDE.R, 1000);
  step(run, 1001);
  strike(run, 1, SIDE.L, 1001);          // 两人都出手 → 这一节才算过
  assert.equal(run.totalLogs, 14);
  assert.equal(run.actIndex, 1);
});

test('暂停再恢复不会欠下时间债', () => {
  const run = fresh();
  force(run, SIDE.L);
  step(run, 100);
  pauseRun(run);
  assert.equal(run.phase, PHASE.PAUSED);
  assert.equal(strike(run, 0, SIDE.R, 9000), 'ignored', '暂停时输入无效');
  resumeRun(run, 9000);
  assert.equal(run.segs[0].revealAt - run.now, 800);
});

test('快照在到点之前不泄漏雷印', () => {
  const run = fresh();
  force(run, SIDE.L);
  assert.equal(getSnapshot(run).seg.shown, 'HIDDEN');
  step(run, 500);
  assert.equal(getSnapshot(run).seg.shown, run.segs[0].hint, '微光期只给微光');
  step(run, 1000);
  assert.equal(getSnapshot(run).seg.shown, SIDE.L);
});

test('微光只有七成准：统计上靠它劈不会全对', () => {
  let wrong = 0, total = 0;
  for (let i = 0; i < 4000; i++) {
    const run = createRun({ mode: 'duo', seed: 1000 + i });
    startRun(run, 0);
    const seg = run.segs[0];
    if (seg.brand === SIDE.BOTH || seg.brand === SIDE.NONE) continue;   // 无印段没有「对的那边」
    total++;
    if (seg.hint !== seg.brand) wrong++;
  }
  const acc = 1 - wrong / total;
  assert.ok(acc > 0.6 && acc < 0.8, `微光准确率应接近 0.7，实测 ${acc.toFixed(3)}`);
});

test('激励复活：血光了能拉回来，对手到目标就不给', () => {
  const a = fresh();
  a.players[0].hp = 1;
  force(a, SIDE.L);
  step(a, 1000);
  strike(a, 0, SIDE.L, 1000);            // 劈错边 → 出局
  assert.equal(a.phase, PHASE.RESULT);
  assert.equal(reviveRun(a, 1200, 2), true);
  assert.equal(a.phase, PHASE.PLAYING);
  assert.equal(a.players[0].hp, 2);
  assert.equal(a.players[0].alive, true);

  const b = fresh();
  b.players[0].hp = 1;
  b.players[1].logs = MATCH.targetLogs;  // 对手已经赢了，不该再续命
  force(b, SIDE.L);
  step(b, 1000);
  strike(b, 0, SIDE.L, 1000);
  assert.equal(reviveRun(b, 1200, 2), false);
});

test('同种子完全可复现', () => {
  const play = () => {
    const run = createRun({ mode: 'solo', seed: 12345 });
    startRun(run, 0);
    let now = 0;
    for (let i = 0; i < 3000; i++) {
      now += 16;
      step(run, now);
      const seg = run.segs[0];
      if (run.phase === PHASE.PLAYING && seg && seg.state === 'revealed' && seg.brand !== SIDE.BOTH) {
        strike(run, 0, seg.brand === SIDE.L ? SIDE.R : SIDE.L, now);
      }
      if (run.phase === PHASE.RESULT) break;
    }
    return { logs: run.players.map((p) => p.logs), winner: run.winner, total: run.totalLogs, act: run.actIndex };
  };
  assert.deepEqual(play(), play());
});

test('rng 落在 [0,1) 且分布合理', () => {
  const rng = makeRng(99);
  let sum = 0;
  for (let i = 0; i < 10000; i++) {
    const v = rng();
    assert.ok(v >= 0 && v < 1);
    sum += v;
  }
  assert.ok(Math.abs(sum / 10000 - 0.5) < 0.02);
});

test('事件流：chop 之后木段才结算', () => {
  const run = fresh();
  force(run, SIDE.NONE);
  step(run, 1000);
  strike(run, 0, SIDE.R, 1000);
  strike(run, 1, SIDE.L, 1000);
  const types = drainEvents(run).map((e) => e.type);
  assert.ok(types.includes('chop'));
  assert.equal(run.totalLogs, 1);
});

test('一节木段每人只能砍一次', () => {
  const run = fresh();
  force(run, SIDE.NONE);
  step(run, 1000);
  assert.equal(strike(run, 0, SIDE.L, 1000), 'sure');
  assert.equal(strike(run, 0, SIDE.R, 1010), 'ignored');
});
