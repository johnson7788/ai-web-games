// 相机跟随：死区 + 前瞻 + 边界钳制。纯函数，返回相机中心。
import { CONFIG } from '../../config/game.config.js';

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

export function makeCamera(level) {
  return { x: level.spawn.x, y: level.spawn.y + CONFIG.camera.lookY + 2 };
}

/**
 * @param {{x:number,y:number}} cam 相机中心（就地更新）
 * @param {{x:number,y:number,vx:number,grounded:boolean}} target 跟随目标（玩家）
 */
export function updateCamera(cam, target, level, dt) {
  const C = CONFIG.camera;
  const aimX = target.x + clamp(target.vx * C.lookahead, -C.lookaheadMax, C.lookaheadMax);

  if (aimX > cam.x + C.deadzoneX) cam.x = aimX - C.deadzoneX;
  else if (aimX < cam.x - C.deadzoneX) cam.x = aimX + C.deadzoneX;

  // 垂直：落地或大幅偏离才跟随，避免跳一下画面就晃
  const aimY = target.y + C.lookY;
  const dy = aimY - cam.y;
  if (target.grounded || Math.abs(dy) > C.deadzoneY * 2) {
    cam.y += dy * (1 - Math.exp(-C.followY * dt));
  }

  const halfW = (CONFIG.view.w / CONFIG.view.h) * 6.75; // ≈ 12 格（宽度不随 dist 变）
  const halfH = 4.3;
  cam.x = clamp(cam.x, halfW, Math.max(halfW, level.w - halfW));
  cam.y = clamp(cam.y, halfH, Math.max(halfH, level.h - halfH));
  return cam;
}
