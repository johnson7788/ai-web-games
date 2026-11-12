// AI：枚举「目标球 × 6 袋」的 ghost ball 线路，过滤被挡与洗袋风险线路，
// 取成功率最高的一条；无解则打安全球（轻碰最近合法球）。纯逻辑，随机来自注入的 rng。
import { AI, BALL, PLAY, POCKETS, RULES, TABLE } from '../../config/game.config.js';
import { insidePlay, segmentBlocked } from './geometry.js';
import { CUE, EIGHT, kindOf } from './balls.js';

const MAX_CUT = (RULES.MAX_CUT_DEG * Math.PI) / 180;
const BLOCK_R = BALL.DIAM * 0.94;
const TABLE_LEN = PLAY.right - PLAY.left;
const DEG = Math.PI / 180;

function blockersFor(world, targetId) {
  return world.balls.filter((b) => b.alive && b.id !== CUE && b.id !== targetId);
}

// 白球切分后沿切线滚出，若直指袋口则有洗袋风险 → 该线路降权。
function scratchRisk(fromX, fromY, dirX, dirY) {
  const len = Math.hypot(dirX, dirY);
  if (len < 1e-6) return false;
  const ux = dirX / len;
  const uy = dirY / len;
  const limit = TABLE.POCKET_R + BALL.R * 0.6;
  for (const p of POCKETS) {
    const ex = p.x - fromX;
    const ey = p.y - fromY;
    const t = ex * ux + ey * uy;
    if (t <= 0 || t > TABLE_LEN) continue;
    if (Math.abs(ex * uy - ey * ux) < limit) return true;
  }
  return false;
}

// cue 为白球（或候选摆位点）；返回按得分降序的可行线路。
export function findLines(world, targets, cue = null) {
  const ball = cue || world.balls.find((b) => b.alive && b.id === CUE);
  if (!ball) return [];
  const lines = [];
  for (const t of targets) {
    if (!t || !t.alive || t.id === CUE) continue;
    for (let pi = 0; pi < POCKETS.length; pi += 1) {
      const p = POCKETS[pi];
      const pdx = p.x - t.x;
      const pdy = p.y - t.y;
      const potDist = Math.hypot(pdx, pdy);
      if (potDist < 1e-6) continue;
      const nx = pdx / potDist;
      const ny = pdy / potDist;
      const gx = t.x - nx * BALL.DIAM;
      const gy = t.y - ny * BALL.DIAM;
      if (!insidePlay(gx, gy)) continue;
      const cdx = gx - ball.x;
      const cdy = gy - ball.y;
      const cueDist = Math.hypot(cdx, cdy);
      if (cueDist < BALL.R) continue;
      const cos = (cdx / cueDist) * nx + (cdy / cueDist) * ny;
      if (cos <= 0) continue;
      const cut = Math.acos(Math.min(1, cos));
      if (cut > MAX_CUT) continue;

      const blockers = blockersFor(world, t.id);
      if (segmentBlocked(ball.x, ball.y, gx, gy, blockers, BLOCK_R)) continue;
      if (segmentBlocked(t.x, t.y, p.x, p.y, blockers, BLOCK_R)) continue;

      const cutScore = 1 - cut / MAX_CUT;
      const distScore = 900 / (900 + cueDist + potDist);
      let score = cutScore * cutScore * distScore;
      if (scratchRisk(gx, gy, cdx - nx * cos * cueDist, cdy - ny * cos * cueDist)) {
        score *= AI.SCRATCH_PENALTY;
      }
      lines.push({ targetId: t.id, pocket: pi, angle: Math.atan2(cdy, cdx), cueDist, potDist, cut, score });
    }
  }
  lines.sort((a, b) => b.score - a.score);
  return lines;
}

// 当前回合的合法先碰目标集合：清完本组打 8 号；未定花色时除 8 号外任意。
export function legalTargets(world, group, cleared) {
  const live = world.balls.filter((b) => b.alive && b.id !== CUE);
  if (cleared) return live.filter((b) => b.id === EIGHT);
  if (!group) {
    const open = live.filter((b) => b.id !== EIGHT);
    return open.length ? open : live;
  }
  const mine = live.filter((b) => kindOf(b.id) === group);
  return mine.length ? mine : live.filter((b) => b.id === EIGHT);
}

function powerFor(cueDist, potDist) {
  const raw = 0.26 + (cueDist + potDist) / (TABLE_LEN * 3);
  return Math.max(0.24, Math.min(0.72, raw));
}

function nearestTarget(targets, cue) {
  let nearest = null;
  let bestD = Infinity;
  for (const t of targets) {
    const d = Math.hypot(t.x - cue.x, t.y - cue.y);
    if (d < bestD) {
      bestD = d;
      nearest = t;
    }
  }
  return nearest;
}

// 轻碰最近合法球：保证 AI 无解时也有合法出杆，不会卡死。
function safetyShot(targets, cue, err, rng) {
  const nearest = nearestTarget(targets, cue);
  if (!nearest) return null;
  return {
    angle: Math.atan2(nearest.y - cue.y, nearest.x - cue.x) + rng.range(-1, 1) * err.angle * DEG,
    power: clampPower(AI.SAFETY_POWER + rng.range(-1, 1) * err.power),
    kind: 'safety',
    targetId: nearest.id,
    score: 0,
  };
}

function clampPower(p) {
  return Math.max(RULES.MIN_POWER, Math.min(1, p));
}

// 选一条最佳线路并按难度加角度/力度误差；无线路 → 安全球。恒返回结果或 null（台面已空）。
export function planShot(world, opts) {
  const { targets, level, rng, isBreak } = opts;
  const cue = world.balls.find((b) => b.alive && b.id === CUE);
  if (!cue) return null;
  const err = AI.LEVELS[level] || AI.LEVELS.club;

  if (isBreak) {
    // 开球：正对球堆顶点，接近满力度
    let apex = null;
    for (const t of targets) if (!apex || t.x < apex.x) apex = t;
    if (!apex) return null;
    return {
      angle:
        Math.atan2(apex.y - cue.y, apex.x - cue.x) + rng.range(-1, 1) * err.angle * 0.5 * DEG,
      power: clampPower(RULES.BREAK_POWER + rng.range(-1, 1) * err.power * 0.4),
      kind: 'break',
      targetId: apex.id,
      score: 1,
    };
  }

  const lines = findLines(world, targets);
  if (lines.length) {
    const line = lines[0];
    return {
      angle: line.angle + rng.range(-1, 1) * err.angle * DEG,
      power: clampPower(powerFor(line.cueDist, line.potDist) + rng.range(-1, 1) * err.power),
      kind: 'pot',
      targetId: line.targetId,
      pocket: line.pocket,
      score: line.score,
    };
  }
  return safetyShot(targets, cue, err, rng);
}

export function placementOk(world, x, y) {
  if (!insidePlay(x, y, BALL.R + 0.5)) return false;
  const mouth = TABLE.POCKET_R + BALL.R + 4;
  for (const p of POCKETS) if (Math.hypot(x - p.x, y - p.y) < mouth) return false;
  for (const b of world.balls) {
    if (!b.alive || b.id === CUE) continue;
    if (Math.hypot(b.x - x, b.y - y) < BALL.DIAM + 0.5) return false;
  }
  return true;
}

export function firstLegalPlacement(world) {
  const step = BALL.DIAM + 2;
  for (let y = PLAY.top + BALL.R + 2; y <= PLAY.bottom - BALL.R - 2; y += step) {
    for (let x = PLAY.left + BALL.R + 2; x <= PLAY.right - BALL.R - 2; x += step) {
      if (placementOk(world, x, y)) return { x, y, score: 0 };
    }
  }
  return null;
}

// 自由球摆位：网格采样合法点，用候选白球位置评估线路得分，取最优。不修改 world。
export function planPlacement(world, targets, cue) {
  const n = AI.PLACE_SAMPLES;
  const pad = BALL.R * 2;
  const spanX = PLAY.right - PLAY.left - pad * 2;
  const spanY = PLAY.bottom - PLAY.top - pad * 2;
  const probe = { id: CUE, alive: true, x: 0, y: 0, vx: 0, vy: 0, kind: 'cue', group: null };
  let best = null;
  for (let ix = 0; ix < n; ix += 1) {
    for (let iy = 0; iy < n; iy += 1) {
      const x = PLAY.left + pad + (spanX * ix) / (n - 1);
      const y = PLAY.top + pad + (spanY * iy) / (n - 1);
      if (!placementOk(world, x, y)) continue;
      probe.x = x;
      probe.y = y;
      const lines = findLines(world, targets, probe);
      const score = lines.length ? lines[0].score : 0;
      if (!best || score > best.score) best = { x, y, score };
      if (score > 0.85) return best;
    }
  }
  if (best && best.score > 0) return best;
  return firstLegalPlacement(world) || { x: cue.x, y: cue.y, score: 0 };
}
