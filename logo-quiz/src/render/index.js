// Canvas 2D 渲染：品牌徽标（彩色底 + 白色图标）+ 对错闪光。选项为 DOM。
import { WORLD, COLORS } from '../../config/game.config.js';

const FONT = '"PingFang SC","Hiragino Sans GB","Microsoft YaHei","Segoe UI",sans-serif';

function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

// 白色图标，中心 (x,y)，尺寸 s
function drawIcon(ctx, icon, x, y, s) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = '#fff';
  ctx.strokeStyle = '#fff';
  ctx.lineWidth = s * 0.09;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const u = s / 2;
  switch (icon) {
    case 'leaf':
      ctx.beginPath();
      ctx.moveTo(0, -u * 0.9);
      ctx.quadraticCurveTo(u * 0.95, -u * 0.2, 0, u * 0.9);
      ctx.quadraticCurveTo(-u * 0.95, -u * 0.2, 0, -u * 0.9);
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.25)';
      ctx.beginPath(); ctx.moveTo(0, -u * 0.7); ctx.lineTo(0, u * 0.7); ctx.stroke();
      break;
    case 'rocket':
      ctx.beginPath();
      ctx.moveTo(0, -u * 0.95);
      ctx.quadraticCurveTo(u * 0.5, -u * 0.2, u * 0.35, u * 0.5);
      ctx.lineTo(-u * 0.35, u * 0.5);
      ctx.quadraticCurveTo(-u * 0.5, -u * 0.2, 0, -u * 0.95);
      ctx.fill();
      ctx.beginPath(); ctx.moveTo(-u * 0.35, u * 0.2); ctx.lineTo(-u * 0.7, u * 0.7); ctx.lineTo(-u * 0.3, u * 0.55); ctx.fill();
      ctx.beginPath(); ctx.moveTo(u * 0.35, u * 0.2); ctx.lineTo(u * 0.7, u * 0.7); ctx.lineTo(u * 0.3, u * 0.55); ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath(); ctx.arc(0, -u * 0.2, u * 0.18, 0, Math.PI * 2); ctx.fill();
      break;
    case 'drop':
      ctx.beginPath();
      ctx.moveTo(0, -u * 0.9);
      ctx.quadraticCurveTo(u * 0.8, u * 0.1, 0, u * 0.85);
      ctx.quadraticCurveTo(-u * 0.8, u * 0.1, 0, -u * 0.9);
      ctx.fill();
      break;
    case 'star': {
      ctx.beginPath();
      for (let i = 0; i < 10; i += 1) {
        const a = -Math.PI / 2 + (i * Math.PI) / 5;
        const r = i % 2 === 0 ? u * 0.95 : u * 0.42;
        const px = Math.cos(a) * r;
        const py = Math.sin(a) * r;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath(); ctx.fill();
      break;
    }
    case 'moon':
      ctx.beginPath(); ctx.arc(0, 0, u * 0.85, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,0.28)';
      ctx.beginPath(); ctx.arc(u * 0.35, -u * 0.2, u * 0.7, 0, Math.PI * 2); ctx.fill();
      break;
    case 'cup':
      roundRect(ctx, -u * 0.55, -u * 0.3, u * 1.0, u * 0.95, u * 0.12); ctx.fill();
      ctx.beginPath(); ctx.arc(u * 0.55, u * 0.05, u * 0.3, -Math.PI / 2, Math.PI / 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-u * 0.3, -u * 0.6); ctx.quadraticCurveTo(-u * 0.15, -u * 0.75, -u * 0.3, -u * 0.9); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(u * 0.1, -u * 0.6); ctx.quadraticCurveTo(u * 0.25, -u * 0.75, u * 0.1, -u * 0.9); ctx.stroke();
      break;
    case 'sun':
      ctx.beginPath(); ctx.arc(0, 0, u * 0.45, 0, Math.PI * 2); ctx.fill();
      for (let i = 0; i < 8; i += 1) {
        const a = (i * Math.PI) / 4;
        ctx.beginPath();
        ctx.moveTo(Math.cos(a) * u * 0.6, Math.sin(a) * u * 0.6);
        ctx.lineTo(Math.cos(a) * u * 0.9, Math.sin(a) * u * 0.9);
        ctx.stroke();
      }
      break;
    case 'tree':
      ctx.beginPath(); ctx.moveTo(0, -u * 0.9); ctx.lineTo(u * 0.55, -u * 0.1); ctx.lineTo(-u * 0.55, -u * 0.1); ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.moveTo(0, -u * 0.5); ctx.lineTo(u * 0.7, u * 0.4); ctx.lineTo(-u * 0.7, u * 0.4); ctx.closePath(); ctx.fill();
      ctx.fillRect(-u * 0.12, u * 0.4, u * 0.24, u * 0.45);
      break;
    case 'heart':
      ctx.beginPath();
      ctx.moveTo(0, u * 0.75);
      ctx.bezierCurveTo(-u * 1.1, -u * 0.1, -u * 0.5, -u * 0.9, 0, -u * 0.3);
      ctx.bezierCurveTo(u * 0.5, -u * 0.9, u * 1.1, -u * 0.1, 0, u * 0.75);
      ctx.fill();
      break;
    case 'cloud':
      ctx.beginPath();
      ctx.arc(-u * 0.35, u * 0.1, u * 0.4, 0, Math.PI * 2);
      ctx.arc(u * 0.1, -u * 0.15, u * 0.5, 0, Math.PI * 2);
      ctx.arc(u * 0.5, u * 0.15, u * 0.35, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'bolt':
      ctx.beginPath();
      ctx.moveTo(u * 0.15, -u * 0.9); ctx.lineTo(-u * 0.45, u * 0.1);
      ctx.lineTo(-u * 0.02, u * 0.1); ctx.lineTo(-u * 0.15, u * 0.9);
      ctx.lineTo(u * 0.45, -u * 0.1); ctx.lineTo(u * 0.02, -u * 0.1);
      ctx.closePath(); ctx.fill();
      break;
    case 'gear':
      for (let i = 0; i < 8; i += 1) {
        const a = (i * Math.PI) / 4;
        ctx.save(); ctx.rotate(a); ctx.fillRect(-u * 0.12, -u * 0.9, u * 0.24, u * 0.3); ctx.restore();
      }
      ctx.beginPath(); ctx.arc(0, 0, u * 0.6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath(); ctx.arc(0, 0, u * 0.25, 0, Math.PI * 2); ctx.fill();
      break;
    case 'fish':
      ctx.beginPath(); ctx.ellipse(-u * 0.1, 0, u * 0.6, u * 0.4, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.moveTo(u * 0.4, 0); ctx.lineTo(u * 0.85, -u * 0.35); ctx.lineTo(u * 0.85, u * 0.35); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath(); ctx.arc(-u * 0.4, -u * 0.08, u * 0.09, 0, Math.PI * 2); ctx.fill();
      break;
    case 'owl':
      ctx.beginPath(); ctx.ellipse(0, u * 0.1, u * 0.6, u * 0.7, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-u * 0.5, -u * 0.5); ctx.lineTo(-u * 0.3, -u * 0.85); ctx.lineTo(-u * 0.15, -u * 0.5); ctx.fill();
      ctx.beginPath(); ctx.moveTo(u * 0.5, -u * 0.5); ctx.lineTo(u * 0.3, -u * 0.85); ctx.lineTo(u * 0.15, -u * 0.5); ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath(); ctx.arc(-u * 0.22, -u * 0.1, u * 0.16, 0, Math.PI * 2); ctx.arc(u * 0.22, -u * 0.1, u * 0.16, 0, Math.PI * 2); ctx.fill();
      break;
    case 'wheat':
      ctx.beginPath(); ctx.moveTo(0, u * 0.9); ctx.lineTo(0, -u * 0.7); ctx.stroke();
      for (let i = 0; i < 4; i += 1) {
        const yy = -u * 0.5 + i * u * 0.32;
        ctx.beginPath(); ctx.ellipse(-u * 0.22, yy, u * 0.2, u * 0.12, -0.5, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(u * 0.22, yy, u * 0.2, u * 0.12, 0.5, 0, Math.PI * 2); ctx.fill();
      }
      break;
    case 'flame':
      ctx.beginPath();
      ctx.moveTo(0, -u * 0.9);
      ctx.quadraticCurveTo(u * 0.7, -u * 0.2, u * 0.45, u * 0.4);
      ctx.quadraticCurveTo(u * 0.3, u * 0.8, 0, u * 0.85);
      ctx.quadraticCurveTo(-u * 0.3, u * 0.8, -u * 0.45, u * 0.4);
      ctx.quadraticCurveTo(-u * 0.7, -u * 0.2, 0, -u * 0.9);
      ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.beginPath();
      ctx.moveTo(0, -u * 0.1);
      ctx.quadraticCurveTo(u * 0.3, u * 0.3, 0, u * 0.7);
      ctx.quadraticCurveTo(-u * 0.3, u * 0.3, 0, -u * 0.1);
      ctx.fill();
      break;
    default:
      ctx.beginPath(); ctx.arc(0, 0, u * 0.7, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  canvas.width = WORLD.WIDTH;
  canvas.height = WORLD.HEIGHT;
  let flash = null;

  function flashResult(correct) { flash = { correct, t: 0, life: 0.5 }; }
  function update(dt) { if (flash) { flash.t += dt; if (flash.t >= flash.life) flash = null; } }

  function render(view) {
    const { run } = view;
    const g = ctx.createRadialGradient(640, 220, 60, 640, 360, 800);
    g.addColorStop(0, COLORS.bgGlow);
    g.addColorStop(1, COLORS.bg);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
    if (!run || !run.current) return;
    const brand = run.current.brand;
    const cx = 640;
    const cy = 210;
    const size = 200;
    ctx.save();
    ctx.shadowColor = brand.color;
    ctx.shadowBlur = 40;
    ctx.fillStyle = brand.color;
    roundRect(ctx, cx - size / 2, cy - size / 2, size, size, 40);
    ctx.fill();
    ctx.restore();
    drawIcon(ctx, brand.icon, cx, cy, size * 0.62);
    if (flash) {
      ctx.globalAlpha = 0.35 * (1 - flash.t / flash.life);
      ctx.strokeStyle = flash.correct ? COLORS.good : COLORS.danger;
      ctx.lineWidth = 10;
      roundRect(ctx, cx - size / 2 - 8, cy - size / 2 - 8, size + 16, size + 16, 44);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }

  function clearEffects() { flash = null; }
  return { render, update, flashResult, clearEffects };
}