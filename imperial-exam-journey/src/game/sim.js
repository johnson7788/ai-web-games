// src/game/sim.js — IMPERIAL EXAM JOURNEY · 玩法核心（纯逻辑，零 DOM / 零随机依赖外部）
// 契约（README）：
//   createRun({ seed, difficulty }) → run
//   run.step(input) / run.getHud() / run.drainEvents()
//   input = { type?: string|null, submit?: bool|null, submitText?: string|null, hint?: bool|null }
//     type       追加一个字符到作答缓冲（bot 逐字输入）
//     submit     提交当前缓冲
//     submitText 用完整字符串直接作答（真实 DOM 提交，兼容 IME）
//     hint       使用一张提示笺揭示释义
import { STEP } from '../../config/game.config.js';
import {
  DIFFICULTIES, idiomsForDifficulty, WAYSTATION_EVERY, HINT_COST_POINTS,
  STARS, COMBO_MAX_MULT,
} from '../../config/idioms.js';
import { mulberry32 } from './rng.js';

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

function round1(v) {
  return Math.round(v * 10) / 10;
}

export function createRun({ seed = 0, difficulty = 1 } = {}) {
  const rng = mulberry32(seed >>> 0);
  const diff = clamp(Math.round(difficulty || 1), 1, 3);
  const list = idiomsForDifficulty(diff);
  const deck = list.map((entry, i) => i);
  // Fisher-Yates 洗牌
  for (let i = deck.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }

  const run = {
    rng,
    seed: seed >>> 0,
    phase: 'playing',            // playing | finished
    difficulty: diff,
    time: 0,
    score: 0,
    combo: 0,
    hints: 0,                    // 可用提示笺
    hintProgress: 0,             // 距离下一张提示笺的进度（0..5）
    totalStars: 0,
    riddlesSolved: 0,
    waystations: 1,              // 起始在首驿
    current: null,
    _deck: deck,
    _deckPos: 0,
    _riddleSeq: 0,
    _lastResult: null,
    stats: { wins: 0, losses: 0, levelsReached: 1, correct: 0, wrong: 0, maxCombo: 0, totalStars: 0, hintsUsed: 0 },
    events: [],
  };

  presentRiddle(run);

  run.step = (input) => step(run, input || {});
  run.getHud = () => getHud(run);
  run.drainEvents = () => drainEvents(run);
  return run;
}

// 兼容旧骨架别名
export function createSim() {
  return createRun({ seed: 0 });
}
export function updateSim(run, input = {}) {
  run.step(input);
}

// ---------- 每 tick ----------
function step(run, input) {
  if (run.phase !== 'playing') return;
  run.time += STEP;

  const cur = run.current;
  if (!cur) return;

  // 逐字输入
  if (typeof input.type === 'string' && input.type.length > 0 && !cur.resolved) {
    for (const ch of Array.from(input.type)) {
      if (cur.input.length >= 12) break;
      cur.input += ch;
      emit(run, 'charTyped', {});
    }
  }

  // 提交（完整字符串）
  if (typeof input.submitText === 'string' && !cur.resolved) {
    cur.input = input.submitText;
    resolveSubmit(run);
  } else if (input.submit && !cur.resolved) {
    resolveSubmit(run);
  }

  // 提示
  if (input.hint && !cur.resolved && !cur.hinted) {
    useHint(run);
  }

  // 倒计时
  if (!cur.resolved) {
    cur.timer -= STEP;
    if (cur.timer <= 5.001 && !cur._lowEmitted) {
      cur._lowEmitted = true;
      emit(run, 'lowTime', { remaining: Math.max(0, Math.ceil(cur.timer)) });
    }
    if (cur.timer <= 0) {
      cur.resolved = true;
      run.phase = 'finished';
      run.stats.losses = 1;
      emit(run, 'gameOver', {
        score: run.score,
        waystations: run.waystations,
        totalStars: run.totalStars,
        maxCombo: run.stats.maxCombo,
        reason: 'timeout',
      });
    }
  }
}

function resolveSubmit(run) {
  const cur = run.current;
  const clean = (cur.input || '').replace(/\s+/g, '');
  if (!clean) return;

  if (clean === cur.answer) {
    cur.resolved = true;
    run.combo += 1;
    run.stats.maxCombo = Math.max(run.stats.maxCombo, run.combo);
    run.stats.correct += 1;
    run.riddlesSolved += 1;

    const base = DIFFICULTIES[run.difficulty].points;
    const mult = Math.min(1 + (run.combo - 1) * 0.2, COMBO_MAX_MULT);
    const gained = round1(base * mult);
    run.score = round1(run.score + gained);

    // 星级（按剩余时间）
    const stars = cur.timer >= STARS.threeAtSec ? 3 : cur.timer >= STARS.twoAtSec ? 2 : 1;
    run.totalStars += stars;
    run.stats.totalStars = run.totalStars;

    // 提示笺进度
    run.hintProgress = round1(run.hintProgress + base);
    while (run.hintProgress >= HINT_COST_POINTS) {
      run.hintProgress = round1(run.hintProgress - HINT_COST_POINTS);
      run.hints += 1;
    }

    // 驿站里程碑
    const ws = 1 + Math.floor(run.riddlesSolved / WAYSTATION_EVERY);
    let waystationHit = false;
    if (ws > run.waystations) {
      waystationHit = true;
      run.waystations = ws;
      run.hints += 1;
    }
    run.stats.levelsReached = run.waystations;

    emit(run, 'answerCorrect', { combo: run.combo, gained, stars, mult: round1(mult) });
    emit(run, 'comboUp', { combo: run.combo });
    emit(run, 'star', { stars, totalStars: run.totalStars });
    if (waystationHit) emit(run, 'waystation', { level: run.waystations });

    run._lastResult = { correct: true, idiom: cur.answer, gained, stars };
    advanceRiddle(run);
  } else {
    // 答错：打断连击，保留本题，时间继续
    if (run.combo > 0) {
      run.combo = 0;
      emit(run, 'comboBreak', {});
    }
    cur.input = '';
    run.stats.wrong += 1;
    emit(run, 'answerWrong', { timeout: false });
    run._lastResult = { correct: false, idiom: cur.answer, timeout: false };
  }
}

function useHint(run) {
  const cur = run.current;
  if (run.hints <= 0 || cur.hinted || cur.resolved) return;
  run.hints -= 1;
  cur.hinted = true;
  run.stats.hintsUsed += 1;
  emit(run, 'hintUsed', {});
}

function presentRiddle(run) {
  if (run._deckPos >= run._deck.length) return;
  const idx = run._deck[run._deckPos];
  run._deckPos += 1;
  const entry = idiomsForDifficulty(run.difficulty)[idx];
  run._riddleSeq += 1;
  const cfg = DIFFICULTIES[run.difficulty];
  run.current = {
    entry,
    idiom: entry.idiom,
    answer: entry.idiom,
    meaningZh: entry.meaningZh,
    meaningEn: entry.meaningEn,
    timer: cfg.timeSec,
    input: '',
    hinted: false,
    resolved: false,
    riddleId: run._riddleSeq,
    eraseRatio: cfg.eraseRatio,
    _lowEmitted: false,
  };
  emit(run, 'riddleShow', { riddleId: run._riddleSeq, timer: cfg.timeSec });
}

function advanceRiddle(run) {
  if (run._deckPos >= run._deck.length) {
    run.phase = 'finished';
    run.stats.wins = 1;
    emit(run, 'win', {
      score: run.score,
      waystations: run.waystations,
      totalStars: run.totalStars,
      maxCombo: run.stats.maxCombo,
      reason: 'win',
    });
    return;
  }
  presentRiddle(run);
}

// ---------- HUD ----------
function getHud(run) {
  const cur = run.current;
  return {
    phase: run.phase,
    difficulty: run.difficulty,
    time: run.time,
    score: run.score,
    combo: run.combo,
    maxCombo: run.stats.maxCombo,
    hints: run.hints,
    hintProgress: run.hintProgress,
    totalStars: run.totalStars,
    riddlesSolved: run.riddlesSolved,
    waystations: run.waystations,
    deckTotal: run._deck.length,
    current: cur ? {
      timer: Math.max(0, cur.timer),
      input: cur.input,
      hinted: cur.hinted,
      resolved: cur.resolved,
      riddleId: cur.riddleId,
      eraseRatio: cur.eraseRatio,
      idiomLen: Array.from(cur.answer).length,
      meaningZh: cur.meaningZh,
      meaningEn: cur.meaningEn,
    } : null,
    lastResult: run._lastResult,
    stats: run.stats,
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
