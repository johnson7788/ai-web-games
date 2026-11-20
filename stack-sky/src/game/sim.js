// STACK SKY · M1 模拟/玩法核心（纯逻辑，零依赖，不碰 DOM/window/Date.now）
// 契约：docs/README.md（事件名 / 接口签名一字不差）
import {
  WORLD, STEP, STACK, WIND, SHRINE, CAMERA, clamp, islandTheme,
} from '../../config/gameplay.js';
import { segmentAt, segmentIndex, scenePackAt } from '../../config/levels.js';
import { mulberry32 } from './rng.js';

// ---------- 创建 run ----------
export function createRun({ seed = 0 } = {}) {
  const rng = mulberry32(seed);
  const baseX = WORLD.WIDTH / 2;
  const baseY = WORLD.GROUND_Y;
  const run = {
    rng,
    seed: seed >>> 0,
    phase: 'playing',
    time: 0,
    score: 0,                 // 已叠层数（= 高度）
    segment: 1,
    scene: 0,
    top: { x: baseX, width: STACK.START_WIDTH },   // 塔顶（最上层岛）中心 x + 宽度
    topY: baseY - STACK.BLOCK_H,                   // 移动岛底边应放置的 y（塔顶表面）
    moving: { x: baseX, width: STACK.START_WIDTH, dir: 1, speed: 300 },
    layers: [{ x: baseX, width: STACK.START_WIDTH, y: baseY, theme: 'base' }], // 每层 {x,width,y(底边),theme}
    perfectCombo: 0,
    maxCombo: 0,
    cloudWrap: false,
    cloudWrapAt: -Infinity,
    windTier: 0,
    windActive: false,
    windDrift: 0,
    windDir: 1,
    windTime: 0,
    shrineDue: false,
    _prevDrop: false,
    stats: { score: 0, maxCombo: 0, segment: 1, perfects: 0, cuts: 0 },
    events: [],
  };

  initMoving(run);
  updateSegmentAndScene(run);

  run.step = (input) => step(run, input);
  run.getHud = () => getHud(run);
  run.drainEvents = () => drainEvents(run);
  return run;
}

// ---------- 每 tick ----------
export function step(run, input = {}) {
  if (run.phase !== 'playing') return;
  run.time += STEP;

  const dropPressed = !!input.drop && !run._prevDrop;
  run._prevDrop = !!input.drop;

  updateSegmentAndScene(run);
  updateWind(run);

  // 截停：在「观察到移动岛位置」的这一刻就落地（先判定再移动），
  // 避免「按下的那一帧还多滑一段」造成额外偏移。
  if (dropPressed) placeBlock(run);
  else updateMoving(run);
}

// ---------- 移动岛（左右往复 + 风切横漂）----------
function initMoving(run) {
  const m = run.moving;
  m.width = run.top.width;
  m.speed = segmentAt(run.score).speed;
  const half = STACK.OSC_RANGE;
  const lo = Math.max(m.width / 2, run.top.x - half);
  const hi = Math.min(WORLD.WIDTH - m.width / 2, run.top.x + half);
  // 从较近的一侧开始，避免初始就贴着塔心
  m.x = (run.top.x - lo) < (hi - run.top.x) ? lo : hi;
  m.dir = m.x <= lo ? 1 : -1;

  // 风切 / 神龛：对「即将放置」的这一层判定
  const upcoming = run.score + 1;
  if (run.windTier > 0 && upcoming % WIND.EVERY_LAYERS === 0) {
    triggerWind(run);
  }
  run.shrineDue = upcoming % SHRINE.EVERY_LAYERS === 0;
  if (run.shrineDue) emit(run, 'shrineReady', { layer: upcoming });
}

function updateMoving(run) {
  const m = run.moving;
  const half = STACK.OSC_RANGE;
  let lo = Math.max(m.width / 2, run.top.x - half);
  let hi = Math.min(WORLD.WIDTH - m.width / 2, run.top.x + half);
  if (hi <= lo) { lo = run.top.x; hi = run.top.x; }

  const drift = run.windActive ? run.windDrift * run.windDir : 0;
  m.x += (m.dir * m.speed + drift) * STEP;

  if (m.x <= lo) {
    m.x = lo;
    m.dir = 1;
    emit(run, 'swing', { edge: 'left' });
  } else if (m.x >= hi) {
    m.x = hi;
    m.dir = -1;
    emit(run, 'swing', { edge: 'right' });
  }

  // 细粒度里程碑：移动岛持续扫动是本作的核心可感知反馈（每步一个 move，压死事件间隔与空转）
  emit(run, 'move', { x: Math.round(m.x) });
}

// ---------- 风切 ----------
function triggerWind(run) {
  run.windActive = true;
  run.windDir = run.rng() < 0.5 ? -1 : 1;
  run.windDrift = WIND.STRENGTH[Math.min(run.windTier, WIND.STRENGTH.length - 1)];
  run.windTime = WIND.DURATION_SEC;
  emit(run, 'windGust', { dir: run.windDir, strength: run.windDrift });
}

function updateWind(run) {
  if (!run.windActive) return;
  run.windTime -= STEP;
  if (run.windTime <= 0) {
    run.windActive = false;
    run.windDrift = 0;
  }
}

// ---------- 段位 / 场景 ----------
function updateSegmentAndScene(run) {
  const seg = segmentIndex(run.score);
  if (seg !== run.segment) {
    run.segment = seg;
    if (seg > run.stats.segment) run.stats.segment = seg;
    emit(run, 'segmentEnter', { segment: seg, name: `seg.${seg}` });
  }
  const sc = scenePackAt(run.score);
  if (sc !== run.scene) {
    run.scene = sc;
    emit(run, 'sceneEnter', { scene: sc });
  }
  run.windTier = segmentAt(run.score).wind;
}

// ---------- 截停放置 ----------
function placeBlock(run) {
  const m = run.moving;
  const top = run.top;
  const overlapLeft = Math.max(m.x - m.width / 2, top.x - top.width / 2);
  const overlapRight = Math.min(m.x + m.width / 2, top.x + top.width / 2);
  const overlapWidth = overlapRight - overlapLeft;
  const offset = Math.abs(m.x - top.x);

  if (overlapWidth <= 0) {
    die(run, 'miss');
    return;
  }
  if (overlapWidth < STACK.MIN_WIDTH) {
    die(run, 'narrow');
    return;
  }

  const cutWidth = m.width - overlapWidth;
  const newCenter = (overlapLeft + overlapRight) / 2;
  let width = overlapWidth;
  let isPerfect = false;
  let shrineHit = false;

  if (run.shrineDue) {
    // 神龛层：对齐纹样（|偏移| 小）→ 恢复初始宽度
    if (offset <= SHRINE.TOLERANCE) {
      width = STACK.START_WIDTH;
      shrineHit = true;
      emit(run, 'shrineSuccess', { x: newCenter });
    }
    run.shrineDue = false;
  }

  if (!shrineHit && offset <= STACK.PERFECT_TOLERANCE) {
    isPerfect = true;
    width = Math.min(STACK.START_WIDTH, overlapWidth + STACK.PERFECT_RECOVER);
  }

  if (isPerfect) {
    run.perfectCombo += 1;
    run.stats.perfects += 1;
    emit(run, 'perfect', { combo: run.perfectCombo, x: newCenter });
    emit(run, 'comboUp', { combo: run.perfectCombo });
    if (run.perfectCombo >= STACK.CLOUD_WRAP_COMBO && !run.cloudWrap) {
      run.cloudWrap = true;
      run.cloudWrapAt = run.time;
      emit(run, 'cloudWrap', {});
    }
  } else {
    run.perfectCombo = 0;
    if (cutWidth > 0.5) {
      run.stats.cuts += 1;
      emit(run, 'cut', { x: m.x, cutWidth, offset });
      if (cutWidth <= STACK.NEAR_MISS_CUT) emit(run, 'nearMiss', { x: newCenter, offset });
    }
  }

  if (run.perfectCombo > run.maxCombo) run.maxCombo = run.perfectCombo;

  // 落地：新岛底边 = 塔顶表面
  const placedY = run.topY;
  run.layers.push({ x: newCenter, width, y: placedY, theme: islandTheme(run.score) });
  run.top = { x: newCenter, width };
  run.topY = placedY - STACK.BLOCK_H;
  run.score += 1;
  run.stats.score = run.score;

  emit(run, 'drop', { x: newCenter, width, layer: run.score, offset });
  emit(run, 'milestone', { layer: run.score });

  initMoving(run);
}

function die(run, reason) {
  if (run.phase !== 'playing') return;
  run.phase = 'dead';
  emit(run, 'death', { reason, score: run.score });
}

// ---------- HUD / 事件 ----------
function getHud(run) {
  return {
    score: run.score,
    height: run.score,
    width: run.top.width,
    combo: run.perfectCombo,
    maxCombo: run.maxCombo,
    segment: run.segment,
    scene: run.scene,
    windTier: run.windTier,
    windActive: run.windActive,
    shrineDue: run.shrineDue,
    cloudWrap: run.cloudWrap,
    phase: run.phase,
  };
}

function emit(run, type, fields = {}) {
  run.events.push({ type, ...fields });
}

function drainEvents(run) {
  const ev = run.events;
  run.events = [];
  return ev;
}

// 兼容旧骨架（main 不再使用，保留 createSim/updateSim 别名）
export function createSim() {
  return createRun({ seed: 0 });
}

export function updateSim(run, input = {}) {
  run.step({ drop: !!input.drop });
}

// 相机世界偏移：塔顶固定出现在 CAMERA.TARGET_SCREEN_Y（前几层镜头不动）
export function cameraYFor(run) {
  return Math.min(0, run.topY - CAMERA.TARGET_SCREEN_Y);
}
