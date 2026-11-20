// src/game/sim.js — IDIOM FORGE · 纯逻辑模拟（无 DOM / localStorage / Date.now；随机用 seed）
// 契约（docs/README.md）：
//   createRun({ seed, lang, startLevel }) → run
//   run.step(input)   input = { pick: gridIndex, hint: bool, reset: bool }
//   run.getHud()      → 渲染/HUD 所需状态（含 question / grid / filled）
//   run.drainEvents() → [{ type, ... }]
// 事件名：questionStart / riddle / tileTap / charCorrect / charWrong / slag / smelt / hint / reset /
//         solve / comboUp / comboBreak / forge / levelStart / levelClear / second / death / win

import { STEP, TIMER, FORGE, PROPS, RIDDLE, scoreFor } from '../../config/gameplay.js';
import { LEVEL_COUNT, levelAt } from '../../config/levels.js';
import { mulberry32 } from './rng.js';
import { generateQuestion, generateGrid } from './questions.js';
import { weaponAt, WEAPON_COUNT } from '../../config/weapons.js';

export function createRun({ seed = 1, lang = 'en', startLevel = 1 } = {}) {
  const rng = mulberry32(seed >>> 0);
  const run = {
    phase: 'playing',          // playing | dead | won
    lang: lang === 'zh' ? 'zh' : 'en',
    time: 0,                   // 本局累计时长（秒）
    levelIndex: Math.max(0, (startLevel - 1)),
    score: 0,
    combo: 0,
    maxCombo: 0,
    hints: PROPS.START_HINTS,
    resets: PROPS.START_RESETS,
    slag: 0,
    solvedTotal: 0,            // 全局累计答对数（驱动铸兵器）
    weaponsForged: 0,
    weapons: [],               // 已铸兵器 id 列表
    questionIndex: 0,
    question: null,
    grid: [],
    filled: {},                // blank 下标 → 已填字符
    currentBlank: 0,
    hinted: false,             // 本题是否用过提示（用提示不计连击加成）
    timeLeft: 0,
    scene: 0,
    _events: [],
    _used: new Set(),
    _second: -1,
    rng,
  };

  const level = levelAt(run.levelIndex + 1);
  run.timeLeft = level.time;
  run.scene = level.scene;

  run._emit = (type, payload = {}) => {
    run._events.push({ type, ...payload });
  };

  run.nextQuestion = () => {
    const lvl = levelAt(run.levelIndex + 1);
    const riddle = run.rng() < RIDDLE.CHANCE;
    run.question = generateQuestion({ lang: run.lang, blanks: lvl.blanks, riddle, rng: run.rng, used: run._used });
    run._used.add(run.question.key);
    run.grid = generateGrid({ question: run.question, gridSize: lvl.gridSize, lang: run.lang, rng: run.rng });
    run.filled = {};
    run.currentBlank = 0;
    run.hinted = false;
    run._emit(run.question.riddle ? 'riddle' : 'questionStart', {
      riddle: run.question.riddle,
      clue: run.question.clue,
      blanks: run.question.blanks.length,
    });
  };

  run._solve = () => {
    const q = run.question;
    const riddle = !!q.riddle;
    if (!run.hinted) {
      run.combo += 1;
      if (run.combo > run.maxCombo) run.maxCombo = run.combo;
      run._emit('comboUp', { combo: run.combo });
    }
    const gained = scoreFor({ riddle, combo: run.hinted ? 0 : run.combo });
    run.score += gained;
    run.solvedTotal += 1;
    run._emit('solve', { gained, score: run.score, riddle, combo: run.combo });

    const newWeapons = Math.min(WEAPON_COUNT, Math.floor(run.solvedTotal / FORGE.EVERY));
    if (newWeapons > run.weaponsForged) {
      const w = weaponAt(run.weaponsForged);
      run.weapons.push(w.id);
      run.weaponsForged = newWeapons;
      run._emit('forge', { weapon: w.id, index: run.weaponsForged });
    }

    run.questionIndex += 1;
    const lvl = levelAt(run.levelIndex + 1);
    if (run.questionIndex >= lvl.questions) {
      run._levelClear();
    } else {
      run.nextQuestion();
    }
  };

  run._levelClear = () => {
    run._emit('levelClear', { level: run.levelIndex + 1, score: run.score });
    if (run.levelIndex + 1 >= LEVEL_COUNT) {
      run.phase = 'won';
      run._emit('win', { score: run.score, weapons: run.weaponsForged });
      return;
    }
    run.levelIndex += 1;
    run.questionIndex = 0;
    const lvl = levelAt(run.levelIndex + 1);
    run.timeLeft = lvl.time;
    run.scene = lvl.scene;
    run._emit('levelStart', { level: run.levelIndex + 1, scene: lvl.scene, time: lvl.time });
    run.nextQuestion();
  };

  run._doPick = (idx) => {
    const q = run.question;
    if (!q) return;
    const gridChar = run.grid[idx];
    if (gridChar == null) return;
    run._emit('tileTap', { index: idx, char: gridChar });
    const blankIdx = q.blanks[run.currentBlank];
    const want = q.answer[blankIdx];
    if (gridChar === want) {
      run.filled[blankIdx] = gridChar;
      run._emit('charCorrect', { index: idx, char: gridChar, combo: run.combo, hinted: run.hinted });
      run.currentBlank += 1;
      if (run.currentBlank >= q.blanks.length) run._solve();
    } else {
      run._emit('charWrong', { index: idx, char: gridChar, want });
      run._emit('slag', { char: gridChar });
      run.timeLeft = Math.max(0, run.timeLeft - TIMER.WRONG_PENALTY);
      run.slag += 1;
      if (run.slag >= FORGE.SLAG_TO_HINT) {
        run.slag -= FORGE.SLAG_TO_HINT;
        run.hints += 1;
        run._emit('smelt', { hints: run.hints });
      }
      if (run.combo > 0) {
        run.combo = 0;
        run._emit('comboBreak', {});
      }
    }
  };

  run._doHint = () => {
    if (run.hints <= 0) return;
    const q = run.question;
    if (!q) return;
    const blankIdx = q.blanks[run.currentBlank];
    const want = q.answer[blankIdx];
    run.hints -= 1;
    run.hinted = true;
    run.filled[blankIdx] = want;
    run._emit('hint', { char: want, hints: run.hints });
    run._emit('charCorrect', { char: want, hinted: true, combo: run.combo });
    run.currentBlank += 1;
    if (run.currentBlank >= q.blanks.length) run._solve();
  };

  run._doReset = () => {
    if (run.resets <= 0) return;
    run.resets -= 1;
    if (run.combo > 0) {
      run.combo = 0;
      run._emit('comboBreak', {});
    }
    run._emit('reset', { resets: run.resets });
    run.nextQuestion();
  };

  run._die = () => {
    run.phase = 'dead';
    run._emit('death', { score: run.score, level: run.levelIndex + 1, timeLeft: 0 });
  };

  run.step = (input = {}) => {
    if (run.phase !== 'playing') return;
    run.time += STEP;
    run.timeLeft -= STEP;

    const s = Math.ceil(run.timeLeft);
    if (s !== run._second) {
      run._second = s;
      run._emit('second', { timeLeft: Math.max(0, s) });
    }

    if (input && input.reset) run._doReset();
    else if (input && input.hint) run._doHint();
    else if (input && Number.isInteger(input.pick) && input.pick >= 0) run._doPick(input.pick);

    if (run.phase === 'playing' && run.timeLeft <= 0) run._die();
  };

  run.getHud = () => {
    const lvl = levelAt(run.levelIndex + 1);
    return {
      phase: run.phase,
      lang: run.lang,
      level: run.levelIndex + 1,
      scene: run.scene,
      sceneName: 'scene.' + run.scene,
      questionIndex: Math.min(run.questionIndex + 1, lvl.questions),
      totalQuestions: lvl.questions,
      timeLeft: Math.max(0, run.timeLeft),
      timeMax: lvl.time,
      score: run.score,
      combo: run.combo,
      maxCombo: run.maxCombo,
      hints: run.hints,
      resets: run.resets,
      slag: run.slag,
      weapons: run.weaponsForged,
      weaponTotal: WEAPON_COUNT,
      forgeProgress: run.solvedTotal % FORGE.EVERY,
      forgeEvery: FORGE.EVERY,
      question: run.question,
      grid: run.grid,
      filled: run.filled,
      currentBlank: run.currentBlank,
    };
  };

  run.drainEvents = () => {
    const evs = run._events;
    run._events = [];
    return evs;
  };

  run.getLevel = () => run.levelIndex + 1;
  run.getStats = () => ({
    score: run.score,
    maxCombo: run.maxCombo,
    levelReached: run.levelIndex + 1,
    weaponsForged: run.weaponsForged,
    solvedTotal: run.solvedTotal,
  });

  run.nextQuestion();
  return run;
}
