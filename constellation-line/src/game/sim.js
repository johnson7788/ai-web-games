// src/game/sim.js — 星座连线模拟核心（纯逻辑，零依赖；不碰 DOM/localStorage/Date.now）
//
// 契约（与 playbook 一致）：
//   createRun({ levelIndex, seed }) → run
//   run.step(input)   input = { to?: globalNodeIndex }，每 tick 推进计时 + 尝试走边
//   run.beginSegment() / run.endSegment()   拖动「当前段」边界（走错重置当前段）
//   run.drainEvents() → 事件数组
//   run.getHud()      → HUD 快照
//
// 规则：从 start 出发，沿未走过的边走到相邻星；每条边恰走一次（欧拉路径）。
// 走错（边已用 / 不邻接 / 被流星遮）→ 重置当前段 + 记一次失误。
// 双星图：当前子图画完后，可点另一子图的起点切换画笔。
// 计分：基础分 - 步数 - 失误 - 用时；超时 = 失败。
import { STEP } from '../../config/game.config.js';
import { SCORING, METEOR as METEOR_CFG, FEEDBACK } from '../../config/gameplay.js';
import { getLevel } from '../../config/levels.js';
import { edgeKey, hierholzer } from './euler.js';
import { mulberry32 } from './rng.js';

// 把多分量关卡拍平成全局节点/边（供 sim 与 bot 共用同一坐标/索引空间）。
export function flattenLevel(level) {
  const nodes = [];
  const edges = [];
  const compOffsets = [];
  const compStartGlobal = [];
  const localToGlobal = [];
  level.components.forEach((c, ci) => {
    const off = nodes.length;
    compOffsets.push(off);
    localToGlobal.push(c.nodes.map((_n, i) => off + i));
    for (const n of c.nodes) nodes.push({ x: n.x, y: n.y, component: ci });
    for (const [a, b] of c.edges) edges.push({ a: off + a, b: off + b, component: ci, key: edgeKey(off + a, off + b) });
    compStartGlobal.push(off + c.start);
  });
  return { nodes, edges, compOffsets, compStartGlobal, localToGlobal };
}

export function createRun({ levelIndex = 0, seed = 1 } = {}) {
  const level = getLevel(levelIndex);
  const flat = flattenLevel(level);
  const rng = mulberry32(seed);

  const run = {
    rng,
    seed: seed >>> 0,
    level,
    levelIndex,
    phase: 'playing',
    time: 0,
    nodes: flat.nodes,
    edges: flat.edges,
    compStartGlobal: flat.compStartGlobal,
    localToGlobal: flat.localToGlobal,
    compOffsets: flat.compOffsets,
    totalEdges: flat.edges.length,
    current: flat.compStartGlobal[0],
    trail: [flat.compStartGlobal[0]],
    edgeStack: [],
    usedEdges: new Set(),
    segmentStart: 0,
    steps: 0,
    mistakes: 0,
    waypointVisited: false,
    meteorBlockedKey: null,
    meteorPrevBlocked: false,
    events: [],
    stats: { levelIndex: levelIndex + 1, stars: 0, score: 0, mistakes: 0, time: 0, completed: false },
    _won: false,
  };

  emit(run, 'levelStart', { level: levelIndex + 1, name: level.name, scene: level.scene });
  emit(run, 'constellation', { level: levelIndex + 1, name: level.name, scene: level.scene });

  run.step = (input) => step(run, input);
  run.beginSegment = () => beginSegment(run);
  run.endSegment = () => endSegment(run);
  run.drainEvents = () => drainEvents(run);
  run.getHud = () => getHud(run);
  run.solution = () => solution(run);
  return run;
}

// ---- 每 tick ----
function step(run, input = {}) {
  if (run.phase !== 'playing') return;
  run.time += STEP;
  updateMeteor(run);

  const to = input.to;
  if (to != null && to !== run.current) {
    attemptMove(run, to);
  }

  if (run.phase === 'playing' && run.time >= run.level.timeLimitSec) {
    fail(run, 'timeout');
  }
}

function beginSegment(run) {
  run.segmentStart = Math.max(0, run.trail.length - 1);
}

function endSegment(run) {
  run.segmentStart = Math.max(0, run.trail.length - 1);
}

// ---- 走边 ----
function attemptMove(run, to) {
  // 双星图：当前子图已画完 → 点另一子图起点 = 切笔
  if (run.level.type === 'dual' && currentComponentDone(run, run.current) && isOtherComponentStart(run, to)) {
    run.current = to;
    run.trail = [to];
    run.edgeStack = [];
    run.segmentStart = 0;
    emit(run, 'brushSwitch', { to });
    return;
  }

  const key = edgeKey(run.current, to);
  const edge = run.edges.find((e) => e.key === key && !run.usedEdges.has(e.key));
  if (!edge) {
    wrongMove(run, 'noEdge');
    return;
  }
  // 流星遮住该边：需绕行/等待（赌一把会被挡）
  if (run.meteorBlockedKey === key) {
    wrongMove(run, 'meteor');
    return;
  }

  run.usedEdges.add(key);
  run.trail.push(to);
  run.edgeStack.push(key);
  run.current = to;
  run.steps += 1;

  const progress = run.usedEdges.size;
  emit(run, 'edge', { from: run.trail[run.trail.length - 2], to, steps: run.steps, used: progress, total: run.totalEdges });

  if (run.steps > 0 && run.steps % FEEDBACK.PROGRESS_EVERY === 0) {
    emit(run, 'progress', { used: progress, total: run.totalEdges, pct: Math.round((progress / run.totalEdges) * 100) });
  }

  // 必经节点（北极星）
  if (run.level.waypoint != null && !run.waypointVisited) {
    const wpGlobal = run.localToGlobal[0][run.level.waypoint];
    if (to === wpGlobal) {
      run.waypointVisited = true;
      emit(run, 'waypoint', { node: to });
    }
  }

  if (progress >= run.totalEdges) {
    win(run);
  }
}

function wrongMove(run, reason) {
  run.mistakes += 1;
  // 重置当前段：撤销自 segmentStart 起画的边
  const anchor = run.segmentStart;
  while (run.edgeStack.length > anchor) {
    const k = run.edgeStack.pop();
    run.usedEdges.delete(k);
  }
  run.trail.length = anchor + 1;
  run.current = run.trail[anchor];
  emit(run, 'wrong', { reason, mistakes: run.mistakes, steps: run.steps });
}

function currentComponentDone(run, globalNode) {
  const ci = nodeComponent(run, globalNode);
  const edgesOf = run.edges.filter((e) => e.component === ci);
  return edgesOf.every((e) => run.usedEdges.has(e.key));
}

function isOtherComponentStart(run, to) {
  const ci = nodeComponent(run, to);
  if (ci === -1) return false;
  return run.compStartGlobal[ci] === to && ci !== nodeComponent(run, run.current);
}

function nodeComponent(run, globalNode) {
  return run.nodes[globalNode] ? run.nodes[globalNode].component : -1;
}

function win(run) {
  run.phase = 'won';
  run.stats.completed = true;
  run.stats.time = run.time;
  run.stats.mistakes = run.mistakes;
  run.stats.score = computeScore(run);
  run.stats.stars = computeStars(run);
  emit(run, 'win', {
    level: run.levelIndex + 1,
    steps: run.steps,
    mistakes: run.mistakes,
    time: run.time,
    score: run.stats.score,
    stars: run.stats.stars,
  });
  if (run.mistakes === 0) emit(run, 'perfect', { level: run.levelIndex + 1 });
}

function fail(run, reason) {
  run.phase = 'failed';
  run.stats.time = run.time;
  run.stats.mistakes = run.mistakes;
  emit(run, 'fail', { reason, level: run.levelIndex + 1, steps: run.steps, mistakes: run.mistakes });
}

function computeScore(run) {
  const minSteps = run.totalEdges;
  const extraSteps = Math.max(0, run.steps - minSteps);
  const raw = SCORING.BASE - extraSteps * SCORING.STEP_PENALTY - run.mistakes * SCORING.MISTAKE_PENALTY - run.time * SCORING.TIME_PENALTY_PER_SEC;
  return Math.max(0, Math.round(raw));
}

function computeStars(run) {
  const ratio = run.time / Math.max(1, run.level.timeLimitSec);
  if (ratio <= SCORING.STAR3_TIME && run.mistakes <= 0) return 3;
  if (ratio <= SCORING.STAR2_TIME || (run.mistakes <= SCORING.STAR2_MISTAKE_MAX && run.stats.score >= SCORING.STAR1_MIN)) return 2;
  if (run.stats.score >= SCORING.STAR1_MIN) return 1;
  return 1;
}

// ---- 流星干扰 ----
function updateMeteor(run) {
  const m = run.level.meteor;
  if (!m) {
    run.meteorBlockedKey = null;
    return;
  }
  const periodSec = m.periodSec || METEOR_CFG.defaultPeriodSec;
  const blockedSec = m.blockedSec || METEOR_CFG.defaultBlockedSec;
  const blocked = (run.time % periodSec) < blockedSec;
  const key = edgeKey(run.localToGlobal[0][m.edge[0]], run.localToGlobal[0][m.edge[1]]);
  run.meteorBlockedKey = blocked ? key : null;
  if (blocked !== run.meteorPrevBlocked) {
    emit(run, blocked ? 'meteorBlock' : 'meteorClear', { edge: m.edge });
    run.meteorPrevBlocked = blocked;
  }
  // 遮住期间每 tick 一个细粒度反馈（流星持续划过，肉眼可见 → 不算空转）
  if (blocked) emit(run, 'meteorSweep', { edge: m.edge });
}

// ---- HUD / 事件 / 解 ----
function getHud(run) {
  const remaining = Math.max(0, run.totalEdges - run.usedEdges.size);
  return {
    level: run.levelIndex + 1,
    levelName: run.level.name,
    scene: run.level.scene,
    time: run.time,
    timeLimit: run.level.timeLimitSec,
    steps: run.steps,
    mistakes: run.mistakes,
    remaining,
    total: run.totalEdges,
    waypointReached: run.waypointVisited,
    meteorBlocked: run.meteorBlockedKey != null,
    phase: run.phase,
  };
}

function solution(run) {
  return run.level.components.map((c, ci) => {
    const localTrail = hierholzer(c.nodes.length, c.edges, c.start) || [];
    return { component: ci, trail: localTrail.map((li) => run.localToGlobal[ci][li]) };
  });
}

function emit(run, type, fields = {}) {
  run.events.push({ type, ...fields });
}

function drainEvents(run) {
  const ev = run.events;
  run.events = [];
  return ev;
}
