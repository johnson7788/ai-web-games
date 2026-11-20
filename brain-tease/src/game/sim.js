// src/game/sim.js — 纯逻辑谜题引擎（无 DOM / 无 window / 无 localStorage / 无 Date.now）。
//
// createRun({ levelIndex, seed }) → run（横跨 24 关的战役状态机）。
// run 的输入模型是「手势」而非连续按键：
//   step({ gesture })  固定步长推进 time，并消费一个手势（可为空）。
//   gesture ∈ { kind:'tap', x, y }
//           | { kind:'drag', id, fromX, fromY, toX, toY }
//   applyGesture(g)    把手势归一化成解法动作，命中→correct，落空→wrong（失误数 +1）。
//
// 关卡推进：solveCurrent()（调试/贪心 bot 用）→ phase='solved'；nextLevel() 进下一关。
// 事件（drainEvents 消费）：levelEnter / tap / drag / tapProgress / correct / wrong /
//   hint / helpUnlocked / doctorSolve / invert / levelClear / roast / star / complete。
import { LEVELS } from '../../config/levels.js';
import { STEP } from '../../config/game.config.js';

const DRAG_OFF_MIN = 80; // 拖离原地的最小距离（px）才计为「拖走」

function reqMatches(req, action) {
  switch (req.kind) {
    case 'tap': return action.kind === 'tap' && action.id === req.id;
    case 'tapN': return action.kind === 'tap' && action.id === req.id;
    case 'shadow': return action.kind === 'shadow' && action.id === req.id;
    case 'dragTo': return action.kind === 'dragTo' && action.id === req.id && action.targetId === req.targetId;
    case 'dragOff': return action.kind === 'dragOff' && action.id === req.id;
    case 'invert': return action.kind === 'invert';
    default: return false;
  }
}

function rectHit(r, x, y) {
  return Math.abs(x - r.x) <= r.w / 2 && Math.abs(y - r.y) <= r.h / 2;
}

export function createRun({ levelIndex = 0 } = {}) {
  const run = {
    phase: 'playing',       // playing | solved | complete
    levelIndex,
    time: 0,
    levelStartAt: 0,
    failCount: 0,           // 累计失误（= 遥测里的「死亡」：错误答案尝试）
    stars: new Array(LEVELS.length).fill(0),
    solvedCount: 0,
    events: [],
    level: null,
    objects: [],
    ls: null,
  };

  run._resetLevelState = function _resetLevelState() {
    run.level = LEVELS[run.levelIndex];
    run.objects = run.level.objects.map((o) => ({
      ...o,
      label: { ...o.label },
      shadow: o.shadow ? { ...o.shadow } : null,
    }));
    run.ls = {
      done: new Array(run.level.solution.length).fill(false),
      tapProgress: {},
      sceneRotated: false,
      hintUsed: false,
      doctorUsed: false,
      failThisLevel: 0,
      helpUnlocked: false,
      moved: new Set(),
      placed: new Map(),
    };
    run.levelStartAt = run.time;
  };

  run._objectById = function _objectById(id) {
    return run.objects.find((o) => o.id === id) || null;
  };

  run._isCovered = function _isCovered(obj) {
    return !!obj.coveredBy && !run.ls.moved.has(obj.coveredBy);
  };

  run._isMoved = function _isMoved(id) {
    return run.ls.moved.has(id);
  };

  /** 命中最上层（后声明者在上）可点物体；跳过已拖走的盖子和仍被盖住的物体。 */
  run.hitObject = function hitObject(x, y, excludeId) {
    for (let i = run.objects.length - 1; i >= 0; i -= 1) {
      const o = run.objects[i];
      if (o.id === excludeId) continue;
      if (run._isCovered(o) || run._isMoved(o.id)) continue;
      if (rectHit(o, x, y)) return o;
    }
    return null;
  };

  run.hitDraggable = function hitDraggable(x, y) {
    for (let i = run.objects.length - 1; i >= 0; i -= 1) {
      const o = run.objects[i];
      if (!o.draggable) continue;
      if (run._isCovered(o) || run._isMoved(o.id)) continue;
      if (rectHit(o, x, y)) return o;
    }
    return null;
  };

  run.hitShadow = function hitShadow(x, y) {
    for (let i = run.objects.length - 1; i >= 0; i -= 1) {
      const o = run.objects[i];
      if (!o.shadow || run._isMoved(o.id)) continue;
      if (rectHit(o.shadow, x, y)) return o;
    }
    return null;
  };

  run.emit = function emit(type, payload) {
    run.events.push({ type, time: run.time, ...(payload || {}) });
  };

  run._wrong = function _wrong() {
    run.failCount += 1;
    run.ls.failThisLevel += 1;
    run.emit('wrong', { failCount: run.failCount, levelFail: run.ls.failThisLevel });
    if (run.ls.failThisLevel === 3) {
      run.ls.helpUnlocked = true;
      run.emit('helpUnlocked', {});
    }
  };

  run._checkSolved = function _checkSolved() {
    if (run.ls.done.every(Boolean)) run._finishLevel();
  };

  run._finishLevel = function _finishLevel() {
    const stars = run.ls.doctorUsed ? 1 : (run.ls.hintUsed ? 2 : 3);
    run.stars[run.levelIndex] = stars;
    run.solvedCount = Math.max(run.solvedCount, run.levelIndex + 1);
    run.phase = 'solved';
    const elapsedMs = Math.round((run.time - run.levelStartAt) * 1000);
    run.emit('levelClear', { levelIndex: run.levelIndex, levelNumber: run.levelIndex + 1, stars, elapsedMs });
    run.emit('roast', { levelIndex: run.levelIndex, levelNumber: run.levelIndex + 1, stars, elapsedMs });
    run.emit('star', { stars });
    if (run.levelIndex >= LEVELS.length - 1) {
      run.phase = 'complete';
      run.emit('complete', {});
    }
  };

  run._rotate = function _rotate() {
    run.ls.sceneRotated = !run.ls.sceneRotated;
    run.emit('invert', { rotated: run.ls.sceneRotated });
    run._try({ kind: 'invert' });
  };

  /** 把归一化动作喂给解法匹配：命中→correct（必要时推进），落空→wrong。 */
  run._try = function _try(action) {
    const sol = run.level.solution;
    const strict = run.level.strict === true;
    let firstPending = 0;
    if (strict) {
      while (firstPending < sol.length && run.ls.done[firstPending]) firstPending += 1;
    }
    for (let i = 0; i < sol.length; i += 1) {
      if (run.ls.done[i]) continue;
      if (strict && i !== firstPending) continue;
      const req = sol[i];
      if (!reqMatches(req, action)) {
        if (strict) break;
        continue;
      }
      // 命中
      if (req.kind === 'tapN') {
        const p = (run.ls.tapProgress[req.id] || 0) + 1;
        run.ls.tapProgress[req.id] = p;
        run.emit('tapProgress', { id: req.id, count: p, total: req.count });
        if (p >= req.count) {
          run.ls.done[i] = true;
          run.emit('correct', { id: req.id, kind: 'tapN' });
          run._checkSolved();
        }
        return;
      }
      run.ls.done[i] = true;
      if (req.kind === 'dragOff') { run.ls.moved.add(req.id); run.ls.placed.delete(req.id); }
      if (req.kind === 'dragTo') { run.ls.placed.set(req.id, req.targetId); }
      run.emit('correct', { id: action.id, kind: req.kind });
      run._checkSolved();
      return;
    }
    run._wrong();
  };

  run.applyGesture = function applyGesture(g) {
    if (!g || run.phase !== 'playing') return;
    if (g.kind === 'tap') {
      const hit = run.hitObject(g.x, g.y);
      if (run.level.rotate && hit && hit.id === 'handle') {
        run.emit('tap', { id: 'handle' });
        run._rotate();
        return;
      }
      const sh = run.hitShadow(g.x, g.y);
      if (sh) {
        run.emit('tap', { id: sh.id, shadow: true });
        run._try({ kind: 'shadow', id: sh.id });
        return;
      }
      if (!hit) {
        run.emit('tap', { empty: true });
        return;
      }
      run.emit('tap', { id: hit.id });
      run._try({ kind: 'tap', id: hit.id });
      return;
    }
    if (g.kind === 'drag') {
      const obj = run._objectById(g.id);
      if (!obj || !obj.draggable) return;
      if (run.level.rotate && g.id === 'handle') {
        run.emit('drag', { id: g.id });
        run._rotate();
        return;
      }
      const dist = Math.hypot(g.toX - g.fromX, g.toY - g.fromY);
      const drop = run.hitObject(g.toX, g.toY, g.id);
      run.emit('drag', { id: g.id, dist: Math.round(dist) });
      if (drop && drop.id !== g.id) {
        run._try({ kind: 'dragTo', id: g.id, targetId: drop.id });
      } else if (dist >= DRAG_OFF_MIN) {
        run._try({ kind: 'dragOff', id: g.id });
      } else {
        run._wrong();
      }
      return;
    }
  };

  run.step = function step(input) {
    input = input || {};
    run.time += STEP;
    if (input.gesture) run.applyGesture(input.gesture);
  };

  run.drainEvents = function drainEvents() {
    const evs = run.events;
    run.events = [];
    return evs;
  };

  run.getHud = function getHud() {
    return {
      levelNumber: run.levelIndex + 1,
      totalLevels: LEVELS.length,
      chapter: run.level.chapter,
      scene: run.level.scene,
      goal: run.level.goal,
      failCount: run.failCount,
      helpUnlocked: run.ls.helpUnlocked,
      hintUsed: run.ls.hintUsed,
      stars: run.stars[run.levelIndex] || 0,
      elapsedMs: Math.round((run.time - run.levelStartAt) * 1000),
      solvedCount: run.solvedCount,
      sceneRotated: run.ls.sceneRotated,
    };
  };

  run.useHint = function useHint() {
    if (run.phase !== 'playing' || run.ls.hintUsed) return false;
    run.ls.hintUsed = true;
    run.emit('hint', { levelIndex: run.levelIndex });
    return true;
  };

  run.doctorSolve = function doctorSolve() {
    if (run.phase !== 'playing' || !run.ls.helpUnlocked) return false;
    run.ls.doctorUsed = true;
    run.emit('doctorSolve', {});
    run._forceSolve();
    return true;
  };

  run._forceSolve = function _forceSolve() {
    const sol = run.level.solution;
    for (let i = 0; i < sol.length; i += 1) run.ls.done[i] = true;
    for (const req of sol) {
      if (req.kind === 'dragOff') run.ls.moved.add(req.id);
      if (req.kind === 'dragTo') run.ls.placed.set(req.id, req.targetId);
    }
    run.emit('correct', { id: 'solve' });
    run._finishLevel();
  };

  run.solveCurrent = function solveCurrent() {
    if (run.phase !== 'playing') return false;
    run._forceSolve();
    return true;
  };

  run.nextLevel = function nextLevel() {
    if (run.levelIndex >= LEVELS.length - 1) {
      run.phase = 'complete';
      run.emit('complete', {});
      return;
    }
    run.levelIndex += 1;
    run._resetLevelState();
    run.phase = 'playing';
    run.emit('levelEnter', { levelIndex: run.levelIndex, levelNumber: run.levelIndex + 1, chapter: run.level.chapter, scene: run.level.scene });
  };

  run.resetLevel = function resetLevel() {
    run._resetLevelState();
    run.phase = 'playing';
    run.emit('levelEnter', { levelIndex: run.levelIndex, levelNumber: run.levelIndex + 1, chapter: run.level.chapter, scene: run.level.scene, reset: true });
  };

  run._resetLevelState();
  run.emit('levelEnter', { levelIndex: run.levelIndex, levelNumber: run.levelIndex + 1, chapter: run.level.chapter, scene: run.level.scene });

  return run;
}

export default createRun;
