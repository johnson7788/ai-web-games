// src/game/sim.js — BRAIN CHICKEN RUN · 玩法核心（纯逻辑，零 DOM / 零随机依赖外部）
//
// 玩法（原味 1:1）：判断力大逃杀。每局 20 只鸡（你 + 19 只机器人）分成 TRUE / FALSE 两条车道，
// 每题一个判断对错的陈述，玩家与机器人在限时内站到各自认定的车道；计时结束「清场闸门/岩石」
// 扫过错误车道，站错的全灭。连对 3 题得护盾（可救一次），金题双倍分，撑满 12 题（3 关）即吃鸡。
//
// 契约：
//   createRun({ seed }) → run
//   run.step(input) / run.getHud() / run.drainEvents()
//   input = { hover?: 0..1|null, choose?: 'true'|'false'|null }
import { STEP } from '../../config/game.config.js';
import {
  PLAYER, MATCH_SEC, QUESTION_GAP_SEC, TOTAL_QUESTIONS, ROUNDS_PER_STAGE,
  COMBO, GOLDEN_EVERY, GOLDEN_FROM_STAGE, SCORE, STAGES, stageOf, clamp,
} from '../../config/gameplay.js';
import { pickQuestion } from '../../config/quiz.js';
import { mulberry32 } from './rng.js';

const TRUE_CAMP = 0;   // playerCamp < 0.5
const FALSE_CAMP = 1;  // playerCamp >= 0.5

function campOfAnswer(answer) {
  return answer ? TRUE_CAMP : FALSE_CAMP;
}

export function createRun({ seed = 0 } = {}) {
  const rng = mulberry32(seed >>> 0);
  const run = {
    rng,
    seed: seed >>> 0,
    phase: 'playing',            // playing | finished
    time: 0,
    mode: 'matching',            // matching | question | gap | over | won
    modeTimer: MATCH_SEC,
    qIndex: 0,
    stage: 1,
    playerCamp: PLAYER.START_CAMP,
    playerAlive: true,
    playerCommitted: false,
    shield: 0,
    combo: 0,
    maxCombo: 0,
    score: 0,
    correctCount: 0,
    wrongCount: 0,
    question: null,
    hazard: null,
    _lastResult: null,
    _lastMatchTick: 0,
    _lastGapTick: 0,
    _usedQuestions: new Set(),
    stats: {
      wins: 0,
      losses: 0,
      deaths: 0,
      levelsReached: 1,
      maxCombo: 0,
      correct: 0,
      wrong: 0,
      rank: null,
      score: 0,
      stars: 0,
    },
    bots: [],
    events: [],
  };

  initBots(run);

  run.step = (input) => step(run, input || {});
  run.getHud = () => getHud(run);
  run.drainEvents = () => drainEvents(run);
  emit(run, 'runStart', { players: PLAYER.COUNT, questions: TOTAL_QUESTIONS });
  return run;
}

function initBots(run) {
  const total = PLAYER.COUNT - 1;
  for (let i = 0; i < total; i += 1) {
    run.bots.push({
      id: i,
      camp: run.rng() < 0.5 ? TRUE_CAMP : FALSE_CAMP,
      targetCamp: 0.5,
      alive: true,
      tint: Math.floor(run.rng() * 360),
    });
  }
}

// ---------- 每 tick ----------
function step(run, input) {
  if (run.phase !== 'playing') return;
  const dt = STEP;
  run.time += dt;

  // 指针悬浮（连续车道位置，用于触屏微调与遥测）
  if (input.hover != null) {
    run.playerCamp = clamp(Number(input.hover), 0, 1);
  }

  // 提交作答（点 TRUE / FALSE）
  if (input.choose != null && run.mode === 'question' && run.question && !run.question.answered) {
    commit(run, input.choose);
  }

  if (run.mode === 'matching') {
    run.modeTimer -= dt;
    const rem = Math.ceil(run.modeTimer);
    if (rem !== run._lastMatchTick && rem > 0) {
      run._lastMatchTick = rem;
      emit(run, 'matchTick', { remaining: rem });
    }
    if (run.modeTimer <= 0) {
      emit(run, 'matchGo', {});
      presentQuestion(run);
    }
  } else if (run.mode === 'question') {
    tickQuestion(run, dt);
  } else if (run.mode === 'gap') {
    run.modeTimer -= dt;
    const rem = Math.ceil(run.modeTimer);
    if (rem !== run._lastGapTick && rem > 0) {
      run._lastGapTick = rem;
      emit(run, 'gapTick', { remaining: rem });
    }
    if (run.modeTimer <= 0) presentQuestion(run);
  }

  // 机器人朝目标车道移动（供渲染）
  for (const b of run.bots) {
    if (!b.alive) continue;
    b.camp += (b.targetCamp - b.camp) * Math.min(1, dt * 5);
  }

  // 分数里程碑（反馈密度）
  const mile = Math.floor(run.score / 100);
  if (mile > (run._scoreMile ?? 0)) {
    run._scoreMile = mile;
    if (mile > 0) emit(run, 'scoreMilestone', { score: run.score });
  }
}

function commit(run, choose) {
  const isTrue = choose === 'true';
  run.playerCamp = isTrue ? TRUE_CAMP : FALSE_CAMP;
  run.playerCommitted = true;
  emit(run, 'answer', { camp: isTrue ? 'true' : 'false' });
}

function presentQuestion(run) {
  const qIndex = run.qIndex;
  const stageCfg = stageOf(qIndex);
  const newStage = stageCfg.index;
  if (newStage !== run.stage) {
    run.stage = newStage;
    run.stats.levelsReached = Math.max(run.stats.levelsReached, newStage);
    emit(run, 'stageClear', { stage: newStage });
  }

  const golden = run.stage >= GOLDEN_FROM_STAGE && (qIndex + 1) % GOLDEN_EVERY === 0;
  const q = pickQuestion(run.rng, run._usedQuestions);
  run.question = {
    statement: q,
    answer: q.answer,
    timer: stageCfg.answerTime,
    answerTime: stageCfg.answerTime,
    answered: false,
    golden,
    qIndex,
    stage: run.stage,
    _lastTick: Math.ceil(stageCfg.answerTime),
  };
  run.playerCommitted = false;
  run.hazard = null;
  run.mode = 'question';

  // 机器人本回合决定去哪个车道
  for (const b of run.bots) {
    if (!b.alive) continue;
    const correct = run.rng() < stageCfg.botAccuracy;
    b.targetCamp = correct ? campOfAnswer(q.answer) : (1 - campOfAnswer(q.answer));
  }

  emit(run, 'questionShow', { qIndex, stage: run.stage, golden, answerTime: stageCfg.answerTime });
  if (golden) emit(run, 'goldenQuestion', { qIndex });
}

function tickQuestion(run, dt) {
  const q = run.question;
  if (!q) return;
  q.timer -= dt;
  const rem = Math.ceil(q.timer);
  if (rem !== q._lastTick && rem > 0) {
    q._lastTick = rem;
    emit(run, 'timerTick', { remaining: rem });
  }
  if (q.timer <= 0) resolve(run, null);
}

function resolve(run, timeout) {
  const q = run.question;
  if (!q || q.answered) return;
  q.answered = true;

  const correctCamp = campOfAnswer(q.answer);
  const playerCorrect = run.playerCommitted
    ? (run.playerCamp < 0.5 ? TRUE_CAMP : FALSE_CAMP) === correctCamp
    : false;
  const wrongCamp = 1 - correctCamp;

  run.hazard = { lane: wrongCamp, type: stageOf(q.qIndex).hazard, t: 0 };

  // 机器人清场
  let eliminatedBots = 0;
  for (const b of run.bots) {
    if (!b.alive) continue;
    const botCamp = b.targetCamp < 0.5 ? TRUE_CAMP : FALSE_CAMP;
    if (botCamp === wrongCamp) {
      b.alive = false;
      eliminatedBots += 1;
    }
  }
  if (eliminatedBots > 0) emit(run, 'botEliminated', { count: eliminatedBots });

  let roundBase = q.golden ? SCORE.GOLDEN : SCORE.ROUND;

  if (playerCorrect) {
    run.combo += 1;
    run.maxCombo = Math.max(run.maxCombo, run.combo);
    run.stats.maxCombo = run.maxCombo;
    run.correctCount += 1;
    run.stats.correct += 1;
    const gain = roundBase + run.combo * SCORE.COMBO_BONUS;
    run.score += gain;
    run._lastResult = { correct: true, golden: q.golden, combo: run.combo, gain };
    emit(run, 'answerCorrect', { combo: run.combo, golden: q.golden, gain });
    emit(run, 'comboUp', { combo: run.combo });
    if (run.combo >= COMBO.SHIELD_AT && run.shield < COMBO.MAX_SHIELD) {
      run.shield += 1;
      emit(run, 'shieldGain', { shield: run.shield });
    }
  } else {
    run.wrongCount += 1;
    run.stats.wrong += 1;
    if (run.shield > 0) {
      // 护盾救场：存活，扣盾，回到正确车道
      run.shield -= 1;
      run.combo = 0;
      run.score += SCORE.SHIELD_SAVE;
      run.playerCamp = correctCamp === TRUE_CAMP ? 0 : 1;
      run._lastResult = { correct: false, shielded: true, timeout: !!timeout, golden: q.golden };
      emit(run, 'shieldBreak', { shield: run.shield });
      emit(run, 'shieldSaved', { shield: run.shield, timeout: !!timeout });
      emit(run, 'comboBreak', {});
      emit(run, 'answerWrong', { shielded: true, timeout: !!timeout, golden: q.golden });
    } else {
      run.playerAlive = false;
      run.stats.deaths += 1;
      const aliveBots = run.bots.filter((b) => b.alive).length;
      const rank = 1 + aliveBots;
      run.stats.rank = rank;
      run._lastResult = { correct: false, shielded: false, timeout: !!timeout, golden: q.golden };
      emit(run, 'answerWrong', { shielded: false, timeout: !!timeout, golden: q.golden });
      emit(run, 'eliminated', { rank });
    }
  }

  emit(run, 'hazardSweep', { lane: wrongCamp, type: run.hazard.type });

  // 胜负判定
  const aliveBots = run.bots.filter((b) => b.alive).length;
  if (!run.playerAlive) {
    run.stats.losses += 1;
    run.stats.stars = run.stats.rank <= 5 ? 2 : 1;
    run.mode = 'over';
    run.phase = 'finished';
    emit(run, 'lose', { rank: run.stats.rank, score: run.score, correct: run.correctCount, maxCombo: run.maxCombo });
  } else if (aliveBots === 0 && run.stage >= 3) {
    run.stats.wins += 1;
    run.stats.rank = 1;
    run.stats.stars = 3;
    run.mode = 'won';
    run.phase = 'finished';
    emit(run, 'lastStanding', {});
    emit(run, 'win', { rank: 1, score: run.score, correct: run.correctCount, maxCombo: run.maxCombo });
  } else if (run.qIndex + 1 >= TOTAL_QUESTIONS) {
    run.stats.wins += 1;
    run.stats.rank = 1;
    run.stats.stars = 3;
    run.mode = 'won';
    run.phase = 'finished';
    emit(run, 'win', { rank: 1, score: run.score, correct: run.correctCount, maxCombo: run.maxCombo });
  } else {
    run.mode = 'gap';
    run.modeTimer = QUESTION_GAP_SEC;
    run._lastGapTick = 0;
  }

  run.qIndex += 1;
  run.stats.score = run.score;
  run.question = null;
}

// ---------- HUD ----------
function getHud(run) {
  const q = run.question;
  const aliveBots = run.bots.filter((b) => b.alive).length;
  const rank = run.playerAlive ? 1 : (run.stats.rank ?? 1 + aliveBots);
  return {
    phase: run.phase,
    mode: run.mode,
    stage: run.stage,
    time: run.time,
    score: run.score,
    combo: run.combo,
    maxCombo: run.maxCombo,
    shield: run.shield,
    correct: run.correctCount,
    playerCamp: run.playerCamp,
    playerAlive: run.playerAlive,
    rank,
    alive: aliveBots + (run.playerAlive ? 1 : 0),
    question: q ? {
      text: q.statement,
      answer: q.answer,
      timer: Math.max(0, Math.ceil(q.timer)),
      answered: q.answered,
      golden: q.golden,
      qIndex: q.qIndex,
      stage: q.stage,
    } : null,
    hazard: run.hazard ? { lane: run.hazard.lane, type: run.hazard.type } : null,
    lastResult: run._lastResult,
    bots: run.bots.map((b) => ({ id: b.id, camp: b.camp, targetCamp: b.targetCamp, alive: b.alive, tint: b.tint })),
    stats: { ...run.stats },
  };
}

function emit(run, type, fields = {}) {
  run.events.push({ type, ...fields });
}

function drainEvents(run) {
  const ev = run.events;
  run.events = [];
  return ev;
}
