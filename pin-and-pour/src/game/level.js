// PIN & POUR · 关卡可解性 solver（BFS 找最小获胜抽闸顺序）。
// 供 tests/levels.test.mjs 与 tools/selfplay.mjs 使用；纯逻辑，复用 sim.js 的确定性物理。
import { LEVELS } from '../../config/levels.js';
import { createRun } from './sim.js';

// 每次抽闸后都 settle 到静止（重力走完），再抽下一根——与真实玩法一致。
function settleRun(run, maxTicks = 4000) {
  let guard = 0;
  while (run.state.phase === 'playing' && guard < maxTicks) {
    if (run.isSettled()) break;
    run.tick();
    guard += 1;
  }
}

// 按给定顺序抽闸（每根之间 settle），返回最终 phase（'won'|'lost'|'playing'）。
export function simulateOrder(levelIndex, order) {
  const run = createRun(levelIndex, { seed: 1 });
  settleRun(run);
  for (const id of order) {
    if (run.state.phase !== 'playing') break;
    const res = run.pullGate(id);
    if (!res.ok) break;
    settleRun(run);
  }
  return run.state.phase;
}

// 最小获胜顺序（BFS，每根闸最多抽一次）。
export function findSolution(levelIndex) {
  const level = LEVELS[levelIndex];
  if (!level) return null;
  const ids = (level.gates || []).map((g) => g.id);
  const queue = [[]];
  const seen = new Set(['']);
  let guard = 0;
  while (queue.length && guard < 200000) {
    guard += 1;
    const seq = queue.shift();
    const phase = simulateOrder(levelIndex, seq);
    if (phase === 'won') return seq;
    if (phase === 'lost') continue;
    for (const id of ids) {
      if (seq.includes(id)) continue;
      const ns = [...seq, id];
      const key = ns.join(',');
      if (!seen.has(key)) {
        seen.add(key);
        queue.push(ns);
      }
    }
  }
  return null;
}

export function isSolvable(levelIndex) {
  return findSolution(levelIndex) !== null;
}

// 最小「干净」解：获胜且所有气泡都排空（drained===totalBubble）。
export function findCleanSolution(levelIndex) {
  const level = LEVELS[levelIndex];
  if (!level) return null;
  const ids = (level.gates || []).map((g) => g.id);
  const queue = [[]];
  const seen = new Set(['']);
  let guard = 0;
  while (queue.length && guard < 200000) {
    guard += 1;
    const seq = queue.shift();
    const run = createRun(levelIndex, { seed: 1 });
    settleRun(run);
    for (const id of seq) {
      if (run.state.phase !== 'playing') break;
      run.pullGate(id);
      settleRun(run);
    }
    if (run.state.phase === 'won' && run.state.drained === run.state.totalBubble) return seq;
    if (run.state.phase === 'lost') continue;
    for (const id of ids) {
      if (seq.includes(id)) continue;
      const ns = [...seq, id];
      const key = ns.join(',');
      if (!seen.has(key)) { seen.add(key); queue.push(ns); }
    }
  }
  return null;
}
