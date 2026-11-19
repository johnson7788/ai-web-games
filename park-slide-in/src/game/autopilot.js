// PARK SLIDE IN · 自动泊车控制器（纯逻辑）
// 供 tools/selfplay.mjs 的 greedy 策略使用；也可作为调试辅助（不影响正常游玩）。
// 两阶段：先正向驶向泊车预备点 S，再沿入位方向直线（正/倒）入库，遇移动障碍先等待。
import { CAR } from '../../config/game.config.js';

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const wrap = (a) => {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
};
const steerFor = (err) => clamp(err * 3, -1, 1);

function blockedBy(state) {
  for (const m of state.moving) {
    const dx = Math.abs(m.x - state.car.x);
    const dy = Math.abs(m.y - state.car.y);
    if (dx < 220 && dy < 100 && state.car.x < m.x + 130) return true;
  }
  return false;
}

export function autopilotControl(state) {
  if (state.phase !== 'playing') return { throttle: 0, steerDir: 0 };

  const car = state.car;
  const bay = state.bay;
  const entry = state.entry;
  const noseX = Math.cos(entry.heading);
  const noseY = Math.sin(entry.heading);
  const travelX = entry.reverse ? -noseX : noseX;
  const travelY = entry.reverse ? -noseY : noseY;
  const standoff = 250;
  const sx = bay.x + noseX * (entry.reverse ? standoff : -standoff);
  const sy = bay.y + noseY * (entry.reverse ? standoff : -standoff);
  const targetHeading = entry.heading;

  // 泊车走廊进度：距车位中心沿入位方向还剩多少（>0 表示还需前进）
  const p = (bay.x - car.x) * travelX + (bay.y - car.y) * travelY;

  if (blockedBy(state) && p > 40) {
    return { throttle: 0, steerDir: steerFor(wrap(targetHeading - car.heading)) };
  }

  // 阶段判定：走廊内就转入库（粘性，避免越过 S 后掉头）
  const inCorridor = p <= standoff + 90;

  if (!inCorridor) {
    // 阶段 A：正向驶向预备点 S（纯追踪 + 随距离减速）
    const dxS = sx - car.x;
    const dyS = sy - car.y;
    const dStage = Math.sqrt(dxS * dxS + dyS * dyS);
    const desired = Math.atan2(dyS, dxS);
    const err = wrap(desired - car.heading);
    const targetSpeed = clamp(dStage * 0.9, 0, CAR.MAX_SPEED * 0.45);
    const throttle = car.speed < targetSpeed ? 1 : 0;
    return { throttle, steerDir: steerFor(err) };
  }

  // 阶段 B：沿入位方向入库（正/倒），目标速度随剩余距离衰减，附带横向纠偏
  const toBayX = bay.x - car.x;
  const toBayY = bay.y - car.y;
  const lateral = toBayX * -travelY + toBayY * travelX; // 相对入位线的横向偏移（正=偏右）
  const desiredHeading = targetHeading + clamp(lateral * 0.02, -0.4, 0.4);
  const targetSpeed = clamp(p * 0.7, 0, 80);
  const sign = entry.reverse ? -1 : 1;
  const throttle = p > 6 && Math.abs(car.speed) < targetSpeed ? sign : 0;
  return { throttle, steerDir: steerFor(wrap(desiredHeading - car.heading)) };
}
