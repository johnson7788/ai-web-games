// SKY STRIKE ALPHA · 模拟层（纯逻辑，零 DOM/window/Date.now/canvas）
// 职责：高度控制（hold 爬升 / 松开俯冲）、障碍生成与碰撞、核心/护盾拾取、
//       连击、跃迁充能耗尽 → 胜利、星级结算、事件表。
// 依赖：config/levels.js（LEVELS）、config/game.config.js（WORLD/GAME）。
// 随机：注入 seed 的 mulberry32，可复现。
import { LEVELS, LEVEL_COUNT } from '../../config/levels.js';
import { WORLD, GAME } from '../../config/game.config.js';

// ------------------------------------------------------------------ RNG
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp(v, lo, hi) {
  return Math.max(lo, Math.min(hi, v));
}

// ------------------------------------------------------------------ createRun
export function createRun(levelIndex = 0, opts = {}) {
  const level = LEVELS[levelIndex] ?? LEVELS[0];
  const seed = (opts.seed ?? 1) >>> 0;
  const rng = mulberry32(seed);

  const state = {
    level: level.index,
    phase: 'ready',            // 'ready' | 'playing' | 'won' | 'lost'
    player: { x: GAME.PLAYER_X, y: WORLD.HEIGHT * 0.5, vy: 0, hold: false, tilt: 0 },
    hoverY: WORLD.HEIGHT * 0.5,
    obstacles: [],
    score: 0,
    coresCollected: 0,
    coresSpawned: 0,
    combo: 1,
    bestCombo: 1,
    shieldHits: 0,
    shieldGot: 0,
    hitsTaken: 0,
    warp: GAME.WARP_MAX,
    warpMax: GAME.WARP_MAX,
    stars: 0,
    result: null,
    spawnTimer: 0.55,         // 首个障碍快速进场
    readyTimer: 0,
    gateIndex: 0,
    time: 0,
  };

  const run = {
    state,
    _level: level,
    _rng: rng,
    _events: [],
    _clock: 0,
    _nextId: 1,

    // ---- 时间推进 ----
    step(dt) {
      const s = this.state;
      if (s.phase === 'won' || s.phase === 'lost') return;
      dt = Number(dt);
      if (!Number.isFinite(dt) || dt <= 0) return;
      if (dt > 1) dt = 1;
      this._clock += dt;
      s.time += dt;

      // 开局悬停：首输入起飞，否则到点自动进入飞行
      if (s.phase === 'ready') {
        s.readyTimer += dt;
        s.player.y = s.hoverY + Math.sin(s.time * 3) * 8;
        s.player.vy = 0;
        s.player.tilt = 0;
        if (s.readyTimer >= GAME.READY_TIMEOUT) this._go();
        return;
      }

      // 高度控制
      const p = s.player;
      if (p.hold) {
        p.vy = Math.max(p.vy - GAME.THRUST * dt, GAME.VMAX_UP);
      } else {
        p.vy = Math.min(p.vy + GAME.GRAVITY * dt, GAME.VMAX_DOWN);
      }
      p.y += p.vy * dt;
      if (p.y < GAME.CEIL_Y) { p.y = GAME.CEIL_Y; p.vy = Math.max(p.vy, 0); }
      if (p.y >= WORLD.HEIGHT - GAME.PLAYER_R - 2) {
        p.y = WORLD.HEIGHT - GAME.PLAYER_R - 2;
        this._lose('crashGround');
        return;
      }
      const targetTilt = p.hold ? 1 : -0.5;
      p.tilt += (targetTilt - p.tilt) * Math.min(1, dt * 9);

      // 生成障碍
      s.spawnTimer -= dt;
      if (s.spawnTimer <= 0) {
        this._spawn();
        s.spawnTimer += level.interval;
      }

      // 跃迁充能
      s.warp = Math.max(0, s.warp - GAME.WARP_DRAIN * dt);
      if (Math.floor(s.time) !== Math.floor(s.time - dt)) {
        this._emit({ type: 'warpTick', warp: s.warp, time: Math.floor(s.time) });
      }

      // 障碍推进 + 拾取 + 碰撞
      const pr = GAME.PLAYER_R;
      for (const o of s.obstacles) {
        o.x -= o.speed * dt;
        if (o.oscAmp) {
          o.gapY = clamp(o.baseY + o.oscAmp * Math.sin(s.time * o.oscFreq + o.phase), o.minGapY, o.maxGapY);
        }

        // 核心拾取
        if (o.core && !o.core.collected) {
          const cy = o.gapY + o.core.offsetY;
          const dx = o.x - p.x;
          const dy = cy - p.y;
          const rr = pr + o.core.r;
          if (dx * dx + dy * dy < rr * rr) {
            o.core.collected = true;
            this._collectCore();
          }
        }
        // 护盾拾取
        if (o.shieldPick && !o.shieldPick.collected) {
          const cy = o.gapY;
          const dx = o.x - p.x;
          const dy = cy - p.y;
          const rr = pr + o.shieldPick.r;
          if (dx * dx + dy * dy < rr * rr) {
            o.shieldPick.collected = true;
            this._collectShield();
          }
        }

        // 已越过玩家
        if (o.x + o.halfW < p.x - pr) {
          if (!o.passed) {
            o.passed = true;
            if (o.core && !o.core.collected) {
              s.combo = 1;
              this._emit({ type: 'comboBreak', combo: s.combo });
            }
          }
          continue;
        }

        // 碰撞窗口（每个障碍只判一次）
        const withinX = (o.x - o.halfW) < (p.x + pr) && (o.x + o.halfW) > (p.x - pr);
        if (withinX && !o.checked) {
          o.checked = true;
          const safeTop = o.gapY - o.gap / 2 + pr;
          const safeBottom = o.gapY + o.gap / 2 - pr;
          if (p.y < safeTop || p.y > safeBottom) {
            this._hit(o);
            if (s.phase !== 'playing') return;
          } else {
            const edge = Math.min(Math.abs(p.y - safeTop), Math.abs(p.y - safeBottom));
            if (edge < GAME.NEAR_MISS_MARGIN) {
              s.score += 5;
              this._emit({ type: 'nearMiss', score: s.score });
            }
          }
        }
      }

      // 清理离开屏幕 / 已被护盾摧毁的障碍
      s.obstacles = s.obstacles.filter((o) => !o.removed && o.x + o.halfW > -80);

      if (s.warp <= 0) this._win();
    },

    // ---- 输入：hold 上升 / 松开俯冲（changed 供遥测计数用） ----
    setHold(v) {
      const s = this.state;
      const hold = !!v;
      const changed = hold !== s.player.hold;
      s.player.hold = hold;
      if (s.phase === 'ready' && hold) this._go();
      return { ok: true, hold, changed };
    },

    getHud() {
      const s = this.state;
      return {
        level: s.level,
        phase: s.phase,
        score: s.score,
        cores: s.coresCollected,
        coresSpawned: s.coresSpawned,
        combo: s.combo,
        warp: s.warp,
        warpMax: s.warpMax,
        shieldHits: s.shieldHits,
        stars: s.stars,
        gates: s.gateIndex,
      };
    },

    drainEvents() {
      const ev = this._events;
      this._events = [];
      return ev;
    },

    // ---------------- 内部 ----------------
    _emit(e) { this._events.push(e); },

    _go() {
      const s = this.state;
      if (s.phase !== 'ready') return;
      s.phase = 'playing';
      s.readyTimer = 0;
      this._emit({ type: 'start' });
    },

    _spawn() {
      const s = this.state;
      const lv = this._level;
      s.gateIndex += 1;
      const isRock = lv.rockP > 0 && this._rng() < lv.rockP;
      const kind = isRock ? 'rock' : 'gate';
      const gap = lv.gap;
      const minGapY = GAME.CEIL_Y + gap / 2 + 30;
      const maxGapY = WORLD.HEIGHT - gap / 2 - 30;
      const baseY = minGapY + this._rng() * (maxGapY - minGapY);
      const hasShield = lv.shieldEvery > 0 && (s.gateIndex % lv.shieldEvery === 0);
      const obs = {
        id: this._nextId++,
        kind,
        x: WORLD.WIDTH + 70,
        halfW: isRock ? 30 : 22,
        speed: isRock ? lv.scroll * 1.3 : lv.scroll,
        gap,
        baseY,
        gapY: baseY,
        minGapY,
        maxGapY,
        oscAmp: lv.oscAmp,
        oscFreq: lv.oscFreq,
        phase: this._rng() * Math.PI * 2,
        passed: false,
        checked: false,
        removed: false,
        core: null,
        shieldPick: null,
      };
      if (hasShield) {
        obs.shieldPick = { r: 14, collected: false };
        this._emit({ type: 'shield', x: obs.x, y: obs.gapY });
      } else {
        const off = (this._rng() * 2 - 1) * gap * 0.2;
        obs.core = { r: 11, offsetY: off, collected: false };
        s.coresSpawned += 1;
        this._emit({ type: 'core', x: obs.x, y: obs.gapY + off });
      }
      s.obstacles.push(obs);
      this._emit({ type: 'spawn', kind, x: obs.x, gapY: obs.gapY });
    },

    _collectCore() {
      const s = this.state;
      s.coresCollected += 1;
      s.score += GAME.CORE_SCORE * s.combo;
      s.combo = Math.min(s.combo + 1, GAME.COMBO_MAX);
      s.bestCombo = Math.max(s.bestCombo, s.combo);
      this._emit({ type: 'score', score: s.score, combo: s.combo, cores: s.coresCollected });
      if (s.combo >= 2) this._emit({ type: 'combo', combo: s.combo });
    },

    _collectShield() {
      const s = this.state;
      s.shieldHits = Math.min(s.shieldHits + GAME.SHIELD_HITS, 2);
      s.shieldGot += 1;
      this._emit({ type: 'shieldGot', shieldHits: s.shieldHits });
    },

    _hit(o) {
      const s = this.state;
      if (s.shieldHits > 0) {
        s.shieldHits -= 1;
        s.hitsTaken += 1;
        o.removed = true;
        this._emit({ type: 'shieldBlock', shieldHits: s.shieldHits });
        return;
      }
      s.hitsTaken += 1;
      this._lose(o.kind === 'rock' ? 'crashRock' : 'crashWall');
    },

    _win() {
      const s = this.state;
      s.phase = 'won';
      const coreRatio = s.coresSpawned > 0 ? s.coresCollected / s.coresSpawned : 1;
      let stars = 1 + (coreRatio >= GAME.STAR_CORE_RATIO ? 1 : 0) + (s.hitsTaken === 0 ? 1 : 0);
      s.stars = Math.min(3, stars);
      s.result = {
        won: true, stars: s.stars, score: s.score,
        coresCollected: s.coresCollected, coresSpawned: s.coresSpawned,
        hitsTaken: s.hitsTaken, bestCombo: s.bestCombo,
      };
      this._emit({ type: 'win', stars: s.stars, score: s.score, cores: s.coresCollected });
    },

    _lose(reason) {
      const s = this.state;
      s.phase = 'lost';
      s.result = {
        won: false, reason, stars: 0, score: s.score,
        coresCollected: s.coresCollected, coresSpawned: s.coresSpawned,
        hitsTaken: s.hitsTaken, bestCombo: s.bestCombo,
      };
      this._emit({ type: 'lose', reason, score: s.score, cores: s.coresCollected });
    },
  };

  return run;
}

// ------------------------------------------------------------------ 兼容骨架别名
export function createSim() {
  return createRun(0, { seed: 1 });
}

export function updateSim(sim, input) {
  if (input && typeof input.hold === 'boolean') sim.setHold(input.hold);
  sim.step(1 / 60);
  return sim;
}

export { LEVEL_COUNT };
