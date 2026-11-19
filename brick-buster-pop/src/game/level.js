// 关卡解析 + 供 selfplay / 验收 debug 使用的贪心求解器（纯逻辑，零 DOM）。
import { GRID, CANNON, AIM } from '../../config/game.config.js';

const CHAR_TYPE = {
  r: { type: 'rock', clearable: false, descendable: false },
  h: { type: 'h', clearable: true, descendable: true },
  v: { type: 'v', clearable: true, descendable: true },
  b: { type: 'b', clearable: true, descendable: true },
  '+': { type: 'plus', clearable: true, descendable: true },
  s: { type: 'scatter', clearable: true, descendable: true },
};

export function parseChar(ch) {
  if (ch >= '1' && ch <= '9') {
    return { type: 'num', hp: Number(ch), clearable: true, descendable: true };
  }
  return CHAR_TYPE[ch] || null;
}

// 把关卡 rows（字符串数组）展开成砖块对象数组。
export function buildBricks(level) {
  const bricks = [];
  for (let r = 0; r < level.rows.length; r += 1) {
    const row = level.rows[r];
    for (let c = 0; c < GRID.COLS; c += 1) {
      const ch = row[c] || '.';
      const spec = parseChar(ch);
      if (!spec) continue;
      bricks.push({
        ...spec,
        r,
        c,
        hp: spec.hp ?? 1,
        maxHp: spec.hp ?? 1,
        x: GRID.X0 + c * (GRID.CELL_W + GRID.GAP),
        y: GRID.Y0 + r * (GRID.CELL_H + GRID.GAP),
        w: GRID.CELL_W,
        h: GRID.CELL_H,
      });
    }
  }
  return bricks;
}

// 炮口到目标点的瞄准角（度）：0=正上，正=右，负=左。
export function angleTo(tx, ty) {
  const dx = tx - CANNON.X;
  const dy = ty - CANNON.Y; // 目标在上方时 dy < 0
  const deg = (Math.atan2(dx, -dy) * 180) / Math.PI;
  return Math.max(AIM.MIN, Math.min(AIM.MAX, deg));
}

// 每列最靠近炮口（r 最大）的可清砖块。
export function bottommostByColumn(bricks) {
  const byCol = new Array(GRID.COLS).fill(null);
  for (const b of bricks) {
    if (b.dead || !b.clearable || b.hp <= 0) continue;
    if (!byCol[b.c] || b.r > byCol[b.c].r) byCol[b.c] = b;
  }
  return byCol;
}

// 每列剩余可清耐久总和。
export function hpByColumn(bricks) {
  const hp = new Array(GRID.COLS).fill(0);
  for (const b of bricks) {
    if (b.dead || !b.clearable || b.hp <= 0) continue;
    hp[b.c] += b.hp;
  }
  return hp;
}

// 贪心瞄准角：边缘列优先（低处越靠近炮台越难命中，越早清越安全），
// 同优先级取剩余耐久更高的列；瞄准该列最靠下的可清砖。
export function greedyAngle(state) {
  const bricks = state.bricks.filter((b) => !b.dead && b.clearable && b.hp > 0);
  if (!bricks.length) return 0;
  const hp = hpByColumn(bricks);
  const bottom = bottommostByColumn(bricks);
  const center = (GRID.COLS - 1) / 2;
  let bestC = -1;
  let bestKey = -1;
  for (let c = 0; c < GRID.COLS; c += 1) {
    if (hp[c] <= 0) continue;
    const edge = Math.abs(c - center);       // 离中心越远越优先
    const key = edge * 100 + Math.min(hp[c], 99); // 同边缘取耐久高
    if (key > bestKey) { bestKey = key; bestC = c; }
  }
  if (bestC < 0) return 0;
  const target = bottom[bestC];
  if (!target) return 0;
  return angleTo(target.x + target.w / 2, target.y + target.h / 2);
}

// 用真实物理把一局打到终局（selfplay / 验收 debug 共用）。
// onStep(dt) 可选回调用于消费事件（selfplay 里做遥测）。
export function solveRun(run, opts = {}) {
  const maxVolleys = opts.maxVolleys ?? 40;
  const stepsPerVolley = opts.stepsPerVolley ?? 4000;
  const onStep = opts.onStep || null;
  let guard = 0;
  while ((run.state.phase === 'aim' || run.state.phase === 'flying') && guard < maxVolleys) {
    guard += 1;
    if (run.state.phase === 'aim') {
      run.aim(greedyAngle(run.state));
      run.fire();
    }
    for (let i = 0; i < stepsPerVolley && run.state.phase === 'flying'; i += 1) {
      run.step(1 / 60);
      if (onStep) onStep();
    }
    // 若仍卡在 flying（理论上不可能），跳出防死循环
    if (run.state.phase === 'flying') break;
  }
  return run.state.phase;
}
