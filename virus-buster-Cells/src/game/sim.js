// 纯逻辑 sim（零 DOM / 零 WebAudio，可被 node --test 与 selfplay 直接 import）。
// 玩法：底部飞船 + 上方降落的带血量病毒细胞；拖拽移动、按住连射、
// 击杀掉金币、血条清零过关、死亡可复活、晶体碎片不可击碎需躲避、连击倍率与星级。
import { WORLD, STEP, SHIP, BULLET, GERM, CRYSTAL, POWERUP, UPGRADES } from '../../config/game.config.js';
import { levelWaves, crystalCount, levelTotalHp } from '../../config/levels.js';

export { WORLD, STEP };

// 确定性 PRNG（selfplay 固定种子，同版本结果可复现）
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

export const DEFAULT_UPGRADES = { firePower: 1, fireRate: 1, goldValue: 1, shield: 0, nukeStart: 0 };

export function createRun(levelIndex = 0, opts = {}) {
  const seed = opts.seed ?? 1;
  const rng = mulberry32(seed);
  const upgrades = { ...DEFAULT_UPGRADES, ...(opts.upgrades || {}) };
  const rand = (lo, hi) => lo + rng() * (hi - lo);

  const s = {
    phase: 'playing',      // playing | won | gameover
    level: 1,
    time: 0,
    lives: SHIP.LIVES,
    deaths: 0,
    levelDeaths: 0,
    gold: 0,
    combo: 0,
    maxCombo: 0,
    comboTimer: 0,
    damageDealt: 0,
    totalHp: 0,
    waveIdx: 0,
    waves: [],
    germs: [],
    crystals: [],
    bullets: [],
    orbs: [],
    shield: 0,
    nukes: 0,
    temp: { rapid: 0, spread: 0 },
    fireT: 0,
    ship: { x: WORLD.WIDTH / 2, y: SHIP.Y, alive: true, invulnT: 0, deadT: 0, bank: 0 },
    deadTimer: 0,
    result: null,
  };

  const input = { x: WORLD.WIDTH / 2, firing: false };
  const events = [];
  let idSeq = 0;
  let everFired = false;

  const nextId = () => ++idSeq;
  const emit = (type, data = {}) => events.push({ type, t: s.time, ...data });

  const firePower = () => clamp(upgrades.firePower + (s.temp.spread > 0 ? 2 : 0), 1, 8);
  const fireInterval = () => {
    let iv = BULLET.BASE_INTERVAL * Math.pow(0.82, upgrades.fireRate - 1);
    if (s.temp.rapid > 0) iv *= 0.55;
    return Math.max(0.05, iv);
  };
  const goldMult = () => 1 + (upgrades.goldValue - 1) * 0.5;
  const comboMult = () => 1 + Math.min(2, Math.floor(s.combo / 10)) * 0.5;

  function spawnGerm(hp) {
    const g = {
      id: nextId(),
      hp,
      maxHp: hp,
      r: GERM.radiusFor(hp),
      x: rand(90, WORLD.WIDTH - 90),
      y: -60 - rng() * 220,
      vx: (rng() < 0.5 ? -1 : 1) * rand(24, GERM.VX_MAX),
      vy: rand(GERM.VY_MIN, GERM.VY_MAX),
      flash: 0,
      boss: hp >= 20,
      dead: false,
    };
    s.germs.push(g);
    if (g.boss) emit('boss_spawn', { id: g.id, hp: g.hp });
  }

  function spawnCrystal(initial) {
    s.crystals.push({
      id: nextId(),
      r: rand(CRYSTAL.RADIUS_MIN, CRYSTAL.RADIUS_MAX),
      x: rand(80, WORLD.WIDTH - 80),
      y: initial ? -80 - rng() * 340 : -80 - rng() * 220,
      vx: (rng() < 0.5 ? -1 : 1) * rand(20, CRYSTAL.VX_MAX),
      vy: rand(CRYSTAL.VY_MIN, CRYSTAL.VY_MAX),
    });
    emit('crystal_spawn', {});
  }

  function spawnWave(i) {
    const row = s.waves[i];
    s.waveIdx = i + 1;
    for (const hp of row) spawnGerm(hp);
    emit('wave', { wave: i + 1, count: row.length });
  }

  function spawnOrb(x, y) {
    const kinds = ['rapid', 'spread', 'shield', 'heal', 'nuke'];
    s.orbs.push({
      id: nextId(),
      kind: kinds[Math.floor(rng() * kinds.length)],
      x,
      y,
      vy: POWERUP.VY,
      r: POWERUP.RADIUS,
    });
  }

  function killGerm(g) {
    s.combo += 1;
    s.maxCombo = Math.max(s.maxCombo, s.combo);
    s.comboTimer = GERM.COMBO_WINDOW;
    const gold = Math.max(1, Math.ceil(g.maxHp * goldMult() * comboMult()));
    s.gold += gold;
    emit('kill', { id: g.id, hp: g.maxHp, gold, combo: s.combo, x: g.x, y: g.y });
    emit('coin', { gold, combo: s.combo, x: g.x, y: g.y });
    if (s.combo > 0 && s.combo % 10 === 0) emit('combo', { combo: s.combo });
    if (rng() < POWERUP.DROP_CHANCE) spawnOrb(g.x, g.y);
  }

  function processDeaths() {
    for (let i = s.germs.length - 1; i >= 0; i -= 1) {
      if (s.germs[i].dead) {
        const g = s.germs[i];
        s.germs.splice(i, 1);
        killGerm(g);
      }
    }
  }

  function damageShip() {
    if (s.shield > 0) {
      s.shield -= 1;
      s.ship.invulnT = 1.5;
      emit('shield', { shield: s.shield, x: s.ship.x, y: s.ship.y });
      return;
    }
    s.deaths += 1;
    s.levelDeaths += 1;
    s.lives -= 1;
    s.ship.alive = false;
    s.deadTimer = SHIP.DEAD_TIMER;
    s.bullets.length = 0;
    s.combo = 0;
    emit('lose', { deaths: s.deaths, lives: s.lives });
  }

  function collectOrb(o) {
    emit('powerup', { kind: o.kind, x: o.x, y: o.y });
    if (o.kind === 'rapid') s.temp.rapid = POWERUP.DURATION;
    else if (o.kind === 'spread') s.temp.spread = POWERUP.DURATION;
    else if (o.kind === 'shield') s.shield += 1;
    else if (o.kind === 'heal') s.lives = Math.min(SHIP.LIVES, s.lives + 1);
    else if (o.kind === 'nuke') {
      for (const g of s.germs) g.dead = true;
      processDeaths();
    }
  }

  function startLevel(level) {
    const lv = Math.max(1, level | 0);
    s.level = lv;
    s.waves = levelWaves(lv);
    s.totalHp = levelTotalHp(lv);
    s.damageDealt = 0;
    s.gold = 0;
    s.combo = 0;
    s.maxCombo = 0;
    s.comboTimer = 0;
    s.levelDeaths = 0;
    s.deaths = 0;
    s.lives = SHIP.LIVES;
    s.ship.alive = true;
    s.ship.invulnT = 0;
    s.ship.x = WORLD.WIDTH / 2;
    s.ship.deadT = 0;
    s.bullets = [];
    s.germs = [];
    s.orbs = [];
    s.crystals = [];
    s.waveIdx = 0;
    s.deadTimer = 0;
    s.shield = upgrades.shield || 0;
    s.nukes = upgrades.nukeStart ? 1 : 0;
    s.temp.rapid = 0;
    s.temp.spread = 0;
    s.result = null;
    s.phase = 'playing';
    const cc = crystalCount(lv);
    for (let i = 0; i < cc; i += 1) spawnCrystal(true);
    spawnWave(0);
    emit('start', { level: lv });
  }

  function step(dt) {
    if (s.phase !== 'playing') return;

    // 死亡倒计时：清空子弹，病毒休眠，倒计时后复活或结算
    if (!s.ship.alive) {
      s.deadTimer -= dt;
      if (s.deadTimer <= 0) {
        if (s.lives <= 0) {
          s.phase = 'gameover';
          s.result = { type: 'lose', stars: 0, gold: s.gold, combo: s.maxCombo };
          emit('gameover', { ...s.result });
          return;
        }
        s.ship.alive = true;
        s.ship.invulnT = SHIP.INVULN_AFTER_REVIVE;
        s.ship.x = WORLD.WIDTH / 2;
        emit('revive', { lives: s.lives });
      }
      return;
    }

    s.time += dt;

    // 连击衰减
    if (s.comboTimer > 0) {
      s.comboTimer -= dt;
      if (s.comboTimer <= 0) s.combo = 0;
    }

    // 临时增益衰减
    s.temp.rapid = Math.max(0, s.temp.rapid - dt);
    s.temp.spread = Math.max(0, s.temp.spread - dt);

    // 飞船移动
    const dx = clamp(input.x - s.ship.x, -SHIP.MAX_SPEED * dt, SHIP.MAX_SPEED * dt);
    s.ship.x += dx;
    s.ship.x = clamp(s.ship.x, 40, WORLD.WIDTH - 40);
    s.ship.bank = clamp(dx / (SHIP.MAX_SPEED * dt || 1), -1, 1);
    s.ship.invulnT = Math.max(0, s.ship.invulnT - dt);

    // 自动开火兜底：无任何手动输入 1.5s 后自动连射（保证 noinput 也推进/死亡）
    const firing = input.firing || (s.time > 1.5 && !everFired);

    // 射击
    s.fireT -= dt;
    if (firing && s.fireT <= 0) {
      s.fireT = fireInterval();
      const count = firePower();
      const span = count > 1 ? (count - 1) * 8 : 0; // 扇面角度
      for (let i = 0; i < count; i += 1) {
        const ang = count === 1 ? 0 : (-span / 2) + (span / (count - 1)) * i;
        const rad = (ang * Math.PI) / 180;
        s.bullets.push({
          id: nextId(),
          x: s.ship.x + Math.sin(rad) * 8,
          y: s.ship.y - SHIP.RADIUS - 4,
          vx: Math.sin(rad) * BULLET.SPEED,
          vy: -Math.cos(rad) * BULLET.SPEED,
          r: BULLET.RADIUS,
        });
      }
      emit('shot', {});
    }

    // 子弹
    for (let i = s.bullets.length - 1; i >= 0; i -= 1) {
      const b = s.bullets[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      if (b.y < -30 || b.x < -20 || b.x > WORLD.WIDTH + 20) {
        s.bullets.splice(i, 1);
        continue;
      }
      let consumed = false;
      for (const g of s.germs) {
        if (dist(b, g) < b.r + g.r) {
          g.hp -= 1;
          g.flash = 0.09;
          s.damageDealt += 1;
          if (g.hp <= 0) g.dead = true;
          emit('hit', { id: g.id, hp: g.hp });
          consumed = true;
          break;
        }
      }
      if (consumed) s.bullets.splice(i, 1);
    }

    // 处理死亡病毒（掉落金币/连击/道具）
    processDeaths();

    // 病毒移动（含低空追船 + 左右反弹 + 出底回收）
    for (const g of s.germs) {
      g.flash = Math.max(0, g.flash - dt);
      g.y += g.vy * dt;
      if (g.y > GERM.HOMING_START_Y && g.y < s.ship.y - 24) {
        g.vx += Math.sign(s.ship.x - g.x) * GERM.HOMING_ACCEL * dt;
        g.vx = clamp(g.vx, -GERM.VX_MAX * 1.6, GERM.VX_MAX * 1.6);
      }
      g.x += g.vx * dt;
      if (g.x < 60) { g.x = 60; g.vx = Math.abs(g.vx); }
      if (g.x > WORLD.WIDTH - 60) { g.x = WORLD.WIDTH - 60; g.vx = -Math.abs(g.vx); }
      if (g.y > WORLD.HEIGHT + 90) {
        g.y = -60 - rng() * 180;
        g.x = rand(90, WORLD.WIDTH - 90);
        g.vx = (rng() < 0.5 ? -1 : 1) * rand(24, GERM.VX_MAX);
        g.vy = rand(GERM.VY_MIN, GERM.VY_MAX);
      }
      if (s.ship.alive && s.ship.invulnT <= 0 && dist(g, s.ship) < g.r + SHIP.RADIUS) damageShip();
    }

    // 晶体碎片
    for (const c of s.crystals) {
      c.y += c.vy * dt;
      c.x += c.vx * dt;
      if (c.x < 40) { c.x = 40; c.vx = Math.abs(c.vx); }
      if (c.x > WORLD.WIDTH - 40) { c.x = WORLD.WIDTH - 40; c.vx = -Math.abs(c.vx); }
      if (c.y > WORLD.HEIGHT + 60) {
        c.y = -80 - rng() * 200;
        c.x = rand(80, WORLD.WIDTH - 80);
        c.vx = (rng() < 0.5 ? -1 : 1) * rand(20, CRYSTAL.VX_MAX);
        c.vy = rand(CRYSTAL.VY_MIN, CRYSTAL.VY_MAX);
      }
      if (s.ship.alive && s.ship.invulnT <= 0 && dist(c, s.ship) < c.r + SHIP.RADIUS) damageShip();
    }

    // 道具球
    for (let i = s.orbs.length - 1; i >= 0; i -= 1) {
      const o = s.orbs[i];
      o.y += o.vy * dt;
      if (o.y > WORLD.HEIGHT + 40) { s.orbs.splice(i, 1); continue; }
      if (s.ship.alive && dist(o, s.ship) < o.r + SHIP.RADIUS) {
        collectOrb(o);
        s.orbs.splice(i, 1);
      }
    }

    // 波次推进 / 过关
    if (s.ship.alive && s.germs.length === 0) {
      if (s.waveIdx < s.waves.length) {
        spawnWave(s.waveIdx);
      } else {
        const stars = clamp(3 - s.levelDeaths, 1, 3);
        s.phase = 'won';
        s.result = { type: 'win', stars, gold: s.gold, combo: s.maxCombo, level: s.level };
        emit('win', { ...s.result });
      }
    }
  }

  startLevel((levelIndex | 0) + 1);

  return {
    state: s,
    get input() { return input; },
    setInput(x, firing) {
      input.x = clamp(x, 0, WORLD.WIDTH);
      input.firing = !!firing;
      if (firing && !everFired) {
        everFired = true;
        emit('first_input', {});
      }
    },
    step,
    drainEvents() {
      if (!events.length) return [];
      const out = events.splice(0, events.length);
      return out;
    },
    start(level) { startLevel(level); },
    nextLevel() {
      if (s.phase === 'won') { startLevel(s.level + 1); return true; }
      return false;
    },
    bomb() {
      if (s.nukes > 0 && s.phase === 'playing') {
        s.nukes -= 1;
        for (const g of s.germs) g.dead = true;
        processDeaths();
        emit('bomb', { nukes: s.nukes, x: s.ship.x, y: s.ship.y });
        return true;
      }
      return false;
    },
    getHud() {
      return {
        level: s.level,
        wave: Math.min(s.waveIdx, s.waves.length),
        waveCount: s.waves.length,
        hpPct: s.totalHp ? Math.max(0, 1 - s.damageDealt / s.totalHp) : 0,
        combo: s.combo,
        maxCombo: s.maxCombo,
        gold: s.gold,
        lives: s.lives,
        shield: s.shield,
        nukes: s.nukes,
        firePower: firePower(),
        time: s.time,
        phase: s.phase,
        totalHp: s.totalHp,
      };
    },
  };
}
