// ABC POP · 玩法核心（纯逻辑，零 DOM / 零 Date.now / 零 localStorage）。
// 契约：事件名与 main/selfplay/audio 一字不差；输入 { tap: {x,y} | null }。
import { WORLD, STEP } from '../../config/game.config.js';
import { PLAY, BUBBLE, DIFF, SCORE, BRIDGE, ROUND, DRIFT, clamp } from '../../config/gameplay.js';
import { LETTERS, LETTER_COUNT, TOTAL_LEVELS, letterAt, sceneAt, wordFor } from '../../config/levels.js';
import { mulberry32, randRange, randInt } from './rng.js';

// ---------- 创建 run ----------
export function createRun({ seed = 0, startLetter = 0 } = {}) {
  const rng = mulberry32(seed >>> 0);
  const letterIndex = clamp(startLetter, 0, LETTER_COUNT - 1);

  const run = {
    rng,
    seed: seed >>> 0,
    phase: 'playing',           // playing | cleared（无失败）
    time: 0,
    letterIndex,
    round: 0,                   // 0 认读 / 1 大小写 / 2 首字母词
    levelIndex: letterIndex * ROUND.COUNT_PER_LETTER + 0,
    bubbles: [],
    score: 0,
    streak: 0,
    maxStreak: 0,
    correctTotal: 0,
    tapTotal: 0,
    roundCorrectPops: 0,
    formsDone: new Set(),
    stats: { levelsReached: 1, lettersCleared: 0 },
    events: [],
    _driftAccum: 0,
    nextId: 1,
  };

  run.step = (input) => step(run, input);
  run.getHud = () => getHud(run);
  run.drainEvents = () => drainEvents(run);
  run.jump = (li, rd) => jump(run, li, rd);

  spawnBubbles(run);
  emit(run, 'levelEnter', {
    level: run.levelIndex + 1,
    letter: letterAt(run.letterIndex).char,
    round: run.round,
    scene: sceneAt(run.letterIndex).id,
  });
  return run;
}

// ---------- 每 tick ----------
export function step(run, input = {}) {
  if (run.phase !== 'playing') return;
  const dt = STEP;
  run.time += dt;

  if (input.tap) handleTap(run, input.tap.x, input.tap.y);

  updateBubbles(run, dt);

  // 细粒度里程碑事件：压事件密度，控制死时间
  run._driftAccum += 1;
  if (run._driftAccum >= DRIFT.TICKS) {
    run._driftAccum = 0;
    emit(run, 'drift', { t: Math.round(run.time * 10) / 10 });
  }
}

// ---------- 目标 / 难度 ----------
export function currentTarget(run) {
  const l = letterAt(run.letterIndex);
  if (run.round === 1) {
    return { forms: [l.char, l.lower], letter: l.char, upper: l.char, lower: l.lower, word: null };
  }
  if (run.round === 2) {
    return { forms: [l.char], letter: l.char, upper: l.char, lower: l.lower, word: wordFor(run.letterIndex) };
  }
  return { forms: [l.char], letter: l.char, upper: l.char, lower: l.lower, word: null };
}

export function difficultyFor(levelIndex) {
  const wind = clamp(DIFF.WIND_BASE + levelIndex * DIFF.WIND_PER_LEVEL, 0, DIFF.WIND_MAX);
  const swayAmp = clamp(DIFF.SWAY_BASE + levelIndex * DIFF.SWAY_PER_LEVEL, 0, DIFF.SWAY_MAX);
  const distractors = clamp(DIFF.DISTRACT_BASE + Math.floor(levelIndex / DIFF.DISTRACT_STEP), 0, DIFF.DISTRACT_MAX);
  return { wind, swayAmp, distractors };
}

// ---------- 泡泡生成 ----------
function buildInitialLetters(run) {
  const target = currentTarget(run);
  const diff = difficultyFor(run.levelIndex);
  const correctSet = new Set(target.forms);
  // 保证目标形态一定在场：认读/首词轮放 2 个目标，大小写轮放两形态各 1 个
  const letters = run.round === 1 ? [target.upper, target.lower] : [target.letter, target.letter];
  for (let i = 0; i < diff.distractors; i += 1) {
    letters.push(pickDistractor(run, correctSet));
  }
  return letters;
}

function pickDistractor(run, correctSet) {
  const mixCase = run.levelIndex >= DIFF.MIXED_CASE_FROM;
  const pool = [];
  for (let i = 0; i < LETTER_COUNT; i += 1) {
    const up = LETTERS[i].char;
    if (!correctSet.has(up)) pool.push(up);
    if (mixCase && !correctSet.has(LETTERS[i].lower)) pool.push(LETTERS[i].lower);
  }
  return pool[randInt(run.rng, 0, pool.length - 1)];
}

// 替换被点掉的泡泡：偏干扰字母（更难），但偶尔也补一个目标字母
function pickReplacementLetter(run) {
  const target = currentTarget(run);
  const correctSet = new Set(target.forms);
  if (run.rng() < 0.3) {
    return target.forms[randInt(run.rng, 0, target.forms.length - 1)];
  }
  return pickDistractor(run, correctSet);
}

function makeBubble(run, letter) {
  const diff = difficultyFor(run.levelIndex);
  const r = randRange(run.rng, BUBBLE.R_MIN, BUBBLE.R_MAX);
  const pos = findFreePos(run, r);
  return {
    id: run.nextId++,
    letter,
    x: pos.x,
    y: pos.y,
    r,
    vx: diff.wind + randRange(run.rng, -6, 6),
    vy: randRange(run.rng, BUBBLE.RISE_MIN, BUBBLE.RISE_MAX),
    swayAmp: diff.swayAmp * randRange(run.rng, 0.6, 1.2),
    swayFreq: randRange(run.rng, 0.6, 1.6),
    phase: run.rng() * Math.PI * 2,
    shaking: false,
    shakeT: 0,
    popped: false,
  };
}

function findFreePos(run, r) {
  // 简单拒绝采样：泡泡不重叠（留 10% 间隙），点选判定才不会点错旁边的泡泡
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const x = randRange(run.rng, r + 4, WORLD.WIDTH - r - 4);
    const y = randRange(run.rng, PLAY.TOP + r + 4, PLAY.BOTTOM - r - 4);
    let overlap = false;
    for (const b of run.bubbles) {
      if (b.popped) continue;
      if (Math.hypot(b.x - x, b.y - y) < (b.r + r) * 1.1) { overlap = true; break; }
    }
    if (!overlap) return { x, y };
  }
  // 兜底：实在找不到就放一个远离现有泡泡的随机点（不影响正确性）
  return { x: randRange(run.rng, r + 4, WORLD.WIDTH - r - 4), y: randRange(run.rng, PLAY.TOP + r + 4, PLAY.BOTTOM - r - 4) };
}

function spawnBubbles(run) {
  run.bubbles = [];
  for (const letter of buildInitialLetters(run)) {
    run.bubbles.push(makeBubble(run, letter));
  }
}

function replaceBubble(run, old) {
  const i = run.bubbles.indexOf(old);
  if (i < 0) return;
  run.bubbles[i] = makeBubble(run, pickReplacementLetter(run));
}

// ---------- 移动 ----------
function updateBubbles(run, dt) {
  for (const b of run.bubbles) {
    if (b.popped) continue;
    if (b.shaking) {
      b.shakeT -= dt;
      if (b.shakeT <= 0) b.shaking = false;
    }
    b.x += (b.vx + Math.sin(run.time * b.swayFreq + b.phase) * b.swayAmp) * dt;
    b.y += b.vy * dt;
    // 环绕
    if (b.y < PLAY.TOP - b.r) { b.y = PLAY.BOTTOM + b.r; b.x = randRange(run.rng, b.r, WORLD.WIDTH - b.r); }
    else if (b.y > PLAY.BOTTOM + b.r) { b.y = PLAY.TOP - b.r; b.x = randRange(run.rng, b.r, WORLD.WIDTH - b.r); }
    if (b.x < -b.r) b.x += WORLD.WIDTH + b.r * 2;
    else if (b.x > WORLD.WIDTH + b.r) b.x -= WORLD.WIDTH + b.r * 2;
  }
}

// ---------- 点击 ----------
function handleTap(run, x, y) {
  run.tapTotal += 1;
  let hit = null;
  for (let i = run.bubbles.length - 1; i >= 0; i -= 1) {
    const b = run.bubbles[i];
    if (b.popped) continue;
    if (Math.hypot(b.x - x, b.y - y) <= b.r + BUBBLE.TAP_SLACK) { hit = b; break; }
  }
  if (!hit) {
    emit(run, 'tapMiss', { x, y });
    return;
  }
  if (isCorrect(run, hit.letter)) onCorrect(run, hit, x, y);
  else onMiss(run, hit, x, y);
}

function isCorrect(run, letter) {
  return currentTarget(run).forms.includes(letter);
}

function onCorrect(run, b, x, y) {
  run.correctTotal += 1;
  run.streak += 1;
  const isRecord = run.streak > run.maxStreak;
  if (isRecord) run.maxStreak = run.streak;
  run.roundCorrectPops += 1;
  run.formsDone.add(b.letter);

  run.score += SCORE.CORRECT;
  const isBridge = run.streak === BRIDGE.STREAK;
  if (isBridge) run.score += SCORE.BRIDGE_BONUS;

  emit(run, 'bubblePop', { letter: b.letter, x, y, streak: run.streak, score: run.score, correct: true });
  emit(run, 'comboUp', { streak: run.streak });
  if (isRecord) emit(run, 'newRecord', { streak: run.streak });
  if (isBridge) emit(run, 'bridge', { streak: run.streak, x, y });

  replaceBubble(run, b);

  if (roundCleared(run)) onRoundClear(run);
}

function onMiss(run, b, x, y) {
  b.shaking = true;
  b.shakeT = BUBBLE.SHAKE_SEC;
  if (run.streak > 0) {
    run.streak = 0;
    emit(run, 'comboBreak', {});
  }
  emit(run, 'bubbleMiss', { letter: b.letter, x, y });
}

function roundCleared(run) {
  if (run.round === 1) return run.formsDone.size >= 2;
  return run.roundCorrectPops >= ROUND.GOAL;
}

function onRoundClear(run) {
  emit(run, 'roundClear', { level: run.levelIndex + 1, letter: letterAt(run.letterIndex).char, round: run.round });
  advance(run);
}

function advance(run) {
  run.round += 1;
  if (run.round >= ROUND.COUNT_PER_LETTER) {
    run.round = 0;
    emit(run, 'letterClear', { letter: letterAt(run.letterIndex).char });
    run.stats.lettersCleared += 1;
    run.letterIndex += 1;
    if (run.letterIndex >= LETTER_COUNT) {
      run.phase = 'cleared';
      emit(run, 'cleared', { score: run.score, maxStreak: run.maxStreak });
      return;
    }
  }
  run.levelIndex = run.letterIndex * ROUND.COUNT_PER_LETTER + run.round;
  run.stats.levelsReached = Math.max(run.stats.levelsReached, run.levelIndex + 1);
  run.roundCorrectPops = 0;
  run.formsDone = new Set();
  spawnBubbles(run);
  emit(run, 'levelEnter', {
    level: run.levelIndex + 1,
    letter: letterAt(run.letterIndex).char,
    round: run.round,
    scene: sceneAt(run.letterIndex).id,
  });
}

// 调试口：跳到指定字母/轮次（截图 / 验收用）
export function jump(run, letterIndex, round = 0) {
  const li = clamp(letterIndex, 0, LETTER_COUNT - 1);
  const rd = clamp(round, 0, ROUND.COUNT_PER_LETTER - 1);
  run.letterIndex = li;
  run.round = rd;
  run.levelIndex = li * ROUND.COUNT_PER_LETTER + rd;
  run.stats.levelsReached = Math.max(run.stats.levelsReached, run.levelIndex + 1);
  run.roundCorrectPops = 0;
  run.formsDone = new Set();
  spawnBubbles(run);
  emit(run, 'levelEnter', { level: run.levelIndex + 1, letter: letterAt(li).char, round: rd, scene: sceneAt(li).id });
  return run;
}

// ---------- HUD / 事件 ----------
export function getHud(run) {
  const t = currentTarget(run);
  return {
    phase: run.phase,
    level: run.levelIndex + 1,
    totalLevels: TOTAL_LEVELS,
    letterIndex: run.letterIndex,
    letter: letterAt(run.letterIndex).char,
    round: run.round,
    scene: sceneAt(run.letterIndex).id,
    score: run.score,
    streak: run.streak,
    maxStreak: run.maxStreak,
    lettersCleared: run.stats.lettersCleared,
    progress: run.round === 1 ? run.formsDone.size : run.roundCorrectPops,
    goal: run.round === 1 ? 2 : ROUND.GOAL,
    target: {
      forms: [...t.forms],
      upper: t.upper,
      lower: t.lower,
      letter: t.letter,
      word: t.word ? { ...t.word } : null,
    },
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

// 兼容旧骨架别名
export function createSim() {
  return createRun({ seed: 0 });
}
export function updateSim(run, input = {}) {
  run.step(input);
}
