// SOKO WAREHOUSE · 模拟层（纯逻辑，零 DOM/window/Date.now/canvas）
// 职责：推箱移动/推箱/回退/连击/星级结算/事件表。
// 依赖：config/levels.js（LEVELS）。
// 规则（源自推箱子，P0 1:1）：
//   - 4 方向移动；墙/岩石不可进入；
//   - 前方是箱子则尝试推箱（箱子后方为墙/岩石/箱子则推不动，人也不动）；
//   - 所有箱子落到目标格 → 过关；步数超限 → 失败；
//   - 走路/推箱都消耗 1 步；回退有限次数。
// 新机制：岩石（内部障碍）、星级（按 par 评级）、连击（连续推箱）。
import { LEVELS } from '../../config/levels.js';
import { parseLevel, getPar } from './level.js';

const DIRS = {
  up: { dr: -1, dc: 0 },
  down: { dr: 1, dc: 0 },
  left: { dr: 0, dc: -1 },
  right: { dr: 0, dc: 1 },
};

export const DIR_LIST = ['up', 'down', 'left', 'right'];

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function computeStars(moves, par) {
  if (typeof par !== 'number' || par <= 0) return 1;
  if (moves <= par) return 3;
  if (moves <= Math.ceil(par * 1.5)) return 2;
  return 1;
}

export function createRun(levelIndex = 0, opts = {}) {
  const idx = Math.max(0, Math.min(LEVELS.length - 1, levelIndex | 0));
  const level = LEVELS[idx];
  const parsed = parseLevel(level);

  const run = {
    state: null,
    _level: level,
    _levelIndex: idx,
    _events: [],
    _clock: 0,
    _rng: mulberry32((opts.seed ?? 1) >>> 0),

    init() {
      const boxArr = parsed.boxes.map((b) => ({ id: b.id, r: b.r, c: b.c }));
      let onTarget = 0;
      for (const b of boxArr) {
        if (parsed.terrain[b.r][b.c].target) onTarget += 1;
      }
      this.state = {
        level: level.index,
        phase: 'playing',
        rows: parsed.rows,
        cols: parsed.cols,
        terrain: parsed.terrain,
        walls: parsed.walls,
        rocks: parsed.rocks,
        targets: parsed.targets,
        player: { r: parsed.player.r, c: parsed.player.c },
        boxes: boxArr,
        moves: 0,
        pushes: 0,
        moveLimit: level.moveLimit,
        undoLeft: level.undo,
        combo: 0,
        maxCombo: 0,
        boxesOnTarget: onTarget,
        par: getPar(idx),
        stars: 0,
        result: null,
      };
      this._history = [];
      this._clock = 0;
      this._events = [];
      this._emit({ type: 'levelStart', level: level.index });
      return this.state;
    },

    _emit(ev) { this._events.push(ev); },

    _boxAt(r, c) {
      return this.state.boxes.find((b) => b.r === r && b.c === c) || null;
    },

    step(dt) {
      this._clock += Number.isFinite(dt) ? Math.max(0, dt) : 0;
    },

    move(dir) {
      const s = this.state;
      if (s.phase !== 'playing') return { ok: false, reason: 'ended' };
      const d = DIRS[dir];
      if (!d) return { ok: false, reason: 'badDir' };
      const nr = s.player.r + d.dr;
      const nc = s.player.c + d.dc;
      if (nr < 0 || nr >= s.rows || nc < 0 || nc >= s.cols) return { ok: false, reason: 'bounds' };
      const tgt = s.terrain[nr][nc];
      if (tgt.kind === 'wall' || tgt.kind === 'rock') return { ok: false, reason: 'blocked' };

      const playerFrom = { r: s.player.r, c: s.player.c };
      const box = this._boxAt(nr, nc);

      if (box) {
        const br = nr + d.dr;
        const bc = nc + d.dc;
        if (br < 0 || br >= s.rows || bc < 0 || bc >= s.cols) return { ok: false, reason: 'blocked' };
        const btgt = s.terrain[br][bc];
        if (btgt.kind === 'wall' || btgt.kind === 'rock') return { ok: false, reason: 'blocked' };
        if (this._boxAt(br, bc)) return { ok: false, reason: 'blocked' };

        const wasOnTarget = tgt.target;
        const nowOnTarget = btgt.target;
        const boxFrom = { r: nr, c: nc };
        const boxTo = { r: br, c: bc };
        box.r = br;
        box.c = bc;
        if (wasOnTarget && !nowOnTarget) s.boxesOnTarget -= 1;
        if (!wasOnTarget && nowOnTarget) s.boxesOnTarget += 1;

        const comboBefore = s.combo;
        s.pushes += 1;
        s.combo += 1;
        if (s.combo > s.maxCombo) s.maxCombo = s.combo;

        this._history.push({
          type: 'push', playerFrom, playerTo: { r: nr, c: nc },
          boxId: box.id, boxFrom, boxTo, wasOnTarget, nowOnTarget, comboBefore,
        });

        s.player.r = nr;
        s.player.c = nc;
        s.moves += 1;

        this._emit({ type: 'push', dir, boxId: box.id, combo: s.combo, r: br, c: bc });
        if (nowOnTarget) this._emit({ type: 'target', r: br, c: bc, boxId: box.id });
        if (wasOnTarget && !nowOnTarget) this._emit({ type: 'offTarget', r: nr, c: nc, boxId: box.id });
        if (s.combo >= 2) this._emit({ type: 'combo', combo: s.combo, r: s.player.r, c: s.player.c });
      } else {
        const comboBefore = s.combo;
        s.combo = 0;
        this._history.push({ type: 'walk', playerFrom, playerTo: { r: nr, c: nc }, comboBefore });
        s.player.r = nr;
        s.player.c = nc;
        s.moves += 1;
        this._emit({ type: 'move', dir });
      }

      if (s.boxesOnTarget >= s.boxes.length) {
        this._win();
      } else if (s.moves > s.moveLimit) {
        this._lose('moves');
      }
      return { ok: true, dir, moved: true };
    },

    undo() {
      const s = this.state;
      if (s.phase !== 'playing') return { ok: false, reason: 'ended' };
      if (s.undoLeft <= 0) return { ok: false, reason: 'noUndo' };
      if (this._history.length === 0) return { ok: false, reason: 'empty' };
      const h = this._history.pop();
      s.player.r = h.playerFrom.r;
      s.player.c = h.playerFrom.c;
      s.moves -= 1;
      s.combo = h.comboBefore;
      if (h.type === 'push') {
        const box = s.boxes.find((b) => b.id === h.boxId);
        if (box) { box.r = h.boxFrom.r; box.c = h.boxFrom.c; }
        if (h.wasOnTarget && !h.nowOnTarget) s.boxesOnTarget += 1;
        if (!h.wasOnTarget && h.nowOnTarget) s.boxesOnTarget -= 1;
        s.pushes -= 1;
      }
      s.undoLeft -= 1;
      this._emit({ type: 'undo', undoLeft: s.undoLeft });
      return { ok: true };
    },

    _win() {
      const s = this.state;
      s.phase = 'won';
      s.stars = computeStars(s.moves, s.par);
      s.result = { won: true, moves: s.moves, pushes: s.pushes, par: s.par, stars: s.stars, combo: s.maxCombo };
      this._emit({ type: 'win', stars: s.stars, moves: s.moves, par: s.par, pushes: s.pushes, combo: s.maxCombo });
    },

    _lose(reason) {
      const s = this.state;
      s.phase = 'lost';
      s.stars = 0;
      s.result = { won: false, reason, moves: s.moves, pushes: s.pushes, par: s.par, stars: 0 };
      this._emit({ type: 'lose', reason, moves: s.moves, pushes: s.pushes });
    },

    restart() {
      return this.init();
    },

    drainEvents() {
      const ev = this._events;
      this._events = [];
      return ev;
    },

    getHud() {
      const s = this.state;
      return {
        level: s.level,
        phase: s.phase,
        moves: s.moves,
        moveLimit: s.moveLimit,
        undoLeft: s.undoLeft,
        boxesOnTarget: s.boxesOnTarget,
        boxTotal: s.boxes.length,
        combo: s.combo,
        par: s.par,
        stars: s.stars,
      };
    },
  };

  run.init();
  return run;
}
