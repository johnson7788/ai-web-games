// src/game/sim.js — QUIZ SPRINT · M1 模拟/玩法核心（纯逻辑，零 DOM / 零随机依赖外部）
// 契约（见 docs/analysis.md 与 README.md）：
//   createRun({ seed, startLevel }) → run
//   run.step(input) / run.getHud() / run.drainEvents()
//   input = { hover?: 0-3|null, choose?: 0-3|'skip'|null }（choose 为作答/跳过提交，hover 为指针高亮）
import { STEP } from '../../config/game.config.js';
import { PLAYER, STAMINA, QUESTION as QCFG, AI, clamp } from '../../config/gameplay.js';
import { LEVEL_COUNT, levelConfig } from '../../config/levels.js';
import { pickQuestion } from './quiz.js';
import { mulberry32 } from './rng.js';

export function createRun({ seed = 0, startLevel = 1 } = {}) {
  const rng = mulberry32(seed >>> 0);
  const run = {
    rng,
    seed: seed >>> 0,
    phase: 'playing',             // playing | finished
    time: 0,
    level: clamp(Math.round(startLevel || 1), 1, LEVEL_COUNT),
    race: null,
    hover: null,
    stamina: STAMINA.MAX,
    combo: 0,
    maxCombo: 0,
    scholarActive: false,
    exhausted: false,
    surgeUntil: -Infinity,
    stumbleUntil: -Infinity,
    playerDist: 0,
    ai: [],
    question: null,
    _lastResult: null,
    _usedQuestions: new Set(),
    _playerPace: PLAYER.BASE_PACE,
    stats: { wins: 0, losses: 0, levelsReached: clamp(Math.round(startLevel || 1), 1, LEVEL_COUNT), maxCombo: 0, correct: 0, wrong: 0, bestRank: 4 },
    events: [],
  };

  startRace(run);

  run.step = (input) => step(run, input || {});
  run.getHud = () => getHud(run);
  run.drainEvents = () => drainEvents(run);
  return run;
}

// 兼容旧骨架（main 曾 import createSim/updateSim）
export function createSim() {
  return createRun({ seed: 0 });
}
export function updateSim(run, input = {}) {
  run.step(input);
}

// ---------- 每 tick ----------
function step(run, input) {
  if (run.phase !== 'playing') return;
  const dt = STEP;
  run.time += dt;
  run.race.time += dt;

  // 指针高亮（真实触屏 hover 输入）
  if (input.hover != null) run.hover = clamp(Math.round(input.hover), 0, 3);

  // 出题
  if (!run.question && run.race.time >= run.nextQuestionAt && run.qIndex < run.race.questionsTotal) {
    presentQuestion(run);
  }

  // 作答提交
  if (input.choose != null && run.question && !run.question.answered) {
    resolveAnswer(run, input.choose);
  }

  // 倒计时
  if (run.question && !run.question.answered) {
    run.question.timer -= dt;
    const rem = Math.ceil(run.question.timer);
    if (rem !== run.question._lastTick && rem > 0) {
      run.question._lastTick = rem;
      emit(run, 'timerTick', { remaining: rem });
    }
    if (run.question.timer <= 0) resolveAnswer(run, null); // 超时按答错
  }

  moveRunners(run, dt);

  // 被动回体力
  run.stamina = clamp(run.stamina + STAMINA.REGEN_PER_SEC * dt, 0, STAMINA.MAX);
  updateExhausted(run);

  // 临时效果衰减
  if (run.time >= run.surgeUntil) run.surgeUntil = -Infinity;
  if (run.time >= run.stumbleUntil) run.stumbleUntil = -Infinity;

  // 每 5m 一个距离里程碑（反馈密度：HUD 脉冲 + 音效 tick，压住 maxEventGap）
  const mile = Math.floor(run.playerDist / 5);
  if (mile > (run._lastMile ?? 0)) {
    run._lastMile = mile;
    if (mile > 0) emit(run, 'distanceMilestone', { dist: Math.floor(run.playerDist) });
  }

  checkRaceEnd(run);
}

// ---------- 赛段 ----------
function startRace(run) {
  const cfg = levelConfig(run.level);
  run.playerDist = 0;
  run._lastMile = 0;
  run.race = {
    distance: cfg.distance,
    questionsTotal: cfg.questionsTotal,
    questionIntervalSec: cfg.questionIntervalSec,
    questionTimeSec: cfg.questionTimeSec,
    wagerEvery: cfg.wagerEvery,
    staminaDrain: cfg.staminaDrain,
    time: 0,
    maxTimeSec: cfg.questionsTotal * cfg.questionIntervalSec + cfg.questionTimeSec + 4,
  };
  run.ai = [];
  for (let i = 0; i < AI.COUNT; i += 1) {
    const jitter = (run.rng() - 0.5) * 2 * AI.JITTER;
    run.ai.push({ name: `ai.${i + 1}`, dist: 0, pace: cfg.aiPace[i] + jitter });
  }
  run.qIndex = 0;
  run.nextQuestionAt = 0;
  run.question = null;
  run._lastResult = null;
  emit(run, 'raceStart', { level: run.level, distance: cfg.distance, scene: run.level <= 4 ? 'morning' : run.level <= 8 ? 'mountain' : 'night' });
}

function presentQuestion(run) {
  const wager = (run.qIndex + 1) % run.race.wagerEvery === 0;
  const q = pickQuestion(run.rng, levelConfig(run.level).categories, run._usedQuestions);
  run.question = {
    q,
    category: q.category,
    answerIndex: q.answer,
    wager,
    timer: run.race.questionTimeSec,
    answered: false,
    qIndex: run.qIndex,
    _lastTick: run.race.questionTimeSec,
  };
  emit(run, 'questionShow', { level: run.level, qIndex: run.qIndex, category: q.category, wager });
  if (wager) emit(run, 'wagerReveal', { category: q.category });
}

function resolveAnswer(run, choose) {
  const q = run.question;
  q.answered = true;
  const correct = typeof choose === 'number' && choose === q.answerIndex;
  const skip = choose === 'skip';
  const wager = q.wager;

  emit(run, 'answer', { correct: correct && !skip, category: q.category, wager, skip });

  if (skip && wager) {
    run.stamina = clamp(run.stamina + STAMINA.SKIP, 0, STAMINA.MAX);
    run.playerDist += PLAYER.SURGE_DIST * 0.5;
    emit(run, 'wagerSkip', { category: q.category });
    run._lastResult = { correct: false, skip: true, wager, category: q.category };
  } else if (correct) {
    const gain = wager ? STAMINA.GAIN_WAGER : STAMINA.GAIN_CORRECT;
    const dist = wager ? PLAYER.SURGE_DIST * 2 : PLAYER.SURGE_DIST;
    run.stamina = clamp(run.stamina + gain, 0, STAMINA.MAX);
    run.playerDist += dist;
    run.surgeUntil = run.time + PLAYER.SURGE_DURATION;
    run.combo += 1;
    run.maxCombo = Math.max(run.maxCombo, run.combo);
    run.stats.maxCombo = run.maxCombo;
    run.stats.correct += 1;
    emit(run, 'answerCorrect', { combo: run.combo, category: q.category, wager });
    emit(run, 'comboUp', { combo: run.combo });
    if (run.combo === PLAYER.SCHOLAR_COMBO) {
      run.scholarActive = true;
      emit(run, 'scholarSprint', { on: true });
    }
    run._lastResult = { correct: true, skip: false, wager, category: q.category };
  } else {
    const loss = wager ? STAMINA.LOSS_WAGER : STAMINA.LOSS_WRONG;
    const dist = wager ? PLAYER.STUMBLE_DIST * 2 : PLAYER.STUMBLE_DIST;
    run.stamina = clamp(run.stamina - loss * (run.race.staminaDrain || 1), 0, STAMINA.MAX);
    run.playerDist = Math.max(0, run.playerDist - dist);
    run.stumbleUntil = run.time + PLAYER.STUMBLE_DURATION;
    if (run.combo > 0) {
      run.combo = 0;
      emit(run, 'comboBreak', {});
    }
    if (run.scholarActive) {
      run.scholarActive = false;
      emit(run, 'scholarSprint', { on: false });
    }
    run.stats.wrong += 1;
    emit(run, 'answerWrong', { stamina: Math.round(run.stamina), wager, timeout: choose == null, category: q.category });
    run._lastResult = { correct: false, skip: false, wager, timeout: choose == null, category: q.category };
  }

  updateExhausted(run);
  run.qIndex += 1;
  run.nextQuestionAt = run.race.time + run.race.questionIntervalSec;
  run.question = null;
}

function updateExhausted(run) {
  const was = run.exhausted;
  if (run.stamina <= 0) run.exhausted = true;
  else if (run.stamina >= STAMINA.EXHAUST_RECOVER_AT) run.exhausted = false;
  if (run.exhausted !== was) emit(run, 'exhausted', { on: run.exhausted });

  const low = run.stamina < STAMINA.LOW_WARN_AT;
  if (low && !run._staminaLow) {
    run._staminaLow = true;
    emit(run, 'staminaLow', { stamina: Math.round(run.stamina) });
  } else if (!low) {
    run._staminaLow = false;
  }
}

// ---------- 移动 ----------
function moveRunners(run, dt) {
  const mult = paceMultiplier(run);
  const playerPace = PLAYER.BASE_PACE * mult;
  run.playerDist = Math.max(0, run.playerDist + playerPace * dt);
  run._playerPace = playerPace;
  for (const a of run.ai) a.dist += a.pace * dt;
}

function paceMultiplier(run) {
  let mult = 1;
  if (run.combo > 0) mult *= 1 + Math.min(run.combo, PLAYER.SCHOLAR_COMBO) * PLAYER.COMBO_PACE_BONUS;
  if (run.scholarActive) mult *= PLAYER.SCHOLAR_PACE_MULT;
  if (run.exhausted) mult *= STAMINA.EXHAUST_PACE;
  if (run.time < run.surgeUntil) mult *= PLAYER.SURGE_PACE_MULT;
  if (run.time < run.stumbleUntil) mult *= PLAYER.STUMBLE_PACE_MULT;
  return mult;
}

// ---------- 赛段结束 / 名次 ----------
function checkRaceEnd(run) {
  const finished = run.playerDist >= run.race.distance;
  const timeUp = run.race.time >= run.race.maxTimeSec;
  const allDone = run.qIndex >= run.race.questionsTotal && !run.question;
  if (finished || timeUp || allDone) endRace(run);
}

function endRace(run) {
  let ahead = 0;
  for (const a of run.ai) if (a.dist > run.playerDist) ahead += 1;
  const rank = 1 + ahead;
  const won = rank === 1;
  run.stats.bestRank = Math.min(run.stats.bestRank, rank);
  if (won) run.stats.wins += 1;
  else run.stats.losses += 1;
  emit(run, 'raceFinish', {
    level: run.level, rank, won,
    playerDist: Math.round(run.playerDist), raceDistance: run.race.distance,
  });

  run.level += 1;
  run.stats.levelsReached = Math.max(run.stats.levelsReached, Math.min(run.level, LEVEL_COUNT));
  if (run.level > LEVEL_COUNT) {
    run.phase = 'finished';
    emit(run, 'marathonEnd', { wins: run.stats.wins, losses: run.stats.losses, bestRank: run.stats.bestRank, maxCombo: run.stats.maxCombo });
  } else {
    startRace(run);
  }
}

// ---------- HUD / 事件 ----------
function getHud(run) {
  let rank = 1;
  for (const a of run.ai) if (a.dist > run.playerDist) rank += 1;
  const q = run.question;
  return {
    phase: run.phase,
    level: run.level,
    time: run.time,
    distance: run.playerDist,
    raceDistance: run.race ? run.race.distance : 0,
    stamina: Math.round(run.stamina),
    staminaMax: STAMINA.MAX,
    combo: run.combo,
    maxCombo: run.maxCombo,
    scholarActive: run.scholarActive,
    exhausted: run.exhausted,
    pace: run._playerPace || PLAYER.BASE_PACE,
    rank,
    question: q ? {
      q: q.q,
      category: q.category,
      wager: q.wager,
      timer: Math.max(0, Math.ceil(q.timer)),
      answered: q.answered,
      qIndex: q.qIndex,
    } : null,
    lastResult: run._lastResult,
    ai: run.ai.map((a) => ({ name: a.name, dist: a.dist })),
    wins: run.stats.wins,
    losses: run.stats.losses,
    levelsReached: run.stats.levelsReached,
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
