// 纯逻辑 sim：发射 → 空中转向/下落攻击 → 砸碎外星人/弹簧续弹力 → 抵达母舰过关。
// 确定性：地图用 seed 生成，物理用固定步长；不依赖真实时间。
// 事件 payload 里不要用字段名 `type`（会覆盖事件名）。
import { WORLD, STEP, HERO, AIM, MAP } from '../../config/game.config.js';
import { LEVELS, LEVEL_COUNT } from '../../config/levels.js';

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

const TAU = Math.PI * 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function randLane(rng, lanes) {
  return lanes[Math.floor(rng() * lanes.length) % lanes.length];
}

// 生成某一关的元素（绝对 y 坐标，跨关连续）
function genLevel(level, levelStartY, rng) {
  const elements = [];
  const end = levelStartY + level.distance;

  for (let y = levelStartY + MAP.ROW_H; y < end; y += MAP.ROW_H) {
    const local = y - levelStartY;

    // 中央安全航道的弹簧：每 springGap 一个（greedy 靠它续弹力）
    if (local % level.springGap < MAP.ROW_H) {
      elements.push({ type: 'spring', x: MAP.CENTER, y, r: MAP.SPRING_RADIUS });
    }

    // 中央航道的敌人（含大块头）与水晶，保证 greedy 有内容可砸
    if (rng() < level.alienRate) {
      const roll = rng();
      const size = roll < 0.18 ? 3 : (roll < 0.5 ? 1 : 2);
      elements.push({ type: 'alien', x: MAP.CENTER, y, r: MAP.ELEMENT_RADIUS + size * 4, size });
    }
    if (rng() < level.crystalRate) {
      elements.push({ type: 'crystal', x: MAP.CENTER, y, r: MAP.ELEMENT_RADIUS });
    }

    // 边路：地雷（远离中央航道，greedy 下砸半径打不到） + 敌人 + 列车
    for (const lane of MAP.HAZARD_LANES) {
      if (rng() < level.hazardRate) {
        elements.push({ type: 'hazard', x: lane, y, r: MAP.HAZARD_RADIUS });
      }
    }
    if (rng() < level.alienRate * 0.45) {
      const x = randLane(rng, MAP.SIDE_LANES);
      elements.push({ type: 'alien', x, y, r: MAP.ELEMENT_RADIUS + (rng() < 0.3 ? 2 : 1) * 4, size: rng() < 0.3 ? 2 : 1 });
    }
    if (rng() < level.trainRate) {
      const x = randLane(rng, MAP.SIDE_LANES);
      elements.push({ type: 'train', x, y, r: 46, way: rng() < 0.5 ? -1 : 1 });
    }
  }

  // 关卡线（母舰）标记
  elements.push({ type: 'boss', x: MAP.CENTER, y: end, r: 78 });
  return elements;
}

function shotLevelFor(theta) {
  const r = Math.abs(theta);
  for (let i = 0; i < AIM.SHOT_VALUE.length; i += 1) {
    if (r <= AIM.SHOT_VALUE[i]) return i; // 0=perfect 1=good 2=normal 3=bad
  }
  return 3;
}

// 依据当前 hop 与 hero 计算落地位置（不改变状态；render 也用同一公式）
export function computeLanding(hero, hop) {
  const climb = hero.E * HERO.CLIMB_PER_E * (1 - HERO.STEER_CLIMB_COST * Math.abs(hop.lean));
  const effTheta = hop.theta + hop.lean * (AIM.ROTATE_DEG / 2);
  const horizontal = Math.tan((effTheta * Math.PI) / 180) * climb;
  let nx = hop.x0 + horizontal;
  let ntheta = hop.theta;
  if (nx > HERO.MAX_X) { nx = HERO.MAX_X; ntheta = -hop.theta * HERO.WALL_DAMP; }
  else if (nx < HERO.MIN_X) { nx = HERO.MIN_X; ntheta = -hop.theta * HERO.WALL_DAMP; }
  const ny = hop.y0 + climb;
  return { nx, ny, ntheta };
}

export function createRun(levelIndex = 0, opts = {}) {
  const seed = (opts.seed ?? 1) >>> 0;
  const levelIndex0 = Math.max(0, Math.min(LEVEL_COUNT - 1, levelIndex | 0));
  const level = LEVELS[levelIndex0];
  const rng = mulberry32(seed);
  const levelStartY = 0;

  const state = {
    phase: 'aim',            // aim | flying | won | lost
    level: levelIndex0 + 1,
    levelIndex: levelIndex0,
    seed,
    levelStartY,
    hero: {
      x: HERO.START_X,
      y: 0,
      E: HERO.E0,
      theta: 0,
      lean: 0,
      combo: 0,
      maxCombo: 0,
    },
    hop: null,
    elements: genLevel(level, levelStartY, rng),
    destroyed: new Set(),
    score: 0,
    aliensSmashed: 0,
    crystals: 0,
    springs: 0,
    trains: 0,
    totalAliens: 0,
    stars: 0,
    won: false,
    reason: null,
    aimTheta: 0,
    aimT: 0,
    autoLaunchT: 0,
    events: [],
    rng,
  };

  state.totalAliens = state.elements.filter((e) => e.type === 'alien').length;

  function emit(name, payload) {
    state.events.push({ type: name, ...(payload || {}) });
  }

  function startHop() {
    const h = state.hero;
    state.hop = {
      x0: h.x,
      y0: h.y,
      theta: h.theta,
      lean: 0,
      t: 0,
      T: (2 * HERO.LAUNCH_SPEED) / HERO.GRAVITY,
      dropQueued: false,
      dropApex: false,
    };
  }

  function levelClear() {
    state.score += 500 + state.level * 200;
    emit('levelClear', { level: state.level });
    if (state.level >= LEVEL_COUNT) {
      state.won = true;
      state.phase = 'won';
      state.stars = computeStars();
      state.score += state.stars * 100;
      emit('win', { stars: state.stars });
      return;
    }
    state.levelStartY += LEVELS[state.levelIndex].distance; // 上一关距离
    state.levelIndex += 1;
    state.level = state.levelIndex + 1;
    const next = LEVELS[state.levelIndex];
    state.elements = genLevel(next, state.levelStartY, state.rng);
    state.destroyed = new Set();
    state.totalAliens = state.elements.filter((e) => e.type === 'alien').length;
    // 继续飞，不重置弹力/角度/位置
  }

  function computeStars() {
    const total = state.aliensSmashed + state.crystals * 2 + state.maxCombo * 2;
    if (total >= 46) return 3;
    if (total >= 24) return 2;
    return 1;
  }

  function resolveLanding() {
    const h = state.hero;
    const hop = state.hop;
    if (!hop) return;
    const { nx, ny, ntheta } = computeLanding(h, hop);
    h.x = nx;
    h.y = ny;
    h.theta = ntheta;
    h.lean = 0;

    const radius = hop.dropQueued ? HERO.DROP_RADIUS + h.E * HERO.DROP_RADIUS_E : HERO.BASE_RADIUS;
    let smashed = 0;
    let springHit = false;
    let died = false;
    let nearMiss = false;

    for (let i = 0; i < state.elements.length; i += 1) {
      const e = state.elements[i];
      if (state.destroyed.has(i)) continue;
      const dx = Math.abs(e.x - nx);
      const dy = Math.abs(e.y - ny);
      if (dy > radius + e.r) continue;
      const dist = Math.hypot(dx, dy);
      const hit = dist <= radius + e.r;

      if (hit) {
        switch (e.type) {
          case 'alien':
            state.destroyed.add(i);
            smashed += 1;
            state.aliensSmashed += 1;
            state.score += e.size * 10;
            emit('smash', { size: e.size });
            if (e.size >= 2) emit('kill', { size: e.size });
            break;
          case 'crystal':
            state.destroyed.add(i);
            state.crystals += 1;
            state.score += 25;
            emit('collect');
            break;
          case 'spring':
            state.destroyed.add(i);
            springHit = true;
            state.springs += 1;
            emit('spring');
            break;
          case 'train':
            state.destroyed.add(i);
            state.trains += 1;
            h.theta = clamp(h.theta + e.way * 14, -AIM.ROTATE_DEG, AIM.ROTATE_DEG);
            emit('train');
            break;
          case 'hazard':
            died = true;
            break;
          default:
            break;
        }
      } else if (e.type === 'hazard' && dist <= radius * 2.2) {
        nearMiss = true;
      }
    }

    if (smashed > 0) {
      h.combo += 1;
      if (h.combo > h.maxCombo) h.maxCombo = h.combo;
      emit('combo', { combo: h.combo });
      if (smashed >= 2) state.score += smashed * 5;
    } else if (hop.dropQueued) {
      h.combo = 0;
    }
    if (nearMiss) emit('nearMiss');
    emit('bounce', { y: Math.round(ny) });

    // 抵达关卡线 → 过关
    if (ny >= state.levelStartY + LEVELS[state.levelIndex].distance) {
      levelClear();
      if (state.phase === 'won' || state.phase === 'lost') return;
      startHop();
      return;
    }

    if (died) {
      state.phase = 'lost';
      state.won = false;
      state.reason = 'hazard';
      emit('die', { reason: 'hazard' });
      return;
    }

    // 弹力衰减（弹簧复位）
    if (springHit) h.E = HERO.E0;
    else h.E *= (1 - HERO.DECAY);
    if (h.E < HERO.EMIN) {
      state.phase = 'lost';
      state.won = false;
      state.reason = 'depleted';
      emit('die', { reason: 'depleted' });
      return;
    }

    startHop();
  }

  const run = {
    state,

    step(dt) {
      const s = state;
      if (s.phase === 'aim') {
        s.aimT += dt;
        s.autoLaunchT += dt;
        s.aimTheta = Math.sin(s.aimT * AIM.OSC_SPEED) * AIM.ROTATE_DEG;
        if (s.autoLaunchT >= AIM.AUTO_LAUNCH_SEC) {
          s.aimTheta = AIM.AUTO_THETA;
          run.launch();
        }
        return;
      }
      if (s.phase !== 'flying') return;
      const hop = s.hop;
      if (!hop) return;
      hop.t += dt;
      if (hop.t >= hop.T) resolveLanding();
    },

    setAim(theta) {
      state.aimTheta = clamp(theta, -AIM.ROTATE_DEG, AIM.ROTATE_DEG);
      return true;
    },

    launch() {
      if (state.phase !== 'aim') return { ok: false };
      const theta = clamp(state.aimTheta, -AIM.ROTATE_DEG, AIM.ROTATE_DEG);
      const shot = shotLevelFor(theta);
      let E = HERO.E0;
      if (shot === 0) { E *= HERO.PERFECT_E_BONUS; emit('perfect'); }
      state.hero.theta = theta;
      state.hero.E = E;
      state.phase = 'flying';
      emit('launch', { shot });
      startHop();
      return { ok: true };
    },

    steer(dir) {
      if (state.phase !== 'flying' || !state.hop) return { ok: false };
      if (state.hop.dropQueued) return { ok: false }; // 下砸锁定落点，不再可转向
      state.hop.lean = clamp(dir, -1, 1);
      return { ok: true };
    },

    drop() {
      if (state.phase !== 'flying' || !state.hop) return { ok: false };
      if (state.hop.dropQueued) return { ok: false };
      state.hop.dropQueued = true;
      state.hop.dropApex = state.hop.t >= state.hop.T / 2;
      return { ok: true };
    },

    drainEvents() {
      return state.events.splice(0);
    },

    getHud() {
      return {
        level: state.level,
        score: state.score,
        combo: state.hero.combo,
        maxCombo: state.hero.maxCombo,
        altitude: Math.round(state.hero.y / 10),
        aliensSmashed: state.aliensSmashed,
        crystals: state.crystals,
        phase: state.phase,
        reason: state.reason,
        stars: state.stars,
      };
    },
  };

  return run;
}

export { LEVELS, LEVEL_COUNT };
