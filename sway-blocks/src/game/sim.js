// 纯逻辑：摇摆积木玩法装配（搭在 physics.js 之上）。
// 无 DOM / 无随机（关卡固定），可被 node --test 与 tools/selfplay.mjs 直接 import。
// 玩法：积木挂在锚点上摆动 → 点击松手落下 → 全部落完进入平衡倒计时 → 稳住即过关，坠落即失败。
import {
  makeWorld, makeBody, makeBox, makeCircle, makePoly, makeDistanceJoint, V,
} from './physics.js';
import { LEVELS } from '../../config/levels.js';
import { GAME } from '../../config/game.config.js';

// 确定性伪随机（selfplay 的 random 策略用）
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 形状构造
function blockShape(spec) {
  if (spec.shape === 'circle') return makeCircle(spec.w / 2);
  if (spec.shape === 'triangle') {
    const w = spec.w;
    // 顶点（y 向下，屏幕顺时针绕行：顶 → 右下 → 左下）
    return makePoly([V(0, -0.62 * w), V(0.5 * w, 0.42 * w), V(-0.5 * w, 0.42 * w)]);
  }
  // box / rock
  return makeBox(spec.w / 2, (spec.h || spec.w) / 2);
}

function blockPhysics(type) {
  switch (type) {
    case 'slippery':
      return { density: 1.0, friction: 0.03, restitution: 0.05 };
    case 'bouncy':
      return { density: 1.0, friction: 0.45, restitution: 0.55 };
    case 'rock':
      return { density: 2.6, friction: 0.72, restitution: 0.0 };
    default:
      return { density: 1.0, friction: 0.55, restitution: 0.05 };
  }
}

function createRun(levelIndex, opts = {}) {
  const level = LEVELS[levelIndex];
  const world = makeWorld(V(0, GAME.GRAVITY));

  // 平台（静态或运动学）
  const platforms = level.platforms.map((p) => {
    if (p.dot) {
      const r = p.dotR || 13;
      const body = makeBody(makeCircle(r), p.x, p.y, { isStatic: true, friction: 0.6 });
      body._kin = null;
      return { spec: p, body, dot: true, r };
    }
    const body = makeBody(makeBox(p.w / 2, p.h / 2), p.x, p.y, {
      isStatic: true, friction: 0.6, angle: ((p.angle || 0) * Math.PI) / 180,
    });
    if (p.moving) {
      body._kin = { baseX: p.x, baseY: p.y, dx: p.moving[0], dy: p.moving[1], period: p.moving[2], t: 0 };
    } else {
      body._kin = null;
    }
    world.addBody(body);
    return { spec: p, body, dot: false };
  });

  // 锚点（静态小体，仅作关节 A 端）
  const anchors = level.blocks.map((b) => {
    const body = makeBody(makeCircle(2), b.anchorX, GAME.ANCHOR_Y, { isStatic: true });
    world.addBody(body);
    return body;
  });

  const blocks = [];
  const events = [];

  const state = {
    level: levelIndex + 1,
    phase: 'swinging',
    time: 0,
    score: 0,
    combo: 0,
    maxCombo: 0,
    perfects: 0,
    placed: 0,
    total: level.blocks.length,
    balanceTime: 0,
    stars: 0,
    won: false,
    ropeAngle: 0,
    ropeActive: false,
    anchor: null,
    blocks,
    platforms,
    spawnTimer: 0,
    autoDropTimer: 0,
    currentIndex: -1,
    currentBlock: null,
  };

  function emit(type, payload = {}) {
    events.push({ type, ...payload });
  }

  function spawnBlock(i) {
    if (i >= level.blocks.length) {
      // 全部落完 → 平衡阶段
      state.phase = 'balancing';
      state.balanceTime = GAME.BALANCE_SEC;
      state.currentBlock = null;
      state.ropeActive = false;
      state.anchor = null;
      emit('balance', { balanceTime: GAME.BALANCE_SEC });
      return;
    }
    const spec = level.blocks[i];
    const phys = blockPhysics(spec.type);
    const shape = blockShape(spec);
    const ax = spec.anchorX;
    const ay = GAME.ANCHOR_Y;
    const px = ax + Math.sin(spec.startAngle) * spec.rodLength;
    const py = ay + Math.cos(spec.startAngle) * spec.rodLength;
    const body = makeBody(shape, px, py, { ...phys, angle: 0 });
    world.addBody(body);
    const anchor = anchors[i];
    const joint = makeDistanceJoint(anchor, body, V(0, 0), V(0, 0), spec.rodLength);
    world.addJoint(joint);
    const rec = {
      spec,
      body,
      anchor,
      joint,
      dropped: false,
      dead: false,
      landed: false,
      maxVy: 0,
      index: i,
    };
    blocks.push(rec);
    state.currentIndex = i;
    state.currentBlock = rec;
    state.ropeActive = true;
    state.anchor = { x: ax, y: ay };
    state.ropeAngle = spec.startAngle;
    state.autoDropTimer = 0;
    state.spawnTimer = 0;
    emit('spawn', { index: i, shape: spec.shape, blockType: spec.type });
  }

  function drop() {
    const rec = state.currentBlock;
    if (!rec || rec.dropped || state.phase !== 'swinging') return { ok: false };
    const body = rec.body;
    // 松手：切绳 + 水平速度手感辅助（垂直主落下，保留少量漂移）
    if (rec.joint) world.removeJoint(rec.joint);
    rec.joint = null;
    body.vx *= GAME.DROP_DAMP;
    rec.dropped = true;
    state.placed += 1;

    // 完美判定：绳近竖直（积木在锚点正下方）
    const dx = body.x - state.anchor.x;
    const dy = body.y - state.anchor.y;
    const ropeAngle = Math.atan2(dx, dy);
    const perfect = Math.abs(ropeAngle) < GAME.PERFECT_RAD;
    if (perfect) {
      state.combo += 1;
      state.maxCombo = Math.max(state.maxCombo, state.combo);
      state.score += GAME.COMBO_SCORE * state.combo;
      state.perfects += 1;
      emit('perfect', { index: rec.index, combo: state.combo, ropeAngle });
    } else {
      state.combo = 0;
      state.score += GAME.DROP_SCORE;
      emit('drop', { index: rec.index, ropeAngle });
    }

    state.currentBlock = null;
    state.ropeActive = false;
    state.spawnTimer = GAME.SPAWN_DELAY_SEC;
    return { ok: true, perfect };
  }

  function stepKinematics(dt) {
    for (const p of platforms) {
      const kin = p.body._kin;
      if (!kin) continue;
      kin.t += dt;
      const phase = (kin.t / kin.period) * Math.PI * 2;
      const ox = kin.dx * Math.sin(phase);
      const oy = kin.dy * Math.sin(phase);
      const nx = kin.baseX + ox;
      const ny = kin.baseY + oy;
      // 运动学速度（供接触相对速度用）
      const dphase = (2 * Math.PI / kin.period) * dt;
      p.body.vx = kin.dx * Math.cos(phase) * (2 * Math.PI / kin.period);
      p.body.vy = kin.dy * Math.cos(phase) * (2 * Math.PI / kin.period);
      p.body.x = nx;
      p.body.y = ny;
      void dphase;
    }
  }

  function updateRopeAngle() {
    const rec = state.currentBlock;
    if (rec && rec.dropped === false) {
      const dx = rec.body.x - state.anchor.x;
      const dy = rec.body.y - state.anchor.y;
      state.ropeAngle = Math.atan2(dx, dy);
    } else {
      state.ropeAngle = 0;
    }
  }

  function checkFalls() {
    for (const rec of blocks) {
      if (rec.dead) continue;
      if (rec.body.y > GAME.FALL_Y) {
        rec.dead = true;
        if (state.phase === 'swinging' || state.phase === 'balancing') {
          state.phase = 'lost';
          state.won = false;
          emit('lose', { reason: 'fall', index: rec.index });
        }
      }
    }
  }

  function detectLandings() {
    for (const rec of blocks) {
      if (!rec.dropped || rec.dead || rec.landed) continue;
      if (rec.body.vy > rec.maxVy) rec.maxVy = rec.body.vy;
      if (rec.maxVy > 260 && rec.body.vy < 40) {
        rec.landed = true;
        emit('land', { index: rec.index });
      }
    }
  }

  function tickBalance(dt) {
    if (state.phase !== 'balancing') return;
    const prev = state.balanceTime;
    state.balanceTime -= dt;
    // 每秒一个 tick 事件（保持事件密度）
    const prevSec = Math.ceil(prev);
    const newSec = Math.ceil(state.balanceTime);
    if (state.balanceTime <= 0) {
      state.phase = 'won';
      state.won = true;
      state.stars = computeStars();
      emit('win', { stars: state.stars, score: state.score, perfects: state.perfects });
    } else if (newSec < prevSec && state.balanceTime > 0) {
      emit('tick', { timeLeft: state.balanceTime });
    }
  }

  function computeStars() {
    let stars = 1;
    if (state.perfects >= GAME.STAR2_PERFECTS) stars = 2;
    if (state.perfects >= Math.max(GAME.STAR3_RATIO * state.total, 2)) stars = 3;
    return stars;
  }

  function step(dt) {
    state.time += dt;
    if (state.phase === 'won' || state.phase === 'lost') {
      // 终局仍推进物理，方便渲染收尾
      stepKinematics(dt);
      world.step(dt);
      return;
    }

    stepKinematics(dt);

    // 摆动阶段：生成计时 / 自动松手兜底
    if (state.phase === 'swinging') {
      if (!state.currentBlock) {
        state.spawnTimer -= dt;
        if (state.spawnTimer <= 0) {
          if (state.currentIndex >= state.total - 1) {
            // 最后一块已落，稍候进入平衡
            state.phase = 'balancing';
            state.balanceTime = GAME.BALANCE_SEC;
            emit('balance', { balanceTime: GAME.BALANCE_SEC });
          } else {
            spawnBlock(state.currentIndex + 1);
          }
        }
      } else if (state.currentBlock) {
        state.autoDropTimer += dt;
        if (state.autoDropTimer >= GAME.AUTO_DROP_SEC) {
          drop();
        }
      }
    }

    world.step(dt);
    updateRopeAngle();
    checkFalls();
    detectLandings();
    tickBalance(dt);
  }

  // 首块立即出现
  spawnBlock(0);

  const run = {
    state,
    world,
    level,
    _level: level,
    step,
    drop,
    drainEvents() {
      const out = events.splice(0, events.length);
      return out;
    },
    getHud() {
      return {
        level: state.level,
        phase: state.phase,
        placed: state.placed,
        total: state.total,
        score: state.score,
        combo: state.combo,
        perfects: state.perfects,
        balanceTime: Math.max(0, state.balanceTime),
        stars: state.stars,
      };
    },
    // 供 bot：当前摆角是否落在完美窗口
    perfectNow() {
      return state.ropeActive && state.currentBlock && Math.abs(state.ropeAngle) < GAME.PERFECT_RAD;
    },
  };

  return run;
}

export { createRun };
