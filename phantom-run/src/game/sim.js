// PHANTOM RUN · 模拟层（纯逻辑，零 DOM/window/localStorage/Date.now/canvas）
// 职责：自动跑酷物理（重力/跳跃/落地）、符文砖切换、月光斑现身、符文墙/尖刺/塌陷檐/移动吊篮、
//       幽灵火追兵、拾取、胜负判定、事件表。
// 依赖：config/levels.js、config/game.config.js。
// 随机：本作跑酷完全确定性（移动平台用固定相位正弦），不依赖 Math.random；保留 seed 仅供复现占位。

import { WORLD, PHYSICS, PLAYER, GAME, STEP } from '../../config/game.config.js';
import { LEVELS, LEVEL_COUNT } from '../../config/levels.js';

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function isSolid(pl) {
  if (pl.kind === 'ground') return true;
  if (pl.kind === 'moving') return true;
  // rune / collapse：只有 state==='solid' 才有实体
  return pl.state === 'solid';
}

export function createRun(levelIndex = 0, opts = {}) {
  const level = LEVELS[levelIndex] ?? LEVELS[0];
  const seed = (opts.seed ?? 1) >>> 0;
  const rng = mulberry32(seed);

  const platforms = level.platforms.map((p, i) => ({
    id: i,
    name: p.name || null,
    link: p.link || null,
    x: p.x,
    y: p.y,
    w: p.w,
    h: p.h,
    kind: p.kind || 'ground',
    state: p.kind === 'rune' || p.kind === 'collapse' ? (p.state || 'solid') : 'solid',
    baseY: p.y,
    baseX: p.x,
    amp: p.amp || 0,
    omega: p.omega || 0,
    phase: p.phase || 0,
    revertSec: p.revertSec || GAME.RUNE_REVERT_SEC,
    phantomT: 0,
    collapseT: 0,
    nearMissed: false,
  }));
  const walls = (level.walls || []).map((w, i) => ({ id: i, ...w, passed: false }));
  const spikes = (level.spikes || []).map((s, i) => ({ id: i, ...s, nearMissed: false }));
  const moons = (level.moons || []).map((m, i) => ({ id: i, ...m, taken: false }));
  const stars = (level.stars || []).map((st, i) => ({ id: i, ...st, taken: false }));

  const START_X = 60;
  const state = {
    level: level.index,
    scene: level.scene,
    phase: 'running',          // running | won | lost
    player: {
      x: START_X,
      y: WORLD.GROUND_Y - PLAYER.H,
      vx: level.speed || PHYSICS.BASE_SPEED,
      vy: 0,
      onGround: true,
      standOn: null,
      form: 'phantom',          // phantom | corporeal
      corporealT: 0,
      coyote: 0,
      jumpBufferT: 0,
    },
    platforms,
    walls,
    spikes,
    moons,
    stars,
    finishX: level.finishX,
    chase: level.chase ? { x: START_X - GAME.CHASE_GAP, speed: level.chase.speed, started: false } : null,
    distance: 0,
    time: 0,
    starsGot: 0,
    starsTotal: stars.length,
    moonsGot: 0,
    moonsTotal: moons.length,
    runeToggles: 0,
    result: null,
  };

  const run = {
    state,
    _rng: rng,
    _events: [],
    _prevBottom: state.player.y + PLAYER.H,

    step(input = {}) {
      const s = this.state;
      if (s.phase !== 'running') return;
      const dt = STEP;
      const p = s.player;
      const jump = !!input.jump;

      s.time += dt;
      s.distance = Math.max(s.distance, p.x);

      // --- 输入缓冲 / 土狼时间 ---
      if (jump) p.jumpBufferT = GAME.JUMP_BUFFER_SEC;
      else if (p.jumpBufferT > 0) p.jumpBufferT -= dt;
      if (p.onGround) p.coyote = GAME.COYOTE_SEC;
      else if (p.coyote > 0) p.coyote -= dt;

      if (p.jumpBufferT > 0 && (p.onGround || p.coyote > 0)) {
        p.vy = PHYSICS.JUMP_VEL;
        p.onGround = false;
        p.standOn = null;
        p.coyote = 0;
        p.jumpBufferT = 0;
        this._emit({ type: 'jump', x: p.x, y: p.y });
      }

      // --- 重力 + 积分 ---
      p.vy = Math.min(PHYSICS.MAX_FALL, p.vy + PHYSICS.GRAVITY * dt);
      this._prevBottom = p.y + PLAYER.H;
      p.x += p.vx * dt;
      p.y += p.vy * dt;

      // --- 移动吊篮（竖直正弦），携带站在上面的玩家 ---
      this._stepMoving(dt);

      // --- 平台落地 / 符文切换 / 塌陷 ---
      this._resolvePlatforms();

      // --- 尖刺 / 符文墙 / 掉坑 / 追兵 ---
      this._resolveHazards();

      // --- 月光斑 / 星屑拾取 ---
      this._collectPickups();

      // --- 现身计时 ---
      if (p.form === 'corporeal') {
        p.corporealT -= dt;
        if (p.corporealT <= 0) {
          p.form = 'phantom';
          p.corporealT = 0;
          this._emit({ type: 'corporealEnd' });
        }
      }

      // --- 追兵推进 ---
      this._stepChase(dt);

      // --- 终点 ---
      if (s.phase === 'running' && p.x >= s.finishX) this._win();
    },

    getHud() {
      const s = this.state;
      return {
        level: s.level,
        phase: s.phase,
        distance: s.distance,
        time: s.time,
        starsGot: s.starsGot,
        starsTotal: s.starsTotal,
        moonsGot: s.moonsGot,
        moonsTotal: s.moonsTotal,
        form: s.player.form,
        corporealT: s.player.corporealT,
        speed: s.player.vx,
      };
    },

    drainEvents() {
      const ev = this._events;
      this._events = [];
      return ev;
    },

    // ---------------- 内部 ----------------
    _emit(e) { this._events.push(e); },

    _isSolid(pl) { return isSolid(pl); },

    _stepMoving(dt) {
      const s = this.state;
      const p = s.player;
      for (const pl of s.platforms) {
        if (pl.kind !== 'moving') continue;
        const newY = pl.baseY + Math.sin(s.time * pl.omega + pl.phase) * pl.amp;
        const dy = newY - pl.y;
        pl.y = newY;
        if (p.standOn === pl.id && p.onGround) {
          p.y += dy;
        }
      }
    },

    _resolvePlatforms() {
      const s = this.state;
      const p = s.player;
      const W = PLAYER.W;
      const H = PLAYER.H;
      p.onGround = false;
      p.standOn = null;

      let best = null;
      for (const pl of s.platforms) {
        if (!this._isSolid(pl)) continue;
        if (p.x + W <= pl.x || p.x >= pl.x + pl.w) continue;
        const feet = p.y + H;
        // 从上方落下并穿透平台顶面
        if (feet >= pl.y && this._prevBottom <= pl.y + 2 && p.vy >= -1) {
          if (best == null || pl.y < best.y) best = pl;
        }
      }

      if (best) {
        p.y = best.y - H;
        p.vy = 0;
        p.onGround = true;
        p.coyote = GAME.COYOTE_SEC;
        p.standOn = best.id;
        this._emit({ type: 'land', x: p.x, y: p.y, kind: best.kind });

        if (best.kind === 'rune') this._toggleRune(best);
        else if (best.kind === 'collapse' && best.state === 'solid') {
          best.collapseT = GAME.COLLAPSE_SEC;
          this._emit({ type: 'collapseWarn', x: best.x, y: best.y });
        }
      }
    },

    _toggleRune(pl) {
      const s = this.state;
      // 自身：solid → phantom（落空），revertSec 后恢复 solid
      pl.state = 'phantom';
      pl.phantomT = pl.revertSec;
      s.runeToggles += 1;
      this._emit({ type: 'runeToggle', x: pl.x, y: pl.y, state: 'phantom', id: pl.id });
      // 双符文互锁（一虚一实，须踩序）：踩这块使其虚化，联动对象转为实体
      if (pl.link != null) {
        const other = typeof pl.link === 'number'
          ? s.platforms[pl.link]
          : s.platforms.find((o) => o.name === pl.link);
        if (other && other.kind === 'rune') {
          other.state = 'solid';
          other.phantomT = 0;
          this._emit({ type: 'runeToggle', x: other.x, y: other.y, state: 'solid', id: other.id });
        }
      }
    },

    _resolveHazards() {
      const s = this.state;
      const p = s.player;
      const W = PLAYER.W;
      const H = PLAYER.H;
      const px0 = p.x;
      const px1 = p.x + W;
      const py0 = p.y;
      const py1 = p.y + H;

      // 掉坑
      if (py1 > WORLD.FLOOR_Y) { this._lose('pit'); return; }

      // 尖刺（任何形态都会判负）
      for (const sp of s.spikes) {
        if (px1 <= sp.x || px0 >= sp.x + sp.w) continue;
        if (py1 >= sp.y) { this._lose('spike'); return; }
        // 近距离跳过尖刺 → nearMiss
        if (!sp.nearMissed && py1 < sp.y && sp.y - py1 < 36) {
          sp.nearMissed = true;
          this._emit({ type: 'nearMiss', x: sp.x, y: sp.y });
        }
      }

      // 符文墙：现身可穿，虚影撞墙判负
      for (const w of s.walls) {
        if (px1 <= w.x || px0 >= w.x + w.w) continue;
        if (py1 <= w.y || py0 >= w.y + w.h) continue;
        if (p.form === 'corporeal') {
          if (!w.passed) { w.passed = true; this._emit({ type: 'phaseThrough', x: w.x, y: w.y }); }
        } else {
          this._lose('wallHit');
          return;
        }
      }

      // 塌陷檐计时：0.8s 后落空
      for (const pl of s.platforms) {
        if (pl.kind === 'collapse' && pl.state === 'solid' && pl.collapseT > 0) {
          pl.collapseT -= STEP;
          if (pl.collapseT <= 0) {
            pl.state = 'phantom';
            this._emit({ type: 'collapse', x: pl.x, y: pl.y });
          }
        }
        // 符文砖恢复实体
        if (pl.kind === 'rune' && pl.state === 'phantom' && pl.phantomT > 0) {
          pl.phantomT -= STEP;
          if (pl.phantomT <= 0) {
            pl.state = 'solid';
            this._emit({ type: 'runeRevert', x: pl.x, y: pl.y, id: pl.id });
          }
        }
      }
    },

    _collectPickups() {
      const s = this.state;
      const p = s.player;
      const cx = p.x + PLAYER.W / 2;
      const cy = p.y + PLAYER.H / 2;

      for (const m of s.moons) {
        if (m.taken) continue;
        if (Math.hypot(cx - m.x, cy - m.y) <= m.r + 26) {
          m.taken = true;
          s.moonsGot += 1;
          p.form = 'corporeal';
          p.corporealT = GAME.CORPOREAL_SEC;
          this._emit({ type: 'moonPickup', x: m.x, y: m.y });
          this._emit({ type: 'corporealStart' });
        }
      }
      for (const st of s.stars) {
        if (st.taken) continue;
        if (Math.hypot(cx - st.x, cy - st.y) <= st.r + 22) {
          st.taken = true;
          s.starsGot += 1;
          this._emit({ type: 'starPickup', x: st.x, y: st.y, starsGot: s.starsGot });
        }
      }
    },

    _stepChase(dt) {
      const s = this.state;
      if (!s.chase) return;
      if (!s.chase.started) {
        s.chase.started = true;
        this._emit({ type: 'chaseStart' });
      }
      s.chase.x += s.chase.speed * dt;
      if (s.chase.x >= s.player.x - 8) this._lose('caught');
    },

    _win() {
      const s = this.state;
      s.phase = 'won';
      const stars = Math.min(3, 1 + (s.starsGot >= s.starsTotal ? 1 : 0) + (s.moonsGot >= s.moonsTotal ? 1 : 0));
      s.result = {
        won: true,
        stars,
        starsGot: s.starsGot,
        starsTotal: s.starsTotal,
        moonsGot: s.moonsGot,
        moonsTotal: s.moonsTotal,
        distance: s.distance,
        time: s.time,
      };
      this._emit({ type: 'win', stars, starsGot: s.starsGot, moonsGot: s.moonsGot });
    },

    _lose(reason) {
      const s = this.state;
      if (s.phase !== 'running') return;
      s.phase = 'lost';
      s.result = {
        won: false,
        stars: 0,
        starsGot: s.starsGot,
        moonsGot: s.moonsGot,
        distance: s.distance,
        time: s.time,
        reason,
      };
      this._emit({ type: 'lose', reason });
    },
  };

  run._emit({ type: 'runStart', level: state.level });
  return run;
}

// 兼容骨架别名
export function createSim() {
  return createRun(0, { seed: 1 });
}

export { LEVEL_COUNT };
