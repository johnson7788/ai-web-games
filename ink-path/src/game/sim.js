// INK PATH · 模拟层（纯逻辑，零 DOM/window/Date.now/canvas）
// 职责：星网图状态、织丝（延伸）/ 回退（backtrack）/ 弃局、单向边与断线解锁、
//       胜负判定、星级结算、事件表。
// 依赖：config/levels.js（LEVELS/LEVEL_COUNT）、src/game/solver.js。
// 随机：mulberry32（注入 seed，可复现，本作暂不用于关卡生成）。

import { LEVELS } from '../../config/levels.js';
import { normalizeLevel, availableMoves, solve } from './solver.js';
import { GAME } from '../../config/game.config.js';

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 找到连接 a/b 的边下标（方向无关；本作无平行边）
function findEdgeIndex(L, a, b) {
  for (let i = 0; i < L.edges.length; i += 1) {
    const e = L.edges[i];
    if ((e.a === a && e.b === b) || (e.a === b && e.b === a)) return i;
  }
  return -1;
}

export function createRun(levelIndex = 0, opts = {}) {
  const level = LEVELS[levelIndex] ?? LEVELS[0];
  const L = normalizeLevel(level);
  const n = L.nodes.length;
  const m = L.edges.length;
  const allNodes = (1 << n) - 1;
  const allEdges = (1 << m) - 1;
  const solution = solve(level) || null;
  const parMoves = solution ? solution.length - 1 : (L.mode === 'nodes' ? n - 1 : m);

  const state = {
    level: level.index,
    scene: level.scene,
    mode: L.mode,
    phase: 'playing', // 'playing' | 'won' | 'lost'
    nodes: L.nodes,
    edges: L.edges,
    start: level.start,
    current: level.start,
    path: [level.start],
    visitedMask: 1 << level.start,
    traversedMask: 0,
    enteredMask: 1 << level.start,
    moves: 0,          // 累计成功「延伸」次数（含回退后的重新延伸，用于星级）
    undos: 0,          // 回退次数
    par: parMoves,
    stars: 0,
    result: null,
  };

  const run = {
    state,
    _level: level,
    _L: L,
    _solution: solution,
    _events: [],
    _clock: 0,

    step(dt) {
      // 离散益智：无连续物理；仅推进累计时钟，保持 60Hz 契约一致。
      if (this.state.phase === 'won' || this.state.phase === 'lost') return;
      if (Number.isFinite(dt) && dt > 0) this._clock += dt;
    },

    // 当前星子还能走的合法下一步
    available() {
      if (this.state.phase !== 'playing') return [];
      return availableMoves(this._L, this.state.current, {
        visitedMask: this.state.visitedMask,
        traversedMask: this.state.traversedMask,
        enteredMask: this.state.enteredMask,
      });
    },

    // 延伸：从 current 走到 target（须有合法丝线）
    tryMove(target) {
      const s = this.state;
      if (s.phase !== 'playing') return { ok: false, reason: 'phase' };
      if (!Number.isInteger(target) || target < 0 || target >= s.nodes.length) {
        this._emit({ type: 'nearMiss', reason: 'bounds', to: target });
        return { ok: false, reason: 'bounds' };
      }
      const opts = this.available();
      const found = opts.find((o) => o.next === target);
      if (!found) {
        this._emit({ type: 'nearMiss', reason: 'noMove', from: s.current, to: target });
        return { ok: false, reason: 'noMove' };
      }

      const from = s.current;
      const newlyVisited = !(s.visitedMask & (1 << target));
      const newlyEntered = !(s.enteredMask & (1 << target));

      s.path.push(target);
      s.current = target;
      s.moves += 1;
      s.visitedMask |= 1 << target;
      s.enteredMask |= 1 << target;
      s.traversedMask |= 1 << found.edgeIdx;

      this._emit({ type: 'move', from, to: target });
      if (newlyVisited || newlyEntered) this._emit({ type: 'nodeLit', node: target });
      this._emit({ type: 'edgeLit', a: from, b: target });

      if (newlyEntered) {
        for (const e of this._L.edges) {
          if (e.gate === target) this._emit({ type: 'gateUnlock', a: e.a, b: e.b });
        }
      }

      const after = this.available();
      if (after.length >= 2) this._emit({ type: 'fork', node: target, options: after.length });

      this._checkEnd();
      return { ok: true };
    },

    // 回退：截断路径到 target（target 必须在已走路径中，且不是当前星子）
    backtrack(target) {
      const s = this.state;
      if (s.phase !== 'playing') return { ok: false, reason: 'phase' };
      const idx = s.path.lastIndexOf(target);
      if (idx < 0 || idx === s.path.length - 1) return { ok: false, reason: 'notInPath' };
      s.path.length = idx + 1;
      s.current = target;
      s.undos += 1;
      this._rebuildMasks();
      this._emit({ type: 'undo', to: target });
      return { ok: true };
    },

    // 回退一步
    undo() {
      const s = this.state;
      if (s.path.length < 2) return { ok: false, reason: 'empty' };
      return this.backtrack(s.path[s.path.length - 2]);
    },

    // 弃局（UI「Give up」按钮 + random 遥测用）
    forfeit() {
      if (this.state.phase !== 'playing') return { ok: false, reason: 'phase' };
      this._lose('giveUp');
      return { ok: true };
    },

    getHud() {
      const s = this.state;
      const visited = s.mode === 'nodes'
        ? countBits(s.visitedMask)
        : countBits(s.traversedMask);
      const total = s.mode === 'nodes' ? s.nodes.length : s.edges.length;
      return {
        level: s.level,
        mode: s.mode,
        phase: s.phase,
        moves: s.moves,
        par: s.par,
        undos: s.undos,
        stars: s.stars,
        visited,
        total,
        remaining: total - visited,
      };
    },

    drainEvents() {
      const ev = this._events;
      this._events = [];
      return ev;
    },

    // ---------------- 内部 ----------------
    _emit(e) { this._events.push(e); },

    _rebuildMasks() {
      const s = this.state;
      let vm = 0;
      let em = 0;
      let tm = 0;
      for (const id of s.path) {
        vm |= 1 << id;
        em |= 1 << id;
      }
      for (let i = 0; i < s.path.length - 1; i += 1) {
        const ei = findEdgeIndex(this._L, s.path[i], s.path[i + 1]);
        if (ei >= 0) tm |= 1 << ei;
      }
      s.visitedMask = vm;
      s.enteredMask = em;
      s.traversedMask = tm;
    },

    _checkEnd() {
      const s = this.state;
      const complete = s.mode === 'nodes'
        ? s.visitedMask === allNodes
        : s.traversedMask === allEdges;
      if (complete) {
        this._win();
        return;
      }
      if (this.available().length === 0) this._lose('deadEnd');
    },

    _win() {
      const s = this.state;
      s.phase = 'won';
      const slack = Math.max(1, Math.ceil(s.par * GAME.STAR_SLACK));
      const stars = s.moves === s.par ? 3 : (s.moves <= s.par + slack ? 2 : 1);
      s.stars = stars;
      s.result = { won: true, stars, moves: s.moves, undos: s.undos, par: s.par };
      this._emit({ type: 'win', stars, moves: s.moves, undos: s.undos, par: s.par });
    },

    _lose(reason) {
      const s = this.state;
      s.phase = 'lost';
      s.stars = 0;
      s.result = { won: false, reason, moves: s.moves, undos: s.undos, par: s.par };
      this._emit({ type: 'lose', reason });
    },
  };

  run._emit({ type: 'start', level: level.index, mode: L.mode, par: parMoves });

  return run;
}

function countBits(mask) {
  let c = 0;
  let m = mask;
  while (m) {
    m &= m - 1;
    c += 1;
  }
  return c;
}

// 兼容骨架别名（Lead 重写 main 后可移除）
export function createSim() {
  return createRun(0, { seed: 1 });
}

export function updateSim(sim, _input) {
  sim.step(1 / 60);
  return sim;
}
