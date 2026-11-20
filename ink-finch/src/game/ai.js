// INK FINCH · 控制器（纯逻辑，零 DOM）
// 供 tools/selfplay.mjs（Node 无头）与 main.js 的 debug.fastForward/autoPlay 复用。
// 策略：bang-bang 追踪下一根未穿竹节的缝心；双缝走近缝（安全），竹刺转轮走更宽的半缝。

const FLAP_MIN_INTERVAL = 0.12;

export function createController(level) {
  let lastT = -1;

  function targetYFor(run, g) {
    if (!g) return 360;
    const s = run.state;
    if (g.kind === 'double') {
      return g.nearCenter === 'upper' ? g.upperCenter : g.lowerCenter;
    }
    if (g.wheel) {
      const topEdge = g.gapY - g.gapH / 2;
      const botEdge = g.gapY + g.gapH / 2;
      const upClear = g.wheel.cy - g.wheel.r - topEdge;
      const downClear = botEdge - (g.wheel.cy + g.wheel.r);
      return upClear >= downClear ? topEdge + upClear / 2 : botEdge - downClear / 2;
    }
    // 移动缝：预测鸟抵达时的缝心位置（相位前馈），否则会追着摆动的尾巴跑
    if (g.moveAmp) {
      const tta = Math.max(0, (g.x - s.bird.x) / run._level.scroll);
      const future = s.time + tta;
      return g.baseGapY + Math.sin(g.phase + future * ((2 * Math.PI) / g.movePeriod)) * g.moveAmp;
    }
    return g.gapY;
  }

  return {
    // 返回本次是否应当上扑
    step(run) {
      const s = run.state;
      if (s.phase === 'ready') return true;
      if (s.phase !== 'playing') return false;
      if (s.time - lastT < FLAP_MIN_INTERVAL) return false;

      const b = s.bird;
      if (level.windVx && b.x < 170) return (lastT = s.time, true);

      const g = s.gates.find((x) => !x.scored);
      // 瞄准缝心偏下一小段，抵消单扑冲量的上冲，避免擦上沿
      const targetY = targetYFor(run, g) + 16;
      const diff = b.y - targetY; // >0 = 低于目标
      // 近目标时只在下降扑（稳定悬停）；离目标较远时主动爬升（每弧线多扑）
      const shouldFlap = diff > 0 && (b.vy > 0 || diff > 40);
      if (shouldFlap) lastT = s.time;
      return shouldFlap;
    },
  };
}
