// MY PLANET GROW · 模拟层（纯逻辑，零 DOM/window/Date.now/canvas）
// 玩法：拖动星球吞噬下落的流星增长质量与分数，躲开会追踪你的黑洞。
// 事件表：meteor / gold / shield / combo / comboEnd / tierUp / hit / absorb / gameover / spawn。
// 随机：注入 seed 的 mulberry32，可复现。
import { WORLD, GAME } from '../../config/game.config.js';

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
  return v < lo ? lo : v > hi ? hi : v;
}

export function createRun(seed = 1) {
  const rng = mulberry32((seed == null ? 1 : seed) >>> 0);

  const state = {
    phase: 'playing',        // 'playing' | 'over'
    time: 0,
    planet: {
      x: WORLD.WIDTH / 2,
      y: WORLD.HEIGHT - 200,
      r: GAME.PLANET_R0,
      mass: 0,
      tier: 0,
    },
    hp: GAME.HP_MAX,
    shields: 0,
    score: 0,
    combo: 0,                // 当前连击数（0=未连击）
    comboMult: 1,            // 当前倍率
    comboTimer: 0,           // 连击窗口剩余
    comboBest: 0,
    invuln: 0,               // 撞击后无敌帧（秒）
    meteorTimer: 0.5,        // 首次流星尽快出现
    holeTimer: GAME.HOLE_INTERVAL_START,
    shieldTimer: GAME.SHIELD_INTERVAL,
    stars: 0,
    result: null,
    entities: [],            // {type, x, y, vx, vy, r, value, sway, swayT, spin}
    totalMeteors: 0,
  };

  const run = {
    state,
    _rng: rng,
    _events: [],

    // ---- 时间推进 ----
    step(dt) {
      const s = this.state;
      if (s.phase === 'over') return;
      dt = Number(dt);
      if (!Number.isFinite(dt) || dt <= 0) return;
      if (dt > 1) dt = 1;

      s.time += dt;
      if (s.invuln > 0) s.invuln = Math.max(0, s.invuln - dt);

      // 连击窗口
      if (s.combo > 0) {
        s.comboTimer -= dt;
        if (s.comboTimer <= 0) {
          s.combo = 0;
          s.comboMult = 1;
          this._emit({ type: 'comboEnd' });
        }
      }

      // 生成
      const meteorInterval = Math.max(GAME.METEOR_INTERVAL_MIN, GAME.METEOR_INTERVAL_START - s.time * GAME.METEOR_RAMP);
      const holeInterval = Math.max(GAME.HOLE_INTERVAL_MIN, GAME.HOLE_INTERVAL_START - s.time * GAME.HOLE_RAMP);

      s.meteorTimer -= dt;
      if (s.meteorTimer <= 0) {
        this._spawnMeteor();
        s.meteorTimer = meteorInterval * (0.75 + this._rng() * 0.5);
      }

      s.holeTimer -= dt;
      if (s.holeTimer <= 0) {
        this._spawnHole();
        s.holeTimer = holeInterval * (0.8 + this._rng() * 0.4);
      }

      if (s.time >= GAME.SHIELD_AFTER) {
        s.shieldTimer -= dt;
        if (s.shieldTimer <= 0) {
          this._spawnShield();
          s.shieldTimer = GAME.SHIELD_INTERVAL;
        }
      }

      // 移动实体
      const fall = GAME.METEOR_FALL + s.time * GAME.METEOR_FALL_RAMP;
      const holeFall = GAME.HOLE_FALL + s.time * GAME.HOLE_FALL_RAMP;
      for (let i = s.entities.length - 1; i >= 0; i -= 1) {
        const e = s.entities[i];
        if (e.type === 'hole') {
          // 黑洞：下落 + 横向追踪星球
          e.vy = holeFall;
          const dx = s.planet.x - e.x;
          e.vx = clamp(e.vx + clamp(dx, -GAME.HOLE_HOME, GAME.HOLE_HOME) * dt, -GAME.HOLE_HOME, GAME.HOLE_HOME);
          e.y += e.vy * dt;
          e.x += e.vx * dt;
        } else {
          // 流星/黄金/护盾：下落 + 轻微横向漂移（正弦摆动）
          e.swayT += dt;
          e.y += e.vy * dt;
          e.x += Math.sin(e.swayT * e.sway) * 26 * dt;
        }
        e.spin += dt;

        if (e.y > WORLD.HEIGHT + 60 || e.x < -80 || e.x > WORLD.WIDTH + 80) {
          s.entities.splice(i, 1);
          continue;
        }
      }

      // 碰撞
      const p = s.planet;
      for (let i = s.entities.length - 1; i >= 0; i -= 1) {
        const e = s.entities[i];
        const dx = e.x - p.x;
        const dy = e.y - p.y;
        const rr = p.r + e.r;
        if (dx * dx + dy * dy > rr * rr) continue;

        if (e.type === 'hole') {
          if (s.invuln > 0) continue; // 无敌帧内黑洞擦过
          s.entities.splice(i, 1);
          if (s.shields > 0) {
            s.shields -= 1;
            s.invuln = 1.0;
            this._emit({ type: 'absorb', shields: s.shields });
          } else {
            s.hp -= 1;
            s.invuln = 1.2;
            this._emit({ type: 'hit', hp: s.hp });
            if (s.hp <= 0) {
              this._endGame();
              break;
            }
          }
        } else {
          // 可收集物
          s.entities.splice(i, 1);
          const value = e.value || 1;
          const base = e.type === 'gold' ? GAME.SCORE_GOLD : GAME.SCORE_METEOR;
          s.planet.mass += value;
          s.totalMeteors += 1;

          // 连击
          if (s.combo > 0 && s.comboTimer > 0) {
            s.combo = Math.min(GAME.COMBO_MAX, s.combo + 1);
          } else {
            s.combo = 1;
          }
          s.comboTimer = GAME.COMBO_WINDOW;
          s.comboMult = s.combo;
          s.comboBest = Math.max(s.comboBest, s.combo);
          const gain = base * s.comboMult;
          s.score += gain;

          if (e.type === 'shield') {
            s.shields = Math.min(GAME.SHIELD_MAX, s.shields + 1);
            this._emit({ type: 'shield', shields: s.shields, x: e.x, y: e.y });
          } else if (e.type === 'gold') {
            this._emit({ type: 'gold', value, gain, combo: s.combo, x: e.x, y: e.y });
            this._emit({ type: 'combo', combo: s.combo, mult: s.comboMult });
          } else {
            this._emit({ type: 'meteor', value, gain, combo: s.combo, x: e.x, y: e.y });
            this._emit({ type: 'combo', combo: s.combo, mult: s.comboMult });
          }

          this._applyTier();
        }
      }
    },

    // ---- 输入：移动星球（钳制在安全区内）----
    movePlanetTo(x, y) {
      const s = this.state;
      if (s.phase === 'over') return { ok: false, moved: false, reason: 'over' };
      const p = s.planet;
      const nx = clamp(x, p.r, WORLD.WIDTH - p.r);
      const ny = clamp(y, GAME.SAFE_TOP + p.r, WORLD.HEIGHT - GAME.SAFE_BOTTOM - p.r);
      const moved = Math.abs(nx - p.x) > 0.4 || Math.abs(ny - p.y) > 0.4;
      p.x = nx;
      p.y = ny;
      if (moved) this._emit({ type: 'move', x: nx, y: ny });
      return { ok: true, moved };
    },

    movePlanet(dx, dy) {
      const s = this.state;
      return this.movePlanetTo(s.planet.x + dx, s.planet.y + dy);
    },

    // ---- 调试/测试：直接注入实体 ----
    spawnEntity(type, x, y) {
      const s = this.state;
      const e = { type, x, y, vx: 0, vy: GAME.METEOR_FALL, r: 12, value: 1, sway: 2, swayT: this._rng() * 6, spin: 0 };
      if (type === 'hole') { e.r = 16; e.vy = GAME.HOLE_FALL; }
      else if (type === 'gold') { e.r = 14; e.value = GAME.MASS_GOLD; }
      else if (type === 'shield') { e.r = 15; e.value = 0; }
      s.entities.push(e);
      return e;
    },

    // ---- 强制结束（调试/验收用）----
    endRun() {
      if (this.state.phase !== 'over') this._endGame();
      return this.state.result;
    },

    getHud() {
      const s = this.state;
      return {
        phase: s.phase,
        time: s.time,
        score: s.score,
        mass: s.planet.mass,
        hp: s.hp,
        shields: s.shields,
        combo: s.combo,
        comboMult: s.comboMult,
        tier: s.planet.tier,
        tierRadius: s.planet.r,
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

    _spawnMeteor(y = GAME.SPAWN_TOP) {
      const s = this.state;
      const isGold = this._rng() < GAME.GOLD_CHANCE;
      const type = isGold ? 'gold' : 'meteor';
      const r = isGold ? 14 + this._rng() * 3 : 12 + this._rng() * 6;
      const x = 30 + this._rng() * (WORLD.WIDTH - 60);
      s.entities.push({
        type,
        x,
        y,
        vx: 0,
        vy: GAME.METEOR_FALL + s.time * GAME.METEOR_FALL_RAMP,
        r,
        value: isGold ? GAME.MASS_GOLD : GAME.MASS_METEOR,
        sway: 1.5 + this._rng() * 2,
        swayT: this._rng() * 6,
        spin: this._rng() * 6,
      });
      this._emit({ type: 'spawn', kind: type });
    },

    _spawnHole() {
      const s = this.state;
      const r = 14 + this._rng() * 7;
      const x = 40 + this._rng() * (WORLD.WIDTH - 80);
      s.entities.push({
        type: 'hole',
        x,
        y: GAME.SPAWN_TOP,
        vx: (this._rng() - 0.5) * 40,
        vy: GAME.HOLE_FALL,
        r,
        value: 0,
        sway: 0,
        swayT: 0,
        spin: this._rng() * 6,
      });
      this._emit({ type: 'spawn', kind: 'hole' });
    },

    _spawnShield() {
      const s = this.state;
      const x = 60 + this._rng() * (WORLD.WIDTH - 120);
      s.entities.push({
        type: 'shield',
        x,
        y: GAME.SPAWN_TOP,
        vx: 0,
        vy: GAME.METEOR_FALL + s.time * GAME.METEOR_FALL_RAMP,
        r: 15,
        value: 0,
        sway: 2,
        swayT: this._rng() * 6,
        spin: this._rng() * 6,
      });
      this._emit({ type: 'spawn', kind: 'shield' });
    },

    _applyTier() {
      const s = this.state;
      const p = s.planet;
      let tier = 0;
      for (let i = 0; i < GAME.TIER_MASS.length; i += 1) {
        if (s.planet.mass >= GAME.TIER_MASS[i]) tier = i;
      }
      if (tier !== p.tier) {
        p.tier = tier;
        p.r = GAME.TIER_RADIUS[tier];
        if (s.shields < GAME.SHIELD_MAX) s.shields += 1; // 进化奖励 1 护盾
        this._emit({ type: 'tierUp', tier, radius: p.r, shields: s.shields });
      }
    },

    _endGame() {
      const s = this.state;
      if (s.phase === 'over') return;
      s.phase = 'over';
      const score = s.score;
      let stars = 0;
      if (score >= GAME.STAR_2) stars = score >= GAME.STAR_3 ? 3 : 2;
      else if (score > 0) stars = 1;
      s.stars = stars;
      s.result = {
        won: false,
        stars,
        score,
        mass: s.planet.mass,
        tier: s.planet.tier,
        time: s.time,
        best: 0,
      };
      this._emit({ type: 'gameover', score, stars, mass: s.planet.mass, tier: s.planet.tier });
    },
  };

  // 开局铺一批可见流星，避免空场（目标可读性 / goal_visible）
  for (let i = 0; i < 4; i += 1) {
    run._spawnMeteor(110 + i * 95);
  }

  return run;
}
