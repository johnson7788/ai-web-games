// SPIN CYCLE ORBIT · 纯逻辑 sim（无 DOM，可 Node 无头跑）
// 骨架 1:1 复刻原作「转圈圈」：双球互绕 + 目标链 + 命中窗口切换。
// 新机制：连击 / 节点类型（金核·岩核）/ 难度递进 + 狂热。
// 导出 createRun(seed) → 单局状态机；step() 固定 60Hz 一帧；tap() 触发切换。

import { ORBIT } from '../../config/game.config.js';

const { BALL_DISTANCE, ROT_SPEED, ANGLE_RANGE, VISIBLE_TARGETS } = ORBIT;

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

// 节点类型：按 num 的确定性规则生成（可测、可预测、可复现）
export function kindForNum(num) {
  if (num % 7 === 0) return 'golden';
  if (num % 5 === 0) return 'rock';
  return 'normal';
}

function dist(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.hypot(dx, dy);
}

export function createRun(seed = 1) {
  const rng = mulberry32(seed || 1);
  const state = {
    phase: 'playing',   // playing | over
    over: false,
    overReason: null,

    time: 0,            // 秒（固定步长累加）
    steps: 0,           // 已生成目标总数
    captures: 0,        // 成功捕获数
    score: 0,
    combo: 0,
    maxCombo: 0,
    lastCaptureTime: -Infinity,
    level: 1,
    frenzyUntil: 0,

    anchor: { x: 0, y: 0 },        // 非旋转锚球
    orbiter: { x: 0, y: BALL_DISTANCE }, // 旋转球（初始在正下方/上方，角度 0）
    angle: 0,                       // 弧度
    dir: rng() < 0.5 ? -1 : 1,
    rotSpeed: ROT_SPEED,
    destroy: false,                 // 命中窗口（nearMiss 提示）是否已开
    hadChance: false,               // 旋转球是否已进入可捕获区（d<20），用于公平 overshoot
    nodes: [],                      // [{x,y,kind,num}]；nodes[0] 锚点，nodes[1] 下一目标
    camX: 0,
    camY: 0,
  };

  const events = [];

  function emit(type, payload = {}) {
    events.push({ type, ...payload });
  }

  // 新目标：从链尾向随机角度延伸 BALL_DISTANCE
  function addTarget() {
    state.steps += 1;
    const last = state.nodes[state.nodes.length - 1];
    const min = Math.min(ANGLE_RANGE[0], ANGLE_RANGE[1]);
    const max = Math.max(ANGLE_RANGE[0], ANGLE_RANGE[1]);
    const angleDeg = min + rng() * (max - min);
    const rad = (angleDeg * Math.PI) / 180;
    state.nodes.push({
      x: last.x + BALL_DISTANCE * Math.cos(rad),
      y: last.y + BALL_DISTANCE * Math.sin(rad),
      kind: kindForNum(state.steps),
      num: state.steps,
    });
  }

  // 初始化：锚点节点 + VISIBLE_TARGETS 个后续目标
  function initNodes() {
    state.nodes = [{ x: state.anchor.x, y: state.anchor.y, kind: 'normal', num: 0 }];
    for (let i = 0; i < VISIBLE_TARGETS; i += 1) addTarget();
  }

  function effectiveSpeed() {
    const frenzy = state.time < state.frenzyUntil;
    return state.rotSpeed * (frenzy ? ORBIT.FRENZY_MULT : 1);
  }

  function nextDistance() {
    if (!state.nodes[1]) return Infinity;
    return dist(state.orbiter, state.nodes[1]);
  }

  function gameOver(reason) {
    if (state.over) return;
    state.over = true;
    state.phase = 'over';
    state.overReason = reason;
    emit('lose', { reason, score: state.score, level: state.level });
  }

  function capture() {
    const node = state.nodes[1];
    const kind = node.kind;
    if (kind === 'rock') {
      state.combo = 0;
      emit('rock', { num: node.num, score: state.score });
      emit('comboBreak', { combo: 0 });
    } else {
      state.combo += 1;
      if (state.combo > state.maxCombo) state.maxCombo = state.combo;
      if (kind === 'golden') {
        state.score += 3;
        emit('golden', { num: node.num, score: state.score, combo: state.combo });
      } else {
        state.score += Math.min(state.combo, 8); // 连击上限 ×8
        emit('capture', { num: node.num, score: state.score, combo: state.combo });
      }
      if (state.combo >= 2) emit('combo', { combo: state.combo });
    }
    state.lastCaptureTime = state.time;

    // 几何切换：锚点移到被捕获节点（旧旋转球），旧锚点变成新的旋转球
    const newAnchor = { x: state.orbiter.x, y: state.orbiter.y };
    const newOrbiter = { x: state.anchor.x, y: state.anchor.y };
    state.nodes.shift();
    state.anchor = newAnchor;
    state.orbiter = newOrbiter;
    state.dir = rng() < 0.5 ? -1 : 1;
    state.angle = Math.atan2(-(state.orbiter.x - state.anchor.x), state.orbiter.y - state.anchor.y);
    state.destroy = false;
    state.hadChance = false;
    addTarget();
    state.captures += 1;
    emit('armSwitch', { captures: state.captures });

    // 难度递进
    const newLevel = 1 + Math.floor(state.captures / ORBIT.LEVEL_EVERY);
    if (newLevel > state.level) {
      state.level = newLevel;
      state.rotSpeed = ROT_SPEED * (1 + Math.min(0.8, state.captures * 0.02));
      emit('levelUp', { level: state.level });
    }

    // 狂热
    if (state.captures > 0 && state.captures % ORBIT.FRENZY_EVERY === 0) {
      state.frenzyUntil = state.time + ORBIT.FRENZY_SECONDS;
      emit('frenzyStart', { until: state.frenzyUntil });
    }
  }

  initNodes();
  emit('start', { seed });

  return {
    state,

    /** 固定 60Hz 一帧推进（忽略 dt 参数，保证确定性） */
    step(_dt = 1 / 60) {
      if (state.over) return;
      state.time += 1 / 60;

      // 连击窗口过期
      if (state.combo > 0 && state.time - state.lastCaptureTime > ORBIT.COMBO_WINDOW) {
        state.combo = 0;
        emit('comboBreak', { combo: 0, idle: true });
      }

      // 狂热结束
      if (state.frenzyUntil > 0 && state.time >= state.frenzyUntil) {
        state.frenzyUntil = 0;
        emit('frenzyEnd', {});
      }

      // 旋转
      state.angle += (effectiveSpeed() * Math.PI) / 180 * state.dir;
      state.orbiter.x = state.anchor.x - BALL_DISTANCE * Math.sin(state.angle);
      state.orbiter.y = state.anchor.y + BALL_DISTANCE * Math.cos(state.angle);

      // 命中窗口 / overshoot（steps > VISIBLE_TARGETS 为原作 grace 期）
      const d = nextDistance();
      if (d < ORBIT.WINDOW_DIST && !state.destroy) {
        state.destroy = true;
        emit('nearMiss', { dist: Math.round(d) });
      }
      if (d < ORBIT.CAPTURE_DIST) state.hadChance = true;
      if (d > ORBIT.OVERSHOOT_DIST && state.hadChance && (state.captures > 0 || state.time > ORBIT.GRACE_SECONDS)) {
        gameOver('overshoot');
      }

      // 相机跟随锚点（屏幕定位由 renderer 负责；此处只把锚点当世界焦点）
      const tx = state.anchor.x;
      const ty = state.anchor.y;
      state.camX += (tx - state.camX) * 0.06;
      state.camY += (ty - state.camY) * 0.06;
    },

    /** 玩家动作：在命中窗口内切换到下一节点，否则游戏结束 */
    tap() {
      if (state.phase !== 'playing') return { ok: false, reason: 'not-playing' };
      if (state.over) return { ok: false, reason: 'over' };
      if (nextDistance() < ORBIT.CAPTURE_DIST) {
        capture();
        return { ok: true };
      }
      gameOver('miss');
      return { ok: false, reason: 'miss' };
    },

    /** 事件表（main / selfplay 消费后清空） */
    drainEvents() {
      return events.splice(0, events.length);
    },

    getHud() {
      return {
        score: state.score,
        combo: state.combo,
        maxCombo: state.maxCombo,
        level: state.level,
        time: state.time,
        frenzy: state.time < state.frenzyUntil,
        captures: state.captures,
      };
    },

    nextDistance,
  };
}
