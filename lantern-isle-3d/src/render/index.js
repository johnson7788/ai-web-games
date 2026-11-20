// Canvas 2D 渲染：letterbox，画方块与地面
import { WORLD, PLAYER } from '../../config/game.config.js';

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  canvas.width = WORLD.WIDTH;
  canvas.height = WORLD.HEIGHT;

  return {
    render(sim) {
      // 清屏 + 地面（标题屏只画背景，不画角色）
      ctx.fillStyle = '#16213e';
      ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
      ctx.fillStyle = '#0f3460';
      ctx.fillRect(0, WORLD.GROUND_Y, WORLD.WIDTH, WORLD.HEIGHT - WORLD.GROUND_Y);
      if (!sim) return;

      // 玩家方块
      ctx.fillStyle = '#e94560';
      ctx.fillRect(sim.player.x, sim.player.y, PLAYER.WIDTH, PLAYER.HEIGHT);

      // 眼睛
      ctx.fillStyle = '#fff';
      ctx.fillRect(sim.player.x + 10, sim.player.y + 10, 8, 8);
      ctx.fillRect(sim.player.x + 22, sim.player.y + 10, 8, 8);
    },
  };
}
