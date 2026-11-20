// Tile Vault · 模拟层（纯逻辑，零 DOM/window/Date.now/canvas）
// 职责：宝库堆的拾取/三同消除/道具/重试/倒计时/结算，事件表。
// 依赖：config/levels.js（LEVELS）+ src/game/level.js（生成器/求解器）。
// 契约：docs/README.md §3。随机只用注入 seed（生成器内部），可复现。

import { LEVELS } from '../../config/levels.js';
import { generateLevel, mulberry32, solveOrder } from './level.js';

const posKey = (t) => `${t.x},${t.z},${t.y}`;

export function createRun(levelIndex = 0, opts = {}) {
  const level = LEVELS[levelIndex] ?? LEVELS[0];
  const gen = generateLevel(level);
  const seed = (opts.seed ?? 1) >>> 0;
  const rng = mulberry32(seed);

  const state = {
    level: level.index,
    phase: 'playing', // 'playing' | 'won' | 'lost'
    scene: level.scene,
    sceneName: level.name,
    types: level.types,
    trayCap: level.trayCap,
    gridX: level.grid.x,
    gridZ: level.grid.z,
    layers: level.layers,
    tiles: gen.tiles.slice(),       // 场景剩余块（含被压块）
    tray: [],                       // 底部槽（拾取顺序）
    totalTiles: gen.total,
    timeLeft: level.time,
    initialTime: level.time,
    coins: 0,
    merges: 0,
    revivesLeft: level.revives,
    items: { undo: level.items.undo, shuffle: level.items.shuffle },
    stars: 0,
    result: null,
    timed: level.timed,
    fakeLock: level.fakeLock,
    timer: level.time,
  };

  const byId = new Map(gen.tiles.map((t) => [t.id, t]));
  const posSet = new Set(gen.tiles.map(posKey));
  const layerCounts = new Map();
  for (const t of gen.tiles) layerCounts.set(t.y, (layerCounts.get(t.y) || 0) + 1);

  const run = {
    state,
    _level: level,
    _byId: byId,
    _posSet: posSet,
    _layerCounts: layerCounts,
    _events: [],
    _clock: 0,
    _lastSecond: Math.ceil(level.time),
    _shuffleRng: rng,

    // ---- 时间推进 ----
    step(dt) {
      const s = this.state;
      if (s.phase !== 'playing') return;
      dt = Number(dt);
      if (!Number.isFinite(dt) || dt <= 0) return;
      if (dt > 1) dt = 1;
      this._clock += dt;
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
    },

    // ---- 自由判定：正上方无剩余块 ----
    isFree(tile) {
      return !this._posSet.has(`${tile.x},${tile.z},${tile.y + 1}`);
    },

    // ---- 拾取 ----
    pick(id) {
      const s = this.state;
      if (s.phase !== 'playing') return { ok: false, reason: 'phase' };
      const tile = this._byId.get(id);
      if (!tile || !this._posSet.has(posKey(tile))) return { ok: false, reason: 'gone' };
      if (!this.isFree(tile)) return { ok: false, reason: 'covered' };

      const cnt = this._trayCount(tile.type);
      if (s.tray.length >= s.trayCap && cnt < 2) {
        this._lose('trayFull', tile);
        return { ok: false, reason: 'full', lost: true };
      }

      // 移出场景 → 入槽
      this._posSet.delete(posKey(tile));
      this._byId.delete(tile.id);
      s.tiles = s.tiles.filter((t) => t.id !== tile.id);
      const lc = this._layerCounts.get(tile.y) - 1;
      if (lc <= 0) this._layerCounts.delete(tile.y); else this._layerCounts.set(tile.y, lc);
      s.tray.push(tile);
      this._emit({ type: 'pick', id: tile.id, tileType: tile.type });

      // 三同消除 → 金币雨
      if (this._trayCount(tile.type) >= 3) {
        this._removeTrayType(tile.type);
        s.merges += 1;
        s.coins += 30;
        this._emit({ type: 'merge', tileType: tile.type, merges: s.merges });
        this._emit({ type: 'coinRain', tileType: tile.type, amount: 3 });
      }

      if (lc <= 0) this._emit({ type: 'layerClear', y: tile.y });

      if (s.tiles.length === 0) this._win();
      return { ok: true };
    },

    // ---- 道具：撤回最后一枚入槽的宝物 ----
    undo() {
      const s = this.state;
      if (s.phase !== 'playing') return { ok: false, reason: 'phase' };
      if (s.items.undo <= 0) return { ok: false, reason: 'noItem' };
      if (s.tray.length === 0) return { ok: false, reason: 'empty' };
      const tile = s.tray.pop();
      this._restoreToScene(tile);
      s.items.undo -= 1;
      this._emit({ type: 'undo', tileType: tile.type });
      return { ok: true };
    },

    // ---- 道具：把槽内宝物全部退回堆顶重排 ----
    shuffle() {
      const s = this.state;
      if (s.phase !== 'playing') return { ok: false, reason: 'phase' };
      if (s.items.shuffle <= 0) return { ok: false, reason: 'noItem' };
      if (s.tray.length === 0) return { ok: false, reason: 'empty' };
      const tiles = s.tray.splice(0);
      // 打乱返回顺序（视觉上「洗回牌堆」）
      for (let i = tiles.length - 1; i > 0; i -= 1) {
        const j = Math.floor(this._shuffleRng() * (i + 1));
        [tiles[i], tiles[j]] = [tiles[j], tiles[i]];
      }
      for (const tile of tiles) this._restoreToScene(tile);
      s.items.shuffle -= 1;
      this._emit({ type: 'shuffle', amount: tiles.length });
      return { ok: true };
    },

    // ---- 重试（原作 Energy 的关卡内简化版）：救回一枚 + 补时 ----
    revive() {
      const s = this.state;
      if (s.revivesLeft <= 0) return { ok: false, reason: 'noRevive' };
      if (s.tray.length > 0) {
        const tile = s.tray.pop();
        this._restoreToScene(tile);
      }
      s.revivesLeft -= 1;
      s.timeLeft = Math.min(s.initialTime, s.timeLeft + 30);
      this._lastSecond = Math.ceil(s.timeLeft);
      if (s.phase === 'lost') s.phase = 'playing';
      this._emit({ type: 'revive', revivesLeft: s.revivesLeft });
      return { ok: true };
    },

    getHud() {
      const s = this.state;
      return {
        level: s.level,
        timeLeft: s.timeLeft,
        phase: s.phase,
        coins: s.coins,
        merges: s.merges,
        tilesLeft: s.tiles.length,
        totalTiles: s.totalTiles,
        trayLen: s.tray.length,
        trayCap: s.trayCap,
        revivesLeft: s.revivesLeft,
        undo: s.items.undo,
        shuffle: s.items.shuffle,
        stars: s.stars,
      };
    },

    drainEvents() {
      const ev = this._events;
      this._events = [];
      return ev;
    },

    // ---------------- 内部 ----------------
    _emit(e) { this._events.push(e); },

    _trayCount(type) {
      let n = 0;
      for (const t of this.state.tray) if (t.type === type) n += 1;
      return n;
    },

    _removeTrayType(type) {
      const s = this.state;
      let removed = 0;
      s.tray = s.tray.filter((t) => {
        if (t.type === type && removed < 3) { removed += 1; return false; }
        return true;
      });
    },

    _restoreToScene(tile) {
      const s = this.state;
      s.tiles.push(tile);
      this._byId.set(tile.id, tile);
      this._posSet.add(posKey(tile));
      this._layerCounts.set(tile.y, (this._layerCounts.get(tile.y) || 0) + 1);
    },

    _win() {
      const s = this.state;
      s.phase = 'won';
      const ratio = s.initialTime > 0 ? s.timeLeft / s.initialTime : 0;
      const stars = 1
        + (ratio >= 0.25 ? 1 : 0)
        + (s.revivesLeft >= this._level.revives ? 1 : 0);
      s.stars = Math.min(3, stars);
      s.result = { won: true, stars: s.stars, coins: s.coins, merges: s.merges, timeLeft: s.timeLeft, revivesLeft: s.revivesLeft };
      this._emit({ type: 'win', stars: s.stars, coins: s.coins, timeLeft: s.timeLeft });
    },

    _lose(reason, tile) {
      const s = this.state;
      s.phase = 'lost';
      s.result = { won: false, stars: 0, coins: s.coins, merges: s.merges, timeLeft: s.timeLeft, reason };
      this._emit({ type: 'lose', reason, tileType: tile ? tile.type : null });
    },
  };

  run._emit({ type: 'levelStart', level: level.index });
  run._solution = solveOrder(gen.tiles, level.trayCap);
  return run;
}

export function createSim() {
  return createRun(0, { seed: 1 });
}
