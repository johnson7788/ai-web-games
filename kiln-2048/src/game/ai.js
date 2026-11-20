// KILN 2048 · 贪心 AI 辅助（纯逻辑，零依赖）
// 供 tools/selfplay.mjs（Node）与 main.js 的 __ll.debug.autoPlaceSolution()（浏览器）共用。
// 策略：优先把持球投到「暴露的同值可合并球」上方直接合成；否则投到最深的空档控高度。

function clamp(x, lo, hi) {
  return Math.max(lo, Math.min(hi, x));
}

/** 所有已投放的球是否都已静止（睡眠） */
export function boardSettled(state) {
  return state.balls.every((b) => b.sleeping);
}

/** 球 b 是否「暴露」（上方没有压着别的球） */
export function exposed(state, b) {
  for (const c of state.balls) {
    if (c === b) continue;
    if (c.y < b.y && Math.abs(c.x - b.x) < c.r + b.r) return false;
  }
  return true;
}

/** 在 x 处投放半径为 r 的球，其圆心最终停靠的 y（越高越小） */
export function landingY(state, x, r) {
  const k = state.kiln;
  let ly = k.floorY - r;
  for (const c of state.balls) {
    const dx = c.x - x;
    const rr = c.r + r;
    if (Math.abs(dx) < rr) {
      const dy = Math.sqrt(Math.max(0, rr * rr - dx * dx));
      const top = c.y - dy;
      if (top < ly) ly = top;
    }
  }
  return ly;
}

/** 给当前持球挑一个最佳投放 x */
export function bestDropX(run) {
  const s = run.state;
  if (!s.held) return (s.kiln.left + s.kiln.right) / 2;
  const v = s.held.value;
  const heldR = s.held.r;
  const k = s.kiln;
  const lo = k.left + heldR;
  const hi = k.right - heldR;

  // 1) 优先合成：暴露的同值球（冰冻球不可合；双色釉需异色）
  if (!s.held.frozen) {
    let target = null;
    for (const b of s.balls) {
      if (b.frozen || b.value !== v) continue;
      if (s.features.dualGlaze && b.phase === s.held.phase) continue;
      if (!exposed(s, b)) continue;
      if (!target || b.y < target.y) target = b;
    }
    if (target) return clamp(target.x, lo, hi);
  }

  // 2) 保持堆叠有序：落在「暴露且值 ≤ 持球」的最大值球上（大在下、小在上，利于级联合并）
  let sortedTarget = null;
  for (const b of s.balls) {
    if (b.frozen) continue;
    if (!exposed(s, b)) continue;
    if (b.value <= v && (!sortedTarget || b.value > sortedTarget.value)) sortedTarget = b;
  }
  if (sortedTarget) return clamp(sortedTarget.x, lo, hi);

  // 3) 最深的空档（停靠 y 最大 = 离窑底最近）
  let bestX = (lo + hi) / 2;
  let bestLy = -Infinity;
  const n = 11;
  for (let i = 0; i <= n; i += 1) {
    const x = lo + (hi - lo) * (i / n);
    const ly = landingY(s, x, heldR);
    if (ly > bestLy) { bestLy = ly; bestX = x; }
  }
  return bestX;
}

/** 贪心自动玩到终局（win/lose）；返回终局 phase */
export function autoPlay(run, maxSec = 90) {
  const s = run.state;
  let guard = 0;
  while (s.phase === 'playing' && guard < 30000) {
    guard += 1;
    run.step(1 / 60);
    if (s.held && boardSettled(s)) {
      run.setDropX(bestDropX(run));
      run.drop();
    }
    if (run._clock > maxSec) break;
  }
  return s.phase;
}
