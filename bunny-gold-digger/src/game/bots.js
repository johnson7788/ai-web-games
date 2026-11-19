// 自对弈/截图共用的「贪心策略」决策函数（纯决策，不含步进）。
// 优先级：狂热就绪 → 提前结算（已达目标）→ 蓄能胡萝卜 → 最高价值金/钻石。
// predictHit：沿某角度射线下放，预测最先抓到的物品（射线→圆心最近距离判定）。
import { CLAW } from '../../config/game.config.js';

const GOLD = new Set(['gold1', 'gold2', 'gold3', 'diamond']);

export function reachable(state, item) {
  if (!item.alive) return false;
  return Math.abs(item.angle) <= CLAW.swingMax + 0.02;
}

export function predictHit(state, angle) {
  const dx = Math.sin(angle);
  const dy = Math.cos(angle);
  let best = null;
  let bestT = Infinity;
  for (const it of state.items) {
    if (!it.alive) continue;
    const rx = it.x - CLAW.pivotX;
    const ry = it.y - CLAW.pivotY;
    const t = rx * dx + ry * dy;          // 沿射线投影距离
    if (t <= 0) continue;
    const cx = CLAW.pivotX + dx * t;
    const cy = CLAW.pivotY + dy * t;
    const d2 = (it.x - cx) * (it.x - cx) + (it.y - cy) * (it.y - cy);
    const rr = it.r + CLAW.hitMargin;
    if (d2 <= rr * rr && t < bestT) { best = it; bestT = t; }
  }
  return best;
}

export function greedyPick(run, opts = {}) {
  const s = run.state;
  if (s.phase !== 'playing') return null;
  if (s.powerReady) return { type: 'power' };
  if (opts.allowBank !== false && s.score >= s.target) return { type: 'bank' };

  const items = s.items.filter((it) => reachable(s, it));
  if (s.powerMeter < 1) {
    const carrot = items.find((it) => it.kind === 'carrot');
    if (carrot) {
      const hit = predictHit(s, carrot.angle);
      if (hit && hit.id === carrot.id) return { type: 'drop', angle: carrot.angle };
    }
  }
  const gold = items
    .filter((it) => GOLD.has(it.kind))
    .sort((a, b) => (b.value - a.value) || (a.y - b.y));
  for (const g of gold) {
    const hit = predictHit(s, g.angle);
    if (hit && hit.id === g.id) return { type: 'drop', angle: g.angle };
  }
  return { type: 'idle' };
}
