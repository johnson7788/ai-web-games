// src/render/index.js — MARRY RICH · 渲染装配：场景背景 + 「人生天平」签名动画。
// 契约：createRender(canvas) → { draw(run, alpha, time), tilt(lean), setTimed(bool) }。
// 剧情文本/选项在 DOM（src/ui），Canvas 只画背景与天平；天平在关键抉择（限时节点）倾斜。
import { WORLD } from '../../config/gameplay.js';
import { drawScene } from './scene.js';

export function createRender(canvas) {
  const ctx = canvas.getContext('2d');
  canvas.width = WORLD.WIDTH;
  canvas.height = WORLD.HEIGHT;

  const state = {
    tilt: 0,        // 当前倾斜 -1..1（0 = 平衡）
    targetTilt: 0,  // 目标倾斜
    timed: false,   // 限时节点时天平更醒目
    lastTiltAt: 0,  // 天平倾斜事件时间（动效用）
  };

  function drawBalanceScale(time, timed) {
    // 天平放在右侧留白（左侧是主角，中间是故事卡），限时节点更醒目。
    const cx = 1130;
    const cy = timed ? 372 : 356;
    const amp = timed ? 44 : 30;

    // 支点与横梁
    const lean = state.tilt * 0.42; // 弧度
    const beamLen = timed ? 130 : 104;

    // 立柱
    ctx.strokeStyle = 'rgba(255,215,106,0.85)';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(cx, cy + 26);
    ctx.lineTo(cx, cy + 96);
    ctx.stroke();

    // 横梁（随 tilt 旋转）
    const bx1 = cx - Math.cos(lean) * beamLen;
    const by1 = cy + 26 - Math.sin(lean) * beamLen;
    const bx2 = cx + Math.cos(lean) * beamLen;
    const by2 = cy + 26 + Math.sin(lean) * beamLen;
    ctx.strokeStyle = 'rgba(255,215,106,0.95)';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(bx1, by1);
    ctx.lineTo(bx2, by2);
    ctx.stroke();

    // 两托盘
    ctx.fillStyle = 'rgba(255,240,200,0.9)';
    ctx.beginPath();
    ctx.arc(bx1, by1 + 12, 22, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(bx2, by2 + 12, 22, 0, Math.PI * 2);
    ctx.fill();

    // 托盘里的「砝码」：左=能力人脉（金），右=存款（银）
    ctx.fillStyle = 'rgba(255,200,90,0.95)';
    ctx.beginPath();
    ctx.arc(bx1, by1 + 8, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(200,225,255,0.95)';
    ctx.beginPath();
    ctx.arc(bx2, by2 + 8, 12, 0, Math.PI * 2);
    ctx.fill();

    // 光晕（限时节点更亮）
    const g = ctx.createRadialGradient(cx, cy, 6, cx, cy, 150);
    g.addColorStop(0, 'rgba(255,215,106,0.28)');
    g.addColorStop(1, 'rgba(255,215,106,0)');
    ctx.fillStyle = g;
    ctx.fillRect(cx - 150, cy - 150, 300, 300);

    // 关键抉择时的呼吸脉冲
    if (timed) {
      const pulse = 0.5 + 0.5 * Math.sin(time * 5);
      ctx.strokeStyle = `rgba(255,215,106,${0.25 + 0.3 * pulse})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(cx, cy + 26, 92 + pulse * 12, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  return {
    tilt(lean) {
      state.targetTilt = typeof lean === 'number' ? Math.max(-1, Math.min(1, lean)) : 0;
    },
    setTimed(b) {
      state.timed = !!b;
      if (!b) state.targetTilt = 0;
    },
    draw(run, alpha, time) {
      const hud = run ? run.getHud() : null;
      const scene = hud ? hud.scene : 'town';
      const t = time ?? 0;
      drawScene(ctx, scene, t);

      // 天平倾斜缓动
      state.tilt += (state.targetTilt - state.tilt) * 0.08;

      const timed = !!(hud && hud.timed && run.phase === 'playing' && run.stage === 'choice');
      drawBalanceScale(t, timed);

      // 淡入淡出由 main 决定是否覆盖；这里给标题屏留背景
      if (!hud) drawBalanceScale(t, false);
    },
  };
}
