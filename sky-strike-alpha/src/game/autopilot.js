// SKY STRIKE ALPHA · 贪心自动驾驶（纯逻辑，供 tools/selfplay.mjs 与 main 调试口复用）
// 策略：对准最近未越过障碍的缝隙中心；贴目标时以小幅振荡保持动作密度与高度。
import { WORLD } from '../../config/game.config.js';

export function greedyHold(run) {
  const s = run.state;
  if (s.phase !== 'playing') return false;
  let ahead = null;
  for (const o of s.obstacles) {
    if (o.removed || o.passed) continue;
    if (o.x + o.halfW > s.player.x - 6) {
      if (!ahead || o.x < ahead.x) ahead = o;
    }
  }
  const targetY = ahead ? ahead.gapY : WORLD.HEIGHT * 0.5;
  const err = s.player.y - targetY; // >0 玩家在下方 → 需爬升（hold）
  if (err > 12) return true;
  if (err < -12) return false;
  return Math.sin(s.time * Math.PI * 2 * 1.4) > 0;
}

// 贪心推进直到离场或达到 maxSec（不排空事件，调用方自行 drain）
export function flySteps(run, maxSec = 60) {
  const steps = Math.ceil(maxSec / (1 / 60));
  let sec = 0;
  for (let i = 0; i < steps; i += 1) {
    if (run.state.phase !== 'playing') break;
    run.setHold(greedyHold(run));
    run.step(1 / 60);
    sec += 1 / 60;
  }
  return { phase: run.state.phase, seconds: Number(sec.toFixed(2)) };
}
