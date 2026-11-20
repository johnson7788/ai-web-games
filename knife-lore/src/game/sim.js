// KNIFE LORE · 模拟/玩法核心（纯逻辑，零依赖，不碰 DOM/window/localStorage/Date.now）
// 契约：docs/knife-lore/README.md（事件名 / 接口签名一字不差）
//
// 核心循环（Knife Hit 品类 1:1 规则）：
//   中心旋转卷轴桩 → 点击掷刀 → 刀固定插在命中角（桩底 180°）→ 撞到已插的刀=崩刀判负 →
//   每关固定刀数/转速/转向 → 集满本关刀数 = 绽裂过关、解锁下一关。
// 原创改造：斩铁（每 3 关 1 次必中安全角度）、双桩对称加成（对称 ±15° 额外分）、
//   三场景包 / 方桩 / 移动桩 / 加速脉冲 / 间歇反转。
import { STEP, KNIFE, POST, normalizeDeg, angDist, clamp } from '../../config/gameplay.js';
import { levelAt, LEVEL_COUNT } from '../../config/levels.js';
import { mulberry32 } from './rng.js';

// ---------- 创建 run ----------
export function createRun({ seed = 0, levelIndex = 1 } = {}) {
  const rng = mulberry32(seed);
  const level = levelAt(levelIndex);

  const posts = [];
  if (level.shape === 'dual') {
    posts.push(makePost(0, POST.DUAL_X[0], POST.DUAL_Y, POST.DUAL_R, 1, level));
    posts.push(makePost(1, POST.DUAL_X[1], POST.DUAL_Y, POST.DUAL_R, -1, level));
  } else {
    posts.push(makePost(0, POST.SINGLE_X, POST.SINGLE_Y, POST.SINGLE_R, level.dir, level));
  }

  const run = {
    rng,
    seed: seed >>> 0,
    levelIndex: level.index,
    level,
    phase: 'playing', // playing | cleared | failed | won
    time: 0,
    posts,
    stuck: [], // { id, localAngle, postIndex }
    flying: null, // { id, postIndex, progress, safe }
    knivesThrown: 0,
    knivesRemaining: level.knives,
    score: 0,
    zantieCharges: level.zantie ? 1 : 0,
    zantieActive: false,
    nextId: 1,
    stats: { knivesStuck: 0, symBonuses: 0, levelsReached: level.index },
    events: [],
    _nextTarget: 0,
    _pulseOn: false,
    _revBucket: 0,
  };

  run.step = (input) => step(run, input);
  run.getHud = () => getHud(run);
  run.drainEvents = () => drainEvents(run);
  run.useZantie = () => useZantie(run);
  run.safeWindow = () => computeSafeArc(run, posts[0]);
  return run;
}

function makePost(id, x, y, radius, dir, level) {
  return { id, x, y, radius, dir, speedDeg: level.speedDeg, angle: 0, shape: level.shape };
}

// ---------- 每 tick ----------
export function step(run, input = {}) {
  if (run.phase !== 'playing') return;
  const dt = STEP;
  run.time += dt;

  updatePosts(run, dt); // 1 旋转 / 脉冲 / 反转 / 移动
  if (run.flying) { // 2 飞行刀推进，到站判定
    run.flying.progress += dt / KNIFE.FLIGHT_SEC;
    if (run.flying.progress >= 1) land(run, run.flying);
  }
  // 3 掷刀（一次只有一把飞行）
  if (run.phase === 'playing' && input.throw && !run.flying && run.knivesRemaining > 0) {
    spawn(run);
  }
  // 4 旋转反馈事件（遥测事件密度：桩持续旋转 = 每步一个可感知反馈，压死时间）
  emit(run, 'sweep', { angle: ((run.posts[0].angle % 360) + 360) % 360 });
}

// ---------- 旋转 / 脉冲 / 反转 / 移动 ----------
function updatePosts(run, dt) {
  const lvl = run.level;

  let pulseOn = false;
  if (lvl.pulse) pulseOn = (run.time % lvl.pulse.every) < lvl.pulse.dur;
  if (pulseOn !== run._pulseOn) {
    run._pulseOn = pulseOn;
    emit(run, pulseOn ? 'pulseStart' : 'pulseEnd', {});
  }

  if (lvl.reversal) {
    const bucket = Math.floor(run.time / lvl.reversal.every);
    if (bucket !== run._revBucket) {
      run._revBucket = bucket;
      for (const p of run.posts) p.dir = -p.dir;
      emit(run, 'reversal', { dir: run.posts[0].dir });
    }
  }

  const mult = pulseOn && lvl.pulse ? lvl.pulse.boost : 1;
  for (const p of run.posts) {
    p.angle = normalizeDeg(p.angle + p.dir * p.speedDeg * mult * dt);
  }

  if (lvl.shape === 'moving') {
    const p = run.posts[0];
    p.x = POST.SINGLE_X + POST.MOVE_AMP * Math.sin((2 * Math.PI * run.time) / POST.MOVE_PERIOD);
  }
}

// ---------- 掷刀 ----------
function spawn(run) {
  const idx = run._nextTarget;
  run._nextTarget = (run._nextTarget + 1) % run.posts.length;
  run.flying = { id: run.nextId++, postIndex: idx, progress: 0, safe: run.zantieActive };
  run.zantieActive = false;
  emit(run, 'throw', { postIndex: idx });
}

// ---------- 落地判定 ----------
function land(run, flying) {
  const post = run.posts[flying.postIndex];
  const postKnives = run.stuck.filter((s) => s.postIndex === flying.postIndex);

  let stickAngle = normalizeDeg(KNIFE.IMPACT_DEG - post.angle);
  if (flying.safe) {
    // 斩铁：必中安全角度 —— 吸附到最大空档中心
    const arc = computeSafeArc(run, post);
    stickAngle = arc.center;
  }

  const collide = postKnives.some((k) => angDist(stickAngle, k.localAngle) < KNIFE.GAP_DEG);
  run.flying = null;

  if (collide && !flying.safe) {
    run.phase = 'failed';
    emit(run, 'knifeBreak', { postIndex: flying.postIndex, localAngle: stickAngle, x: post.x, y: post.y });
    emit(run, 'death', {});
    return;
  }

  // 插入成功
  const prevOther = run.stuck.length ? run.stuck[run.stuck.length - 1] : null;
  run.stuck.push({ id: run.nextId++, localAngle: stickAngle, postIndex: flying.postIndex });
  run.knivesThrown += 1;
  run.score += KNIFE.SCORE;
  const worldAngle = normalizeDeg(post.angle + stickAngle);
  emit(run, 'knifeStick', {
    postIndex: flying.postIndex, localAngle: stickAngle, worldAngle, x: post.x, y: post.y, score: KNIFE.SCORE,
  });

  // 对称加成（双桩）：上一把刀落在另一根桩，且局部角度差 ≤ SYM_DEG
  if (run.level.shape === 'dual' && prevOther && prevOther.postIndex !== flying.postIndex
      && angDist(stickAngle, prevOther.localAngle) <= KNIFE.SYM_DEG) {
    run.score += KNIFE.SYM_BONUS;
    run.stats.symBonuses += 1;
    emit(run, 'symBonus', { postIndex: flying.postIndex, bonus: KNIFE.SYM_BONUS });
  }

  run.stats.knivesStuck += 1;
  run.knivesRemaining = run.level.knives - run.knivesThrown;

  if (run.knivesThrown >= run.level.knives) {
    const bonus = run.level.index * 25;
    run.score += bonus;
    emit(run, 'levelCleared', { level: run.level.index, bonus });
    if (run.level.index >= LEVEL_COUNT) {
      run.phase = 'won';
      emit(run, 'gameWon', { score: run.score });
    } else {
      run.phase = 'cleared';
    }
  }
}

// ---------- 斩铁 ----------
function useZantie(run) {
  if (run.phase !== 'playing' || run.zantieCharges <= 0 || run.zantieActive) return false;
  run.zantieCharges -= 1;
  run.zantieActive = true;
  emit(run, 'zantie', {});
  return true;
}

// ---------- 安全空档 ----------
// 找某根桩上两把已插刀之间的最大空档（局部角度空间），返回 { center, width }。
export function computeSafeArc(run, post) {
  const locals = run.stuck
    .filter((s) => s.postIndex === post.id)
    .map((s) => s.localAngle)
    .sort((a, b) => a - b);
  if (!locals.length) return { center: 0, width: 360 };
  let best = { center: 0, width: 0 };
  for (let i = 0; i < locals.length; i += 1) {
    const a = locals[i];
    const b = i === locals.length - 1 ? locals[0] + 360 : locals[i + 1];
    const gap = b - a;
    if (gap > best.width) {
      best.width = gap;
      best.center = normalizeDeg(a + gap / 2);
    }
  }
  return best;
}

// ---------- HUD / 事件 ----------
function getHud(run) {
  return {
    level: run.level.index,
    pack: run.level.pack,
    knives: run.level.knives,
    knivesRemaining: run.knivesRemaining,
    score: run.score,
    zantieCharges: run.zantieCharges,
    zantieActive: run.zantieActive,
    safeArc: computeSafeArc(run, run.posts[0]),
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

export { clamp };
