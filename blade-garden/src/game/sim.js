// BLADE GARDEN · 模拟层（纯逻辑，零 DOM/window/Date.now/canvas）
// 玩法：虚拟摇杆/WASD 走位 + 自动挥剑攻击最近敌人 + 击杀掉修为(拾取升级三选一剑意)
//       + 波次变强 + HP 归零结算（时长+击杀数）。
// 依赖：config/levels.js、config/enemies.js、config/upgrades.js、config/game.config.js。
// 随机：注入 seed 的 mulberry32，可复现。契约：createRun(levelIndex, {seed}) → run。
// run API：step(dt, input) / setInput(dx,dy) / chooseUpgrade(id) / getHud() / drainEvents()。

import { LEVELS } from '../../config/levels.js';
import { ENEMIES } from '../../config/enemies.js';
import { UPGRADE_MAP } from '../../config/upgrades.js';
import { GAME, WORLD } from '../../config/game.config.js';

const W = WORLD.WIDTH;
const H = WORLD.HEIGHT;
const PLAY_X0 = 44, PLAY_X1 = W - 44, PLAY_Y0 = 64, PLAY_Y1 = H - 24;

const RULE_IDS = ['leafDart', 'whirlSlash', 'thunderBamboo', 'rootTangle', 'thousandBamboo'];

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

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const dist2 = (ax, ay, bx, by) => { const dx = ax - bx, dy = ay - by; return dx * dx + dy * dy; };

// 把圆形实体推出墙外（简单轴对齐矩形碰撞）
function pushOutWalls(x, y, r, walls) {
  let ox = x, oy = y;
  for (const wl of walls || []) {
    const cx = clamp(ox, wl.x, wl.x + wl.w);
    const cy = clamp(oy, wl.y, wl.y + wl.h);
    let dx = ox - cx, dy = oy - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 < r * r) {
      if (d2 < 1e-6) {
        // 圆心在墙内：沿最小穿透轴推出
        const left = ox - wl.x, right = wl.x + wl.w - ox;
        const top = oy - wl.y, bot = wl.y + wl.h - oy;
        const m = Math.min(left, right, top, bot);
        if (m === left) ox = wl.x - r;
        else if (m === right) ox = wl.x + wl.w + r;
        else if (m === top) oy = wl.y - r;
        else oy = wl.y + wl.h + r;
      } else {
        const d = Math.sqrt(d2);
        ox = cx + (dx / d) * r;
        oy = cy + (dy / d) * r;
      }
    }
  }
  return { x: ox, y: oy };
}

// ------------------------------------------------------------------ createRun
export function createRun(levelIndex = 0, opts = {}) {
  const level = LEVELS[levelIndex] ?? LEVELS[0];
  const seed = (opts.seed ?? 1) >>> 0;
  const rng = mulberry32(seed);
  const P = GAME.PLAYER;
  const M = GAME.MELEE;

  const state = {
    level: level.index,
    levelIndex,
    sceneKey: level.scene,
    phase: 'playing',            // playing | upgrade | won | lost
    time: 0,
    timeLeft: level.duration,
    kills: 0,
    killTarget: level.killTarget,
    gold: 0,
    wave: 0,
    spawnTimer: 0,
    eliteSpawned: false,
    bossSpawned: false,
    contactTimer: 0,
    hazards: level.hazards || [],
    walls: level.walls || [],
    narrow: !!level.narrow,
    result: null,
    choices: [],                 // 当前三选一（id 数组）
    signature: false,
    player: {
      x: W / 2, y: H / 2,
      hp: P.MAX_HP, maxHp: P.MAX_HP,
      speed: P.SPEED,
      regenPerSec: P.REGEN_PER_SEC,
      regenDelay: P.REGEN_DELAY,
      regenTimer: 0,
      pickupRadius: P.PICKUP_RADIUS,
      magnetRadius: P.MAGNET_RADIUS,
      strikeInterval: M.STRIKE_INTERVAL,
      strikeTimer: 0,
      meleeRange: M.RANGE,
      meleeDamage: M.DAMAGE,
      level: 0,
      xp: 0,
      requiredXP: GAME.XP_CURVE.slice(),
      xpToNext: GAME.XP_CURVE[0],
      abilities: { leafDart: 0, whirlSlash: 0, thunderBamboo: 0, rootTangle: 0, thousandBamboo: 0 },
      dartTimer: 0, whirlTimer: 0, thunderTimer: 0,
    },
    enemies: [],
    projectiles: [],
    enemyProjectiles: [],
    gems: [],
  };

  let nextId = 1;

  const run = {
    state,
    _level: level,
    _rng: rng,
    _events: [],
    _input: { dx: 0, dy: 0 },

    // ---- 输入（返回 ok 供遥测计动作） ----
    setInput(dx, dy) {
      const len = Math.hypot(dx, dy);
      if (len > 1) { dx /= len; dy /= len; }
      this._input.dx = dx || 0;
      this._input.dy = dy || 0;
      return { ok: true };
    },

    // ---- 时间推进 ----
    step(dt, input) {
      if (input) this.setInput(input.dx, input.dy);
      const s = this.state;
      if (s.phase !== 'playing') return;
      let remaining = Math.max(0, Number(dt) || 0);
      while (remaining > 0) {
        const d = Math.min(remaining, 1 / 60);
        remaining -= d;
        this._tick(d);
        if (s.phase !== 'playing') break;
      }
    },

    // ---- 选择升级（phase==='upgrade' 时调用） ----
    chooseUpgrade(id) {
      const s = this.state;
      if (s.phase !== 'upgrade') return { ok: false, reason: 'phase' };
      if (!s.choices.includes(id)) return { ok: false, reason: 'notOffered' };
      this._applyUpgrade(id);
      s.choices = [];
      s.phase = 'playing';
      this._emit({ type: 'upgrade', id });
      this._recomputeSignature();
      return { ok: true, id };
    },

    getHud() {
      const s = this.state, p = s.player;
      return {
        level: s.level, timeLeft: s.timeLeft, kills: s.kills, killTarget: s.killTarget,
        hp: p.hp, maxHp: p.maxHp, xp: p.xp, xpToNext: p.xpToNext, playerLevel: p.level,
        phase: s.phase, wave: s.wave, gold: s.gold,
      };
    },

    drainEvents() {
      const ev = this._events;
      this._events = [];
      return ev;
    },

    // ---------------- 内部 ----------------
    _emit(e) { this._events.push(e); },

    _tick(dt) {
      const s = this.state;
      const p = s.player;
      s.time += dt;
      s.timeLeft -= dt;

      // 移动
      const { dx, dy } = this._input;
      if (dx || dy) {
        let spd = p.speed;
        if (this._inHazard(p.x, p.y)) spd *= 0.55;
        p.x += dx * spd * dt;
        p.y += dy * spd * dt;
        this._emit({ type: 'move', x: p.x, y: p.y });
      }
      p.x = clamp(p.x, PLAY_X0, PLAY_X1);
      p.y = clamp(p.y, PLAY_Y0, PLAY_Y1);
      const pushed = pushOutWalls(p.x, p.y, GAME.PLAYER_RADIUS, s.walls);
      p.x = pushed.x; p.y = pushed.y;

      // 回血（脱战后）
      p.regenTimer += dt;
      if (p.regenPerSec > 0 && p.hp < p.maxHp && p.regenTimer >= p.regenDelay) {
        const before = p.hp;
        p.hp = Math.min(p.maxHp, p.hp + p.regenPerSec * dt);
        if (p.hp - before > 0.001) this._emit({ type: 'heal', hp: p.hp });
      }

      // 刷怪
      this._spawnTick(dt);

      // 战斗
      this._meleeTick(dt);
      this._abilityTick(dt);
      this._projectileTick(dt);
      this._enemyProjectileTick(dt);
      this._enemyTick(dt);
      this._gemTick(dt);
      if (s.phase !== 'playing') return; // 升级三选一打断本 tick 后续结算

      // 接触伤害
      s.contactTimer -= dt;
      if (s.contactTimer <= 0) {
        s.contactTimer = 0.5;
        this._contactDamage();
      }

      // 结算
      if (p.hp <= 0) { p.hp = 0; this._lose('slain'); return; }
      if (s.timeLeft <= 0) {
        s.timeLeft = 0;
        if (s.kills >= s.killTarget) this._win();
        else this._lose('timeOut');
      }
    },

    _inHazard(x, y) {
      for (const hz of this.state.hazards) {
        if (x >= hz.x && x <= hz.x + hz.w && y >= hz.y && y <= hz.y + hz.h) return true;
      }
      return false;
    },

    _spawnTick(dt) {
      const s = this.state;
      const lv = this._level;
      s.spawnTimer -= dt;
      if (s.spawnTimer <= 0) {
        s.spawnTimer = lv.spawn.interval;
        s.wave += 1;
        this._emit({ type: 'wave', wave: s.wave });
        const cap = Math.min(lv.spawn.cap || GAME.ENEMY_CAP, GAME.ENEMY_CAP);
        const count = Math.min(lv.spawn.perWave, cap - s.enemies.length);
        for (let i = 0; i < count; i += 1) this._spawnEnemy(this._pickEnemyId(), false);
      }
      // 精英
      if (lv.elite && !s.eliteSpawned && s.time >= lv.elite.at) {
        s.eliteSpawned = true;
        for (let i = 0; i < lv.elite.count; i += 1) this._spawnEnemy(lv.elite.type, true);
        this._emit({ type: 'eliteSpawn', kind: lv.elite.type });
      }
      // Boss（后半段现身）
      if (lv.boss && !s.bossSpawned && s.time >= lv.duration * 0.6) {
        s.bossSpawned = true;
        this._spawnEnemy(lv.boss, true);
        this._emit({ type: 'bossSpawn', kind: lv.boss });
      }
    },

    _pickEnemyId() {
      const ids = this._level.enemies;
      return ids[Math.floor(this._rng() * ids.length)] || ids[0];
    },

    _spawnEnemy(enemyId, announce) {
      const s = this.state;
      if (s.enemies.length >= GAME.ENEMY_CAP) return;
      const proto = ENEMIES[enemyId] || ENEMIES.boar;
      const pos = this._spawnPos();
      s.enemies.push({
        id: nextId++,
        enemyId,
        proto,
        x: pos.x, y: pos.y,
        hp: proto.hp, maxHp: proto.hp,
        damage: proto.damage,
        speed: proto.speed * (0.85 + this._rng() * 0.3),
        radius: proto.radius,
        xp: proto.xp,
        gold: proto.gold,
        shoot: !!proto.shoot,
        shootInterval: proto.shootInterval || 2.5,
        shootTimer: (proto.shootInterval || 2.5) * 0.6,
        projSpeed: proto.projSpeed || 160,
        projDamage: proto.projDamage || 10,
        elite: !!proto.elite,
        boss: !!proto.boss,
      });
      if (announce) this._emit({ type: 'spawn', enemyId, x: pos.x, y: pos.y, elite: !!proto.elite, boss: !!proto.boss });
    },

    _spawnPos() {
      const s = this.state;
      const ang = this._rng() * Math.PI * 2;
      const dist = 460 + this._rng() * 220;
      let x = s.player.x + Math.cos(ang) * dist;
      let y = s.player.y + Math.sin(ang) * dist;
      x = clamp(x, PLAY_X0, PLAY_X1);
      y = clamp(y, PLAY_Y0, PLAY_Y1);
      const pushed = pushOutWalls(x, y, 20, s.walls);
      return { x: pushed.x, y: pushed.y };
    },

    _nearestEnemy(x, y, rangeSq = Infinity) {
      let best = null, bd = rangeSq;
      for (const e of this.state.enemies) {
        const d = dist2(x, y, e.x, e.y);
        if (d < bd) { bd = d; best = e; }
      }
      return best;
    },

    _meleeTick(dt) {
      const p = this.state.player;
      p.strikeTimer -= dt;
      if (p.strikeTimer > 0) return;
      const range = p.meleeRange;
      const target = this._nearestEnemy(p.x, p.y, range * range);
      if (!target) return;
      p.strikeTimer = p.strikeInterval;
      this._damageEnemy(target, p.meleeDamage, 'melee');
    },

    _abilityTick(dt) {
      const p = this.state.player;
      const a = p.abilities;
      if (a.leafDart > 0) {
        p.dartTimer -= dt;
        if (p.dartTimer <= 0) {
          p.dartTimer = 1.4;
          const extra = a.thousandBamboo * 2;
          const targets = this._nearestEnemies(p.x, p.y, 1 + extra);
          for (const t of targets) {
            this._fireProjectile(p.x, p.y, t, p.meleeDamage * 0.8 + 5 * a.leafDart, 'leafDart');
          }
        }
      }
      if (a.whirlSlash > 0) {
        p.whirlTimer -= dt;
        if (p.whirlTimer <= 0) {
          p.whirlTimer = 2.2;
          const radius = 88 + 10 * a.whirlSlash;
          const dmg = p.meleeDamage * 0.5 + 6 * a.whirlSlash;
          let hits = 0;
          for (const e of this.state.enemies) {
            if (dist2(p.x, p.y, e.x, e.y) <= radius * radius) { this._damageEnemy(e, dmg, 'whirl'); hits += 1; }
          }
          this._emit({ type: 'whirl', x: p.x, y: p.y, radius, hits });
        }
      }
      if (a.thunderBamboo > 0) {
        p.thunderTimer -= dt;
        if (p.thunderTimer <= 0) {
          p.thunderTimer = 3.0;
          const dmg = p.meleeDamage * 0.7 + 8 * a.thunderBamboo;
          const targets = this._randomEnemies(3);
          for (const t of targets) { this._damageEnemy(t, dmg, 'thunder'); this._emit({ type: 'thunder', x: t.x, y: t.y }); }
        }
      }
    },

    _nearestEnemies(x, y, n) {
      const arr = [...this.state.enemies].sort((a, b) => dist2(x, y, a.x, a.y) - dist2(x, y, b.x, b.y));
      return arr.slice(0, n);
    },

    _randomEnemies(n) {
      const arr = [...this.state.enemies];
      // Fisher–Yates 洗牌后取前 n
      for (let i = arr.length - 1; i > 0; i -= 1) {
        const j = Math.floor(this._rng() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      return arr.slice(0, n);
    },

    _fireProjectile(x, y, target, damage, kind) {
      const s = this.state;
      if (s.projectiles.length >= GAME.PROJECTILE_CAP) return;
      const dx = target.x - x, dy = target.y - y;
      const len = Math.hypot(dx, dy) || 1;
      s.projectiles.push({
        x, y, vx: (dx / len) * 380, vy: (dy / len) * 380,
        damage, pierces: 1, lifetime: 1.5, radius: 7, kind,
      });
      this._emit({ type: 'shoot', kind, x, y });
    },

    _projectileTick(dt) {
      const s = this.state;
      const keep = [];
      for (const pr of s.projectiles) {
        pr.x += pr.vx * dt;
        pr.y += pr.vy * dt;
        pr.lifetime -= dt;
        let alive = pr.lifetime > 0;
        if (alive && pr.x > -20 && pr.x < W + 20 && pr.y > -20 && pr.y < H + 20) {
          let hit = null;
          for (const e of s.enemies) {
            if (dist2(pr.x, pr.y, e.x, e.y) <= (pr.radius + e.radius) * (pr.radius + e.radius)) { hit = e; break; }
          }
          if (hit) {
            this._damageEnemy(hit, pr.damage, 'projectile');
            pr.pierces -= 1;
            if (pr.pierces <= 0) alive = false;
          }
        } else {
          alive = false;
        }
        if (alive) keep.push(pr);
      }
      s.projectiles = keep;
    },

    _enemyProjectileTick(dt) {
      const s = this.state;
      const p = s.player;
      const keep = [];
      for (const pr of s.enemyProjectiles) {
        pr.x += pr.vx * dt;
        pr.y += pr.vy * dt;
        pr.lifetime -= dt;
        let alive = pr.lifetime > 0;
        if (alive) {
          const r = pr.radius + 16;
          if (dist2(pr.x, pr.y, p.x, p.y) <= r * r) {
            p.hp -= pr.damage;
            this._emit({ type: 'damage', source: 'projectile', dmg: pr.damage, hp: p.hp });
            alive = false;
          }
        }
        if (alive && pr.x > -40 && pr.x < W + 40 && pr.y > -40 && pr.y < H + 40) keep.push(pr);
      }
      s.enemyProjectiles = keep;
    },

    _enemyTick(dt) {
      const s = this.state;
      const p = s.player;
      for (const e of s.enemies) {
        // 移动（追玩家）
        const dx = p.x - e.x, dy = p.y - e.y;
        const len = Math.hypot(dx, dy) || 1;
        let spd = e.speed;
        // 根须缠绕减速
        if (p.abilities.rootTangle > 0 && dist2(p.x, p.y, e.x, e.y) <= 120 * 120) spd *= 0.6;
        e.x += (dx / len) * spd * dt;
        e.y += (dy / len) * spd * dt;
        const pushed = pushOutWalls(e.x, e.y, e.radius, s.walls);
        e.x = pushed.x; e.y = pushed.y;

        // Boss 远程
        if (e.shoot) {
          e.shootTimer -= dt;
          if (e.shootTimer <= 0) {
            e.shootTimer = e.shootInterval;
            this._fireEnemyProjectile(e, p);
          }
        }
      }
    },

    _fireEnemyProjectile(e, p) {
      const s = this.state;
      if (s.enemyProjectiles.length >= GAME.PROJECTILE_CAP) return;
      const dx = p.x - e.x, dy = p.y - e.y;
      const len = Math.hypot(dx, dy) || 1;
      s.enemyProjectiles.push({
        x: e.x, y: e.y, vx: (dx / len) * e.projSpeed, vy: (dy / len) * e.projSpeed,
        damage: e.projDamage, lifetime: 3.5, radius: 9,
      });
      this._emit({ type: 'enemyShoot', x: e.x, y: e.y, enemyId: e.enemyId });
    },

    _contactDamage() {
      const s = this.state;
      const p = s.player;
      for (const e of s.enemies) {
        const r = e.radius + 16;
        if (dist2(p.x, p.y, e.x, e.y) <= r * r) {
          p.hp -= e.damage;
          p.regenTimer = 0; // 受伤重置回血延迟
          this._emit({ type: 'damage', source: 'contact', dmg: e.damage, hp: p.hp });
        }
      }
    },

    _gemTick(dt) {
      const s = this.state;
      const p = s.player;
      const keep = [];
      for (const g of s.gems) {
        g.t += dt;
        const d = Math.sqrt(dist2(p.x, p.y, g.x, g.y));
        if (d <= p.pickupRadius) {
          this._collectGem(g);
          continue;
        }
        if (d <= p.magnetRadius) {
          const dx = p.x - g.x, dy = p.y - g.y;
          const len = Math.hypot(dx, dy) || 1;
          const pull = 220 + p.magnetRadius * 2;
          g.x += (dx / len) * pull * dt;
          g.y += (dy / len) * pull * dt;
        }
        keep.push(g);
      }
      s.gems = keep;
    },

    _collectGem(g) {
      const s = this.state;
      const p = s.player;
      p.xp += g.value;
      this._emit({ type: 'pickupXp', x: g.x, y: g.y, value: g.value, xp: p.xp });
      while (p.xp >= p.xpToNext) this._levelUp();
    },

    _levelUp() {
      const s = this.state;
      const p = s.player;
      p.xp -= p.xpToNext;
      p.level += 1;
      p.xpToNext = p.requiredXP[Math.min(p.level, p.requiredXP.length - 1)];
      this._emit({ type: 'levelUp', level: p.level });
      s.phase = 'upgrade';
      s.choices = this._rollChoices();
      if (!s.choices.length) { s.phase = 'playing'; this._emit({ type: 'upgrade', id: null }); }
    },

    _rollChoices() {
      const p = this.state.player;
      const avail = Object.keys(UPGRADE_MAP).filter((id) => this._upgradeLevel(id) < UPGRADE_MAP[id].maxLevel);
      // 洗牌
      for (let i = avail.length - 1; i > 0; i -= 1) {
        const j = Math.floor(this._rng() * (i + 1));
        [avail[i], avail[j]] = [avail[j], avail[i]];
      }
      // 优先保证至少一个 rule 型（未拥有的新剑意）
      const rules = avail.filter((id) => RULE_IDS.includes(id) && this._upgradeLevel(id) === 0);
      const picks = [];
      for (const r of rules) if (picks.length < 3 && !picks.includes(r)) picks.push(r);
      for (const id of avail) if (picks.length < 3 && !picks.includes(id)) picks.push(id);
      return picks;
    },

    _upgradeLevel(id) {
      const p = this.state.player;
      if (RULE_IDS.includes(id)) return p.abilities[id] || 0;
      return p[`stat_${id}`] || 0;
    },

    _applyUpgrade(id) {
      const p = this.state.player;
      const a = p.abilities;
      switch (id) {
        case 'bladePower': p.meleeDamage *= 1.25; break;
        case 'bladeSpeed': p.strikeInterval *= 0.85; break;
        case 'bladeRange': p.meleeRange += 18; break;
        case 'windStep': p.speed *= 1.12; break;
        case 'regrowth': p.regenPerSec += 0.25; break;
        case 'bambooShield': p.maxHp += 25; p.hp = Math.min(p.maxHp, p.hp + 25); break;
        case 'magnet': p.pickupRadius += 25; p.magnetRadius += 30; break;
        case 'leafDart': a.leafDart += 1; break;
        case 'whirlSlash': a.whirlSlash += 1; break;
        case 'thunderBamboo': a.thunderBamboo += 1; break;
        case 'rootTangle': a.rootTangle += 1; break;
        case 'thousandBamboo': a.thousandBamboo += 1; break;
        default: break;
      }
      // 记录 stat 等级（供升级上限判断）
      if (!RULE_IDS.includes(id)) p[`stat_${id}`] = (p[`stat_${id}`] || 0) + 1;
    },

    _recomputeSignature() {
      const a = this.state.player.abilities;
      let maxed = 0;
      for (const id of RULE_IDS) if ((a[id] || 0) >= UPGRADE_MAP[id].maxLevel) maxed += 1;
      this.state.signature = maxed >= GAME.SIGNATURE_INTENTS;
      if (this.state.signature) this._emit({ type: 'signature' });
    },

    _damageEnemy(e, dmg, kind) {
      if (e.hp <= 0) return;
      e.hp -= dmg;
      this._emit({ type: 'hit', x: e.x, y: e.y, damage: dmg, kind, enemyId: e.enemyId });
      if (e.hp <= 0) this._killEnemy(e);
    },

    _killEnemy(e) {
      const s = this.state;
      s.kills += 1;
      s.gold += e.gold || 0;
      for (let i = 0; i < (e.xp || 0); i += 1) {
        s.gems.push({
          x: e.x + (this._rng() * 2 - 1) * 14,
          y: e.y + (this._rng() * 2 - 1) * 14,
          value: GAME.XP_PER_GEM,
          t: 0,
        });
      }
      this._emit({ type: 'kill', x: e.x, y: e.y, enemyId: e.enemyId, kills: s.kills, gold: e.gold });
      s.enemies = s.enemies.filter((x) => x !== e);
    },

    _win() {
      const s = this.state;
      s.phase = 'won';
      s.result = { won: true, time: s.time, kills: s.kills, gold: s.gold };
      this._emit({ type: 'win', time: s.time, kills: s.kills, gold: s.gold });
    },

    _lose(reason) {
      const s = this.state;
      s.phase = 'lost';
      s.result = { won: false, reason, time: s.time, kills: s.kills, gold: s.gold };
      this._emit({ type: 'lose', reason, time: s.time, kills: s.kills, gold: s.gold });
    },
  };

  // 初始：立即刷第一波（事件密度：一进游戏就有东西）
  run._spawnTick(1);
  run.state.spawnTimer = Math.min(run.state.spawnTimer, run._level.spawn.interval);

  return run;
}

// 兼容骨架别名
export function createSim() {
  return createRun(0, { seed: 1 });
}
