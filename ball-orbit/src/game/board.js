// BALL ORBIT · 陨石带生成（纯逻辑）：初始阵 + 每回合补顶行
// 所有随机来自传入的 mulberry32 rng，同 seed 同结果
import { ASTEROID, WORLD } from '../../config/gameplay.js';
import { randInt } from './rng.js';

// 列中心 x（按列宽 + 列间隙均分在屏内）
function colCenter(col, cols) {
  const totalW = cols * ASTEROID.W + (cols - 1) * ASTEROID.COL_GAP;
  const left = (WORLD.WIDTH - totalW) / 2;
  return left + col * (ASTEROID.W + ASTEROID.COL_GAP) + ASTEROID.W / 2;
}

// 生成单颗陨石：kind 按波次概率滚动（normal / addBall / shield），moving 概率由波次给
// 空穴：rng < wave.hole 时返回 null（流星可穿缝弹上顶墙）
function makeAsteroid(run, col, rowY, wave) {
  if (run.rng() < (wave.hole ?? 0)) return null;
  const roll = run.rng();
  let kind = 'normal';
  if (roll < wave.addBall) kind = 'addBall';
  else if (roll < wave.addBall + wave.shield) kind = 'shield';
  const moving = run.rng() < wave.moving;
  const value = kind === 'addBall' ? 1 : randInt(run.rng, wave.value[0], wave.value[1]);
  return {
    id: run.nextId++,
    col,
    rowY,
    x: colCenter(col, wave.cols),
    y: rowY,
    ox: 0,          // 引力涟漪横移偏移（渲染 + 碰撞一致使用）
    tilt: 0,        // 引力涟漪倾斜（仅渲染）
    hardness: value,
    initial: value,
    kind,
    moving,
    vx: moving ? (run.rng() < 0.5 ? -1 : 1) * ASTEROID.MOVE_SPEED : 0,
  };
}

// 初始阵（rows × cols，从 TOP_Y 向下排）
export function buildBoard(run, wave) {
  const out = [];
  for (let r = 0; r < wave.rows; r += 1) {
    const rowY = ASTEROID.TOP_Y + r * ASTEROID.DESCEND_STEP;
    for (let c = 0; c < wave.cols; c += 1) {
      const a = makeAsteroid(run, c, rowY, wave);
      if (a) out.push(a);
    }
  }
  return out;
}

// 每回合下坠后补顶行（在 TOP_Y 生成一行，含空穴）
export function spawnRow(run, wave) {
  const out = [];
  const rowY = ASTEROID.TOP_Y;
  for (let c = 0; c < wave.cols; c += 1) {
    const a = makeAsteroid(run, c, rowY, wave);
    if (a) out.push(a);
  }
  return out;
}
