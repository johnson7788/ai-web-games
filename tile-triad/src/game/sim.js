// TILE TRIAD · 模拟层（纯逻辑，零 DOM/window/Date.now/canvas）
// 职责：层叠牌局、拾取入槽、三同消除、撤回/洗牌、倒计时、星级结算、事件表。
// 依赖：config/levels.js（LEVELS）、config/game.config.js（GAME）、board.js（generateBoard）。
// 契约：docs/README.md §3（createRun API / state 形状 / 事件表）。
// 随机：注入 seed 的 mulberry32，可复现；解序列由生成器保证。

import { LEVELS } from '../../config/levels.js';
import { GAME } from '../../config/game.config.js';
import { generateBoard, tileIsFree } from './board.js';

export function createRun(levelIndex = 0, opts = {}) {
  const level = LEVELS[levelIndex] ?? LEVELS[0];
  const seed = (opts.seed ?? 1) >>> 0;
  const board = generateBoard(level, seed);

  const state = {
    level: level.index,
    scene: level.scene,
    phase: 'playing', // 'playing' | 'won' | 'lost'
    stacks: board.stacks,
    slot: [],                       // 槽内牌对象 {id,type,lockAnchor,fromStack}
    slotCap: level.slotCap,
    totalTiles: board.totalTiles,
    cleared: 0,
    moves: 0,
    maxSlot: 0,
    timeLimit: level.timeLimit,     // 秒；null = 不限时
    timeLeft: level.timeLimit,
    initialTime: level.timeLimit,
    undoLeft: level.undo,
    shuffleLeft: level.shuffle,
    propsUsed: 0,
    stars: 0,
    result: null,
  };

  const run = {
    state,
    _level: level,
    _solution: board.solution,   // 生成器内置解（栈 id 序列）
    _events: [],
    _clock: 0,
    _lastSecond: level.timeLimit,
    _milestones: new Set(),

    step(dt) {
      const s = this.state;
      if (s.phase !== 'playing') return;
      dt = Number(dt);
      if (!Number.isFinite(dt) || dt <= 0) return;
      if (dt > 1) dt = 1;
      this._clock += dt;

      if (s.timeLimit != null) {
        s.timeLeft -= dt;
        const sec = Math.ceil(s.timeLeft);
        if (sec < this._lastSecond && sec >= 0) {
          this._lastSecond = sec;
          this._emit({ type: 'countdownTick', timeLeft: sec });
        }
        if (s.timeLeft <= 0) {
          s.timeLeft = 0;
          this._lose('timeOut');
        }
      }
    },

    tapTile(stackId) {
      const s = this.state;
      if (s.phase !== 'playing') return { ok: false, reason: 'phase' };
      const st = s.stacks[stackId];
      if (!st || !st.tiles.length) return { ok: false, reason: 'empty' };
      if (!tileIsFree(s.stacks, stackId)) return { ok: false, reason: 'blocked' };
      if (s.slot.length >= s.slotCap) return { ok: false, reason: 'slotFull' };

      const tile = st.tiles.pop();
      const entry = { id: tile.id, type: tile.type, lockAnchor: tile.lockAnchor, fromStack: stackId };
      s.slot.push(entry);
      s.moves += 1;
      s.maxSlot = Math.max(s.maxSlot, s.slot.length);
      this._emit({ type: 'pick', stackId, tileType: tile.type, slotLen: s.slot.length });
      this._emit({ type: 'slotAdd', slotLen: s.slot.length, tileType: tile.type });

      // 翻开下方牌
      if (st.tiles.length) this._emit({ type: 'reveal', stackId });

      // 三同消除
      let cleared = false;
      const cnt = s.slot.filter((e) => e.type === tile.type).length;
      if (cnt >= GAME.TRIPLE_CLEAR) {
        let rm = 0;
        const ns = [];
        for (const e of s.slot) {
          if (e.type === tile.type && rm < GAME.TRIPLE_CLEAR) rm += 1;
          else ns.push(e);
        }
        s.slot = ns;
        s.cleared += GAME.TRIPLE_CLEAR;
        cleared = true;
        this._emit({ type: 'clear', tileType: tile.type, cleared: s.cleared });
        this._emit({ type: 'catReact', tileType: tile.type });
        this._emitMilestone();
      }

      // 胜负判定（槽满判负在消除之后检查）
      if (cleared && s.stacks.every((x) => x.tiles.length === 0)) {
        this._win();
      } else if (!cleared && s.slot.length >= s.slotCap) {
        this._lose('slotFull');
      } else if (s.slot.length >= s.slotCap - GAME.NEAR_FULL_THRESHOLD) {
        this._emit({ type: 'nearFull', slotLen: s.slot.length });
      }

      return { ok: true, cleared, reason: null };
    },

    undo() {
      const s = this.state;
      if (s.phase !== 'playing') return { ok: false, reason: 'phase' };
      if (s.undoLeft <= 0) return { ok: false, reason: 'noUndo' };
      if (!s.slot.length) return { ok: false, reason: 'emptySlot' };
      const entry = s.slot.pop();
      const st = s.stacks[entry.fromStack];
      st.tiles.push({ id: entry.id, type: entry.type, lockAnchor: entry.lockAnchor });
      s.undoLeft -= 1;
      s.propsUsed += 1;
      s.moves = Math.max(0, s.moves - 1);
      this._emit({ type: 'undo', stackId: entry.fromStack });
      return { ok: true };
    },

    shuffle() {
      const s = this.state;
      if (s.phase !== 'playing') return { ok: false, reason: 'phase' };
      if (s.shuffleLeft <= 0) return { ok: false, reason: 'noShuffle' };
      // 重排板上所有牌的品类（保持各品类总数不变）
      const tiles = [];
      for (const st of s.stacks) for (const t of st.tiles) tiles.push(t);
      if (tiles.length < GAME.TRIPLE_CLEAR) return { ok: false, reason: 'tooFew' };
      const types = tiles.map((t) => t.type);
      // Fisher–Yates（用注入的 rng）
      for (let i = types.length - 1; i > 0; i -= 1) {
        const j = Math.floor(this._rng() * (i + 1));
        [types[i], types[j]] = [types[j], types[i]];
      }
      for (let i = 0; i < tiles.length; i += 1) tiles[i].type = types[i];
      s.shuffleLeft -= 1;
      s.propsUsed += 1;
      this._emit({ type: 'shuffle' });
      return { ok: true };
    },

    getHud() {
      const s = this.state;
      let remaining = 0;
      for (const st of s.stacks) remaining += st.tiles.length;
      return {
        level: s.level,
        remaining,
        slotLen: s.slot.length,
        slotCap: s.slotCap,
        timeLeft: s.timeLeft,
        undoLeft: s.undoLeft,
        shuffleLeft: s.shuffleLeft,
        stars: s.stars,
        propsUsed: s.propsUsed,
      };
    },

    drainEvents() {
      const ev = this._events;
      this._events = [];
      return ev;
    },

    solution() {
      return this._solution.slice();
    },

    // ---------------- 内部 ----------------
    _emit(e) { this._events.push(e); },

    _emitMilestone() {
      const s = this.state;
      const pct = Math.round((s.cleared / s.totalTiles) * 100);
      for (const mark of [25, 50, 75]) {
        if (pct >= mark && !this._milestones.has(mark)) {
          this._milestones.add(mark);
          this._emit({ type: 'milestone', pct: mark });
        }
      }
    },

    _win() {
      const s = this.state;
      s.phase = 'won';
      const efficient = s.timeLimit != null
        ? s.timeLeft >= s.initialTime * GAME.TIME_STAR_RATIO
        : s.maxSlot <= s.slotCap - 2;
      let stars = 1;
      if (efficient) stars += 1;
      if (s.propsUsed === 0) stars += 1;
      s.stars = stars;
      s.result = { won: true, stars, remaining: 0, timeLeft: s.timeLeft, moves: s.moves };
      this._emit({ type: 'win', stars, moves: s.moves, propsUsed: s.propsUsed });
    },

    _lose(reason) {
      const s = this.state;
      s.phase = 'lost';
      s.result = { won: false, stars: 0, reason, remaining: s.totalTiles - s.cleared, timeLeft: s.timeLeft, moves: s.moves };
      this._emit({ type: 'lose', reason });
    },
  };

  // 洗牌 rng（独立于生成器，与 createRun 的 seed 绑定）
  run._rng = (() => {
    let a = (seed * 2654435761) >>> 0;
    return function next() {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  })();

  return run;
}
