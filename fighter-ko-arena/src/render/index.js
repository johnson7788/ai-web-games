// Canvas 2D 渲染：霓虹街机格斗场。
// 程序化绘制：暗场 + 透视霓虹网格地板 + 两名霓虹斗士（玩家青 / 敌方品红）+ 命中火花。
// HUD（血条/能量/连击）在 DOM，避免文字裁切与遮挡。

import { WORLD, FIGHT } from '../../config/game.config.js';

const PLAYER_COLOR = { glow: '#33e6ff', core: '#eafeff', name: 'cyan' };
const ENEMY_COLOR = { glow: '#ff3fd6', core: '#ffe6f7', name: 'magenta' };

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const DPR = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = WORLD.WIDTH * DPR;
  canvas.height = WORLD.HEIGHT * DPR;
  ctx.scale(DPR, DPR);

  function glowStroke(color, width) {
    ctx.shadowColor = color;
    ctx.shadowBlur = width * 3.2;
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
  }

  function drawBackground(t) {
    const g = ctx.createLinearGradient(0, 0, 0, WORLD.HEIGHT);
    g.addColorStop(0, '#070714');
    g.addColorStop(0.55, '#0d0d24');
    g.addColorStop(1, '#120f2e');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);

    // 中心光晕
    const rg = ctx.createRadialGradient(WORLD.WIDTH / 2, WORLD.GROUND_Y - 90, 60, WORLD.WIDTH / 2, WORLD.GROUND_Y - 90, 640);
    rg.addColorStop(0, 'rgba(80,60,180,0.35)');
    rg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = rg;
    ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);

    // 透视网格地板
    const horizon = WORLD.GROUND_Y;
    ctx.save();
    ctx.strokeStyle = 'rgba(70,220,255,0.16)';
    ctx.lineWidth = 1;
    // 纵向汇聚线
    for (let i = -14; i <= 14; i += 1) {
      const topX = WORLD.WIDTH / 2 + i * 26;
      const botX = WORLD.WIDTH / 2 + i * 150;
      ctx.beginPath();
      ctx.moveTo(topX, horizon);
      ctx.lineTo(botX, WORLD.HEIGHT + 40);
      ctx.stroke();
    }
    // 横向线（越远越密）
    for (let r = 0; r < 9; r += 1) {
      const y = horizon + Math.pow(r / 9, 1.6) * (WORLD.HEIGHT - horizon + 40);
      ctx.strokeStyle = r < 3 ? 'rgba(255,80,220,0.14)' : 'rgba(70,220,255,0.10)';
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(WORLD.WIDTH, y);
      ctx.stroke();
    }
    ctx.restore();

    // 地面反光带
    const fl = ctx.createLinearGradient(0, horizon, 0, horizon + 120);
    fl.addColorStop(0, 'rgba(51,230,255,0.18)');
    fl.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = fl;
    ctx.fillRect(0, horizon, WORLD.WIDTH, 120);
  }

  function fighterX(state) {
    const f = state?.fight;
    if (!f) return { px: WORLD.WIDTH * 0.28, ex: WORLD.WIDTH * 0.72 };
    const cx = WORLD.WIDTH / 2;
    return { px: cx - f.distance / 2, ex: cx + f.distance / 2 };
  }

  function drawFighter({ x, color, facing, pose, t, dim = false }) {
    const y = WORLD.GROUND_Y;
    const bob = pose === 'idle' ? Math.sin(t * 5) * 3 : 0;
    const crouch = pose === 'block' ? 12 : 0;
    const lean = pose === 'hit' ? -facing * 12 : pose === 'windup' ? -facing * 6 : pose === 'punch' || pose === 'kick' || pose === 'super' ? facing * 8 : 0;

    const headY = y - 208 + bob - crouch;
    const shoulderY = y - 176 + bob - crouch;
    const hipY = y - 96 + bob - crouch;
    const hx = x + lean;

    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // 后腿 / 后臂（暗层）
    glowStroke(color.glow, dim ? 5 : 8);
    ctx.beginPath();
    ctx.moveTo(hx, hipY);
    ctx.lineTo(x - facing * 16, y);
    ctx.moveTo(hx + 4, shoulderY + 6);
    ctx.lineTo(x - facing * 30, hipY + 6);
    ctx.stroke();

    // 躯干
    glowStroke(color.glow, dim ? 6 : 9);
    ctx.beginPath();
    ctx.moveTo(hx, shoulderY);
    ctx.lineTo(hx, hipY);
    ctx.stroke();

    // 前腿
    ctx.beginPath();
    ctx.moveTo(hx, hipY);
    ctx.lineTo(x + facing * 16, y);
    ctx.stroke();

    // 头
    ctx.beginPath();
    ctx.arc(hx, headY, 22, 0, Math.PI * 2);
    ctx.stroke();

    // 前臂（按姿势）
    let handX = x + facing * 20;
    let handY = hipY + 8;
    if (pose === 'punch') { handX = x + facing * 88; handY = shoulderY + 6; }
    else if (pose === 'kick') { handX = x + facing * 26; handY = shoulderY + 14; }
    else if (pose === 'block') { handX = x + facing * 16; handY = shoulderY - 6; }
    else if (pose === 'super') { handX = x + facing * 92; handY = shoulderY - 18; }
    else if (pose === 'windup') { handX = x - facing * 40; handY = shoulderY - 10; }
    else if (pose === 'hit') { handX = x + facing * 10; handY = hipY + 10; }
    ctx.beginPath();
    ctx.moveTo(hx, shoulderY + 2);
    ctx.lineTo(handX, handY);
    ctx.stroke();

    // 扫腿：前腿踢出
    if (pose === 'kick') {
      ctx.beginPath();
      ctx.moveTo(hx, hipY);
      ctx.lineTo(x + facing * 96, y - 46);
      ctx.stroke();
    }
    // 格挡：交叉前臂
    if (pose === 'block') {
      ctx.beginPath();
      ctx.moveTo(hx, shoulderY);
      ctx.lineTo(x + facing * 30, shoulderY - 6);
      ctx.moveTo(hx, shoulderY + 6);
      ctx.lineTo(x - facing * 22, shoulderY - 6);
      ctx.stroke();
    }

    // 亮核（最亮的部分，强化剪影）
    ctx.shadowBlur = 0;
    ctx.strokeStyle = color.core;
    ctx.lineWidth = dim ? 1.6 : 2.2;
    ctx.beginPath();
    ctx.arc(hx, headY, 22, 0, Math.PI * 2);
    ctx.moveTo(hx, shoulderY);
    ctx.lineTo(hx, hipY);
    ctx.stroke();

    ctx.restore();
  }

  function drawSparks(sparks) {
    for (const s of sparks) {
      const a = Math.max(0, s.ttl / s.max);
      ctx.save();
      ctx.globalAlpha = a;
      ctx.shadowColor = s.color;
      ctx.shadowBlur = 14;
      ctx.strokeStyle = s.color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(s.x, s.y);
      ctx.lineTo(s.x + s.vx * 0.06, s.y + s.vy * 0.06);
      ctx.stroke();
      ctx.restore();
    }
  }

  function draw(state, view, phase) {
    const t = view.t;
    ctx.clearRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
    drawBackground(t);

    // 屏幕震动（命中反馈）
    if (view.shake > 0) {
      const s = view.shake;
      ctx.save();
      ctx.translate((Math.random() - 0.5) * s, (Math.random() - 0.5) * s);
    }

    const f = state?.fight || null;
    const { px, ex } = fighterX(state);

    // 标题 / 无对局：两位斗士对峙预览
    const preview = !f || phase === 'title';
    if (preview) {
      drawFighter({ x: WORLD.WIDTH * 0.30, color: PLAYER_COLOR, facing: 1, pose: 'idle', t });
      drawFighter({ x: WORLD.WIDTH * 0.70, color: ENEMY_COLOR, facing: -1, pose: 'idle', t });
      // 中间 VS 光柱
      ctx.save();
      ctx.shadowColor = '#ffd84e';
      ctx.shadowBlur = 30;
      ctx.strokeStyle = 'rgba(255,216,78,0.8)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(WORLD.WIDTH / 2, WORLD.GROUND_Y - 20);
      ctx.lineTo(WORLD.WIDTH / 2, WORLD.GROUND_Y - 300);
      ctx.stroke();
      ctx.restore();
    } else {
      // 玩家姿势
      let pp = view.playerPose;
      if (f.blocking && pp !== 'hit') pp = 'block';
      drawFighter({ x: px, color: PLAYER_COLOR, facing: 1, pose: pp, t });
      // 敌方姿势
      let ep = view.enemyPose;
      if (f.enemyWindup > 0 && ep !== 'hit') ep = 'windup';
      drawFighter({ x: ex, color: ENEMY_COLOR, facing: -1, pose: ep, t, dim: true });
    }

    drawSparks(view.sparks);

    if (view.shake > 0) ctx.restore();

    // 超必杀全屏闪光
    if (view.flash > 0) {
      ctx.save();
      ctx.globalAlpha = Math.min(0.7, view.flash);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
      ctx.restore();
    }
  }

  return { draw };
}
