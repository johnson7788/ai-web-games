// 纯逻辑：切水果核心玩法（无 DOM，可 node --test 与 selfplay 直接驱动）。
//
// 玩法事实（P0，源自参考源码 assets/scripts/*.js，数值做 720p 适配）：
//   - 水果从底部中心抛出，初速 880–1320、抛射角 70°–110°，重力 980 拉回（game_fruitManager.js:6-9,29-41,56-83）
//   - 水果每 3s 自转一圈（game_fruitManager.js:11,128-134）
//   - 切中水果 → 得分 +1；切中炸弹 → 立即结束（game_cutLogic.js:293-318）
//   - 漏掉一个水果 → 扣 1 命；3 命用尽结束（game_cutLogic.js:323-345）
//   - 生成间隔约 1–2s（game_cutLogic.js:287-289）
//
// 改造（原创新机制）：连击（1.2s 窗口）+ 暴走 FRENZY ×2 + 岩石断连 + 金果高分 + 波次难度 + 三星评级。
import { WORLD, STEP, FRUIT, LIVES, WAVE, STARS } from '../../config/game.config.js';

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function rng() {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 线段与圆相交判定（用于「一刀切中」）
function segmentHitsCircle(x0, y0, x1, y1, cx, cy, r) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const fx = x0 - cx;
  const fy = y0 - cy;
  const a = dx * dx + dy * dy;
  if (a === 0) return (fx * fx + fy * fy) <= r * r;
  let t = -((fx * dx + fy * dy) / a);
  t = Math.max(0, Math.min(1, t));
  const px = x0 + dx * t - cx;
  const py = y0 + dy * t - cy;
  return (px * px + py * py) <= r * r;
}

function starsFor(score) {
  if (score >= STARS.three) return 3;
  if (score >= STARS.two) return 2;
  if (score >= STARS.one) return 1;
  return 0;
}

const FRUIT_COLORS = {
  fruit: ['#ff5d5d', '#ffa63d', '#7fe06a', '#ffd24a'],
  golden: ['#ffe066', '#ffb800'],
  bomb: ['#2a2a35', '#111118'],
  rock: ['#8a90a0', '#565c6b'],
};

function fruitColor(type, rng) {
  const arr = FRUIT_COLORS[type];
  return arr[Math.floor(rng() * arr.length)];
}

export function createRun(opts = {}) {
  const seed = (opts.seed ?? ((Date.now() % 2147483647) || 1)) >>> 0;
  const rng = mulberry32(seed);

  const state = {
    phase: 'playing',           // playing | gameover
    seed,
    time: 0,
    wave: 1,
    score: 0,
    lives: LIVES,
    combo: 0,
    comboTimer: 0,
    frenzy: false,
    frenzyTimer: 0,
    frenzyCooldown: 0,
    maxCombo: 0,
    spawned: 0,
    spawnTimer: 0.55,
    fruits: [],                 // 飞行中的水果/炸弹/岩石
    splits: [],                 // 被切开的两半（渲染用）
    particles: [],              // 切裂粒子（渲染用）
    events: [],
    stats: { sliced: 0, missed: 0, bombsHit: 0, rocksHit: 0, golden: 0 },
    nextId: 1,
  };

  const emit = (type, payload = {}) => state.events.push({ type, ...payload });

  function waveFor(spawned) {
    return 1 + Math.floor(spawned / WAVE.fruitPerWave);
  }

  function spawnFruit() {
    const wave = state.wave;
    const roll = rng();
    const bombChance = Math.min(0.34, WAVE.bombBase + (wave - 1) * WAVE.bombStep);
    const rockChance = wave >= 2 ? Math.min(0.30, WAVE.rockBase + (wave - 2) * WAVE.rockStep) : 0;
    const goldenChance = state.spawned === WAVE.goldenGuaranteeIndex
      ? 1
      : Math.min(0.16, WAVE.goldenBase + (wave - 1) * WAVE.goldenStep);

    let type = 'fruit';
    if (roll < bombChance) type = 'bomb';
    else if (roll < bombChance + rockChance) type = 'rock';
    else if (roll < bombChance + rockChance + goldenChance) type = 'golden';

    const v0 = FRUIT.speedMin + (FRUIT.speedMax - FRUIT.speedMin) * rng();
    const angle = ((FRUIT.angleMin + (FRUIT.angleMax - FRUIT.angleMin) * rng()) * Math.PI) / 180;
    const fruit = {
      id: state.nextId++,
      type,
      x: WORLD.WIDTH / 2,
      y: FRUIT.spawnY,
      vx: v0 * Math.cos(angle),
      vy: -v0 * Math.sin(angle),
      rotation: rng() * Math.PI * 2,
      rotSpeed: ((Math.PI * 2) / FRUIT.rotateDuration) * (rng() < 0.5 ? -1 : 1),
      radius: FRUIT.radius,
      color: fruitColor(type, rng),
      state: 'flying',
    };
    state.fruits.push(fruit);
    state.spawned += 1;
    emit('spawn', { type, wave });

    const newWave = waveFor(state.spawned);
    if (newWave > state.wave) {
      state.wave = newWave;
      emit('waveUp', { wave: newWave });
    }
  }

  function spawnInterval() {
    const base = Math.max(WAVE.spawnIntervalMin, WAVE.spawnIntervalBase - (state.wave - 1) * 0.22);
    return base * (0.85 + rng() * 0.3);
  }

  function doGameOver() {
    if (state.phase === 'gameover') return;
    state.phase = 'gameover';
    const stars = starsFor(state.score);
    emit('gameOver', { score: state.score, stars, wave: state.wave, maxCombo: state.maxCombo });
  }

  function missFruit() {
    state.lives -= 1;
    state.combo = 0;
    state.comboTimer = 0;
    state.stats.missed += 1;
    emit('lifeLost', { lives: state.lives });
    if (state.lives <= 0) doGameOver();
  }

  function breakCombo() {
    state.combo = 0;
    state.comboTimer = 0;
  }

  function maybeStartFrenzy() {
    if (state.combo >= FRUIT.frenzyThreshold && !state.frenzy && state.frenzyCooldown <= 0) {
      state.frenzy = true;
      state.frenzyTimer = FRUIT.frenzyDuration;
      emit('frenzyStart', { combo: state.combo });
    }
  }

  function scoreFruit(type) {
    state.combo += 1;
    state.comboTimer = FRUIT.comboWindow;
    if (state.combo > state.maxCombo) state.maxCombo = state.combo;
    const base = type === 'golden' ? FRUIT.goldenBase : FRUIT.normalBase;
    const mult = state.frenzy ? FRUIT.frenzyMult : 1;
    const points = base * state.combo * mult;
    state.score += points;
    maybeStartFrenzy();
    if (type === 'golden') {
      state.stats.golden += 1;
      emit('goldenSliced', { combo: state.combo, points });
    } else {
      state.stats.sliced += 1;
      emit('fruitSliced', { combo: state.combo, points });
    }
    if (state.combo >= 2) emit('comboUp', { combo: state.combo });
    return points;
  }

  function splitFruit(fruit) {
    // 沿切割方向把水果分成两半：左半逆切向、右半顺切向飞出。
    const dir = fruit.vx >= 0 ? 1 : -1;
    for (const side of [-1, 1]) {
      state.splits.push({
        id: state.nextId++,
        type: fruit.type,
        x: fruit.x,
        y: fruit.y,
        vx: side * dir * 120,
        vy: -Math.abs(60) - 40 * rng(),
        rotation: fruit.rotation,
        rotSpeed: side * 6,
        color: fruit.color,
        ttl: 1.1,
      });
    }
    // 切裂粒子
    const n = fruit.type === 'golden' ? 16 : 10;
    for (let i = 0; i < n; i += 1) {
      const a = (i / n) * Math.PI * 2;
      state.particles.push({
        x: fruit.x,
        y: fruit.y,
        vx: Math.cos(a) * (80 + rng() * 160),
        vy: Math.sin(a) * (80 + rng() * 160) - 60,
        color: fruit.type === 'bomb' ? '#ff4d4d' : fruit.color,
        ttl: 0.5 + rng() * 0.3,
        size: 3 + rng() * 4,
      });
    }
  }

  // ---------- 每帧推进 ----------
  function step(dt) {
    if (state.phase !== 'playing') return;
    const d = Math.min(0.1, dt || STEP);
    state.time += d;

    // 连击窗口 / 暴走计时
    if (state.comboTimer > 0) {
      state.comboTimer -= d;
      if (state.comboTimer <= 0) state.combo = 0;
    }
    if (state.frenzyCooldown > 0) {
      state.frenzyCooldown -= d;
      if (state.frenzyCooldown <= 0) emit('frenzyReady', {});
    }
    if (state.frenzy) {
      state.frenzyTimer -= d;
      if (state.frenzyTimer <= 0) {
        state.frenzy = false;
        state.frenzyCooldown = FRUIT.frenzyCooldown;
        emit('frenzyEnd', {});
      }
    }

    // 生成
    state.spawnTimer -= d;
    if (state.spawnTimer <= 0) {
      spawnFruit();
      state.spawnTimer = spawnInterval();
    }

    // 飞行物理
    for (let i = state.fruits.length - 1; i >= 0; i -= 1) {
      const f = state.fruits[i];
      f.vy += FRUIT.gravity * d;
      f.x += f.vx * d;
      f.y += f.vy * d;
      f.rotation += f.rotSpeed * d;

      const outY = f.y > WORLD.HEIGHT + 100;
      const outX = f.x < -140 || f.x > WORLD.WIDTH + 140;
      if (outY || outX) {
        state.fruits.splice(i, 1);
        // 只有普通/金果漏掉才扣命；炸弹/岩石漏掉无惩罚（与原版一致）
        if (f.type === 'fruit' || f.type === 'golden') missFruit();
      }
    }

    // 两半与粒子
    for (let i = state.splits.length - 1; i >= 0; i -= 1) {
      const s = state.splits[i];
      s.vy += FRUIT.gravity * d;
      s.x += s.vx * d;
      s.y += s.vy * d;
      s.rotation += s.rotSpeed * d;
      s.ttl -= d;
      if (s.ttl <= 0) state.splits.splice(i, 1);
    }
    for (let i = state.particles.length - 1; i >= 0; i -= 1) {
      const p = state.particles[i];
      p.vy += FRUIT.gravity * 0.6 * d;
      p.x += p.vx * d;
      p.y += p.vy * d;
      p.ttl -= d;
      if (p.ttl <= 0) state.particles.splice(i, 1);
    }
  }

  // ---------- 切一刀（线段 p0→p1）----------
  function cut(x0, y0, x1, y1) {
    if (state.phase !== 'playing') return 0;
    let cutCount = 0;
    const toRemove = [];
    for (const f of state.fruits) {
      if (f.state !== 'flying') continue;
      if (!segmentHitsCircle(x0, y0, x1, y1, f.x, f.y, f.radius)) continue;
      toRemove.push(f);
      if (f.type === 'fruit' || f.type === 'golden') {
        scoreFruit(f.type);
        splitFruit(f);
        cutCount += 1;
      } else if (f.type === 'rock') {
        state.stats.rocksHit += 1;
        breakCombo();
        emit('rockHit', {});
        // 岩石碎裂（无分无命，只断连）
        for (let i = 0; i < 8; i += 1) {
          const a = (i / 8) * Math.PI * 2;
          state.particles.push({
            x: f.x, y: f.y,
            vx: Math.cos(a) * 120, vy: Math.sin(a) * 120,
            color: f.color, ttl: 0.4, size: 4,
          });
        }
      } else if (f.type === 'bomb') {
        state.stats.bombsHit += 1;
        breakCombo();
        emit('bombHit', {});
        // 炸弹爆炸：闪白 + 结束
        for (let i = 0; i < 22; i += 1) {
          const a = (i / 22) * Math.PI * 2;
          state.particles.push({
            x: f.x, y: f.y,
            vx: Math.cos(a) * (120 + rng() * 220), vy: Math.sin(a) * (120 + rng() * 220),
            color: i % 2 ? '#ff6a3d' : '#ffd24a', ttl: 0.6, size: 4 + rng() * 4,
          });
        }
        doGameOver();
      }
    }
    if (toRemove.length) {
      for (const f of toRemove) {
        const idx = state.fruits.indexOf(f);
        if (idx >= 0) state.fruits.splice(idx, 1);
      }
    }
    return cutCount;
  }

  function drainEvents() {
    const evs = state.events;
    state.events = [];
    return evs;
  }

  function getHud() {
    return {
      score: state.score,
      lives: state.lives,
      combo: state.combo,
      maxCombo: state.maxCombo,
      wave: state.wave,
      frenzy: state.frenzy,
      time: state.time,
      stars: starsFor(state.score),
    };
  }

  return {
    state,
    step,
    cut,
    drainEvents,
    getHud,
    spawnFruit,
    doGameOver,
    starsFor,
  };
}
