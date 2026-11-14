// Canvas 2D 渲染：AI 背景 / 物品 sprite 铺底，玩法层（高亮/粒子/命中几何）保留程序化。
import { WORLD, SCENE, COLORS, RULES } from '../../config/game.config.js';
import { TYPE_BY_ID } from '../../config/objects.js';
import { ART, getImage, drawSprite, drawCover } from './art.js';

const FONT = '"PingFang SC","Hiragino Sans GB","Microsoft YaHei","Segoe UI",sans-serif';

// 背景按关卡轮换；keyart 专用于标题。
const BG_ORDER = ['attic', 'study', 'greenhouse'];

export function drawIcon(ctx, type, x, y, r, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineWidth = r * 0.16;
  ctx.lineCap = 'round';
  switch (type) {
    case 'key':
      ctx.beginPath(); ctx.arc(-r * 0.4, 0, r * 0.4, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-r * 0.1, 0); ctx.lineTo(r * 0.8, 0);
      ctx.moveTo(r * 0.5, 0); ctx.lineTo(r * 0.5, r * 0.3);
      ctx.moveTo(r * 0.8, 0); ctx.lineTo(r * 0.8, r * 0.3); ctx.stroke();
      break;
    case 'star': {
      ctx.beginPath();
      for (let i = 0; i < 10; i += 1) {
        const ang = -Math.PI / 2 + (i * Math.PI) / 5;
        const rad = i % 2 === 0 ? r : r * 0.45;
        const px = Math.cos(ang) * rad;
        const py = Math.sin(ang) * rad;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath(); ctx.fill();
      break;
    }
    case 'heart':
      ctx.beginPath();
      ctx.moveTo(0, r * 0.7);
      ctx.bezierCurveTo(-r * 1.1, -r * 0.1, -r * 0.5, -r * 0.9, 0, -r * 0.3);
      ctx.bezierCurveTo(r * 0.5, -r * 0.9, r * 1.1, -r * 0.1, 0, r * 0.7);
      ctx.fill();
      break;
    case 'gem':
      ctx.beginPath();
      ctx.moveTo(0, -r * 0.8); ctx.lineTo(r * 0.8, -r * 0.2);
      ctx.lineTo(0, r * 0.8); ctx.lineTo(-r * 0.8, -r * 0.2);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.4)';
      ctx.beginPath(); ctx.moveTo(-r * 0.8, -r * 0.2); ctx.lineTo(r * 0.8, -r * 0.2); ctx.stroke();
      break;
    case 'coin':
      ctx.beginPath(); ctx.arc(0, 0, r * 0.8, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.font = `800 ${r}px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('$', 0, r * 0.05);
      break;
    case 'apple':
      ctx.beginPath(); ctx.arc(0, r * 0.1, r * 0.7, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#34d399'; ctx.lineWidth = r * 0.14;
      ctx.beginPath(); ctx.moveTo(0, -r * 0.5); ctx.lineTo(r * 0.15, -r * 0.85); ctx.stroke();
      break;
    case 'fish':
      ctx.beginPath(); ctx.ellipse(0, 0, r * 0.75, r * 0.45, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.moveTo(r * 0.6, 0); ctx.lineTo(r * 0.95, -r * 0.35);
      ctx.lineTo(r * 0.95, r * 0.35); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#101820';
      ctx.beginPath(); ctx.arc(-r * 0.35, -r * 0.08, r * 0.1, 0, Math.PI * 2); ctx.fill();
      break;
    case 'moon':
      ctx.beginPath(); ctx.arc(0, 0, r * 0.8, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = COLORS.scene;
      ctx.beginPath(); ctx.arc(r * 0.35, -r * 0.2, r * 0.65, 0, Math.PI * 2); ctx.fill();
      break;
    case 'bell':
      ctx.beginPath();
      ctx.moveTo(-r * 0.6, r * 0.4);
      ctx.quadraticCurveTo(-r * 0.6, -r * 0.7, 0, -r * 0.7);
      ctx.quadraticCurveTo(r * 0.6, -r * 0.7, r * 0.6, r * 0.4);
      ctx.closePath(); ctx.fill();
      ctx.beginPath(); ctx.arc(0, r * 0.55, r * 0.18, 0, Math.PI * 2); ctx.fill();
      break;
    case 'crown':
      ctx.beginPath();
      ctx.moveTo(-r * 0.7, r * 0.5); ctx.lineTo(-r * 0.7, -r * 0.3);
      ctx.lineTo(-r * 0.3, r * 0.05); ctx.lineTo(0, -r * 0.6);
      ctx.lineTo(r * 0.3, r * 0.05); ctx.lineTo(r * 0.7, -r * 0.3);
      ctx.lineTo(r * 0.7, r * 0.5); ctx.closePath(); ctx.fill();
      break;
    case 'leaf':
      ctx.beginPath();
      ctx.moveTo(0, -r * 0.8);
      ctx.quadraticCurveTo(r * 0.9, -r * 0.2, 0, r * 0.8);
      ctx.quadraticCurveTo(-r * 0.9, -r * 0.2, 0, -r * 0.8);
      ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath(); ctx.moveTo(0, -r * 0.7); ctx.lineTo(0, r * 0.7); ctx.stroke();
      break;
    case 'mushroom':
      ctx.beginPath(); ctx.arc(0, -r * 0.1, r * 0.75, Math.PI, 2 * Math.PI); ctx.fill();
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(-r * 0.25, -r * 0.1, r * 0.5, r * 0.8);
      break;
    default:
      ctx.beginPath(); ctx.arc(0, 0, r * 0.7, 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  canvas.width = WORLD.WIDTH;
  canvas.height = WORLD.HEIGHT;
  const particles = [];
  let wrongFlash = null;

  function burst(x, y, color, n = 12) {
    for (let i = 0; i < n; i += 1) {
      const a = Math.random() * Math.PI * 2;
      const sp = 50 + Math.random() * 160;
      particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.5 + Math.random() * 0.3, t: 0, color, size: 3 + Math.random() * 3 });
    }
  }
  function flashWrong(x, y) { wrongFlash = { x, y, t: 0, life: 0.4 }; }
  function update(dt) {
    for (let i = particles.length - 1; i >= 0; i -= 1) {
      const p = particles[i];
      p.t += dt;
      if (p.t >= p.life) { particles.splice(i, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt;
    }
    if (wrongFlash) { wrongFlash.t += dt; if (wrongFlash.t >= wrongFlash.life) wrongFlash = null; }
  }

  // 素材未到位时的程序化占位背景（原样式，避免白屏）。
  function drawFallbackBackground() {
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
    ctx.fillStyle = COLORS.scene;
    ctx.fillRect(SCENE.X, SCENE.Y, SCENE.W, SCENE.H);
    ctx.strokeStyle = COLORS.sceneEdge;
    ctx.lineWidth = 3;
    ctx.strokeRect(SCENE.X, SCENE.Y, SCENE.W, SCENE.H);
    ctx.fillStyle = 'rgba(255,255,255,0.03)';
    let s = 777;
    const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
    for (let i = 0; i < 80; i += 1) {
      ctx.beginPath();
      ctx.arc(SCENE.X + rnd() * SCENE.W, SCENE.Y + rnd() * SCENE.H, 2 + rnd() * 6, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawBackground(state, level) {
    if (state === 'title') {
      const img = getImage('keyart');
      if (img) { drawCover(ctx, img, ART.keyart); return; }
    } else {
      const key = BG_ORDER[(Math.max(1, level || 1) - 1) % BG_ORDER.length];
      const img = getImage('bg', key);
      if (img) { drawCover(ctx, img, ART.bg[key]); return; }
    }
    drawFallbackBackground();
  }

  // 物品：有 sprite 用 sprite（与旧图标同 footprint，判定几何不变），否则回退程序化图标。
  function drawObject(o) {
    const img = getImage('items', o.type);
    const meta = ART.items[o.type];
    const info = TYPE_BY_ID[o.type];
    if (img && meta) {
      const h = RULES.objectRadius * 1.8;
      drawSprite(ctx, img, o.x, o.y, meta, h / meta.h);
    } else {
      drawIcon(ctx, o.type, o.x, o.y, RULES.objectRadius * 0.9, info ? info.color : COLORS.accent);
    }
  }

  function drawObjects(run, view) {
    const now = view.now || 0;
    for (const o of run.objects) {
      if (o.found) {
        ctx.globalAlpha = 0.25;
        drawObject(o);
        ctx.globalAlpha = 1;
        ctx.strokeStyle = COLORS.good;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(o.x - 8, o.y); ctx.lineTo(o.x - 2, o.y + 7); ctx.lineTo(o.x + 9, o.y - 7);
        ctx.stroke();
      } else {
        if (run.hintTarget === o.id) {
          const pulse = 0.5 + 0.5 * Math.sin(now / 150);
          ctx.strokeStyle = COLORS.accent;
          ctx.globalAlpha = pulse;
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.arc(o.x, o.y, RULES.objectRadius + 8, 0, Math.PI * 2);
          ctx.stroke();
          ctx.globalAlpha = 1;
        }
        drawObject(o);
      }
    }
    if (wrongFlash) {
      ctx.globalAlpha = 1 - wrongFlash.t / wrongFlash.life;
      ctx.strokeStyle = COLORS.danger;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(wrongFlash.x, wrongFlash.y, RULES.objectRadius + 6, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }

  function drawParticles() {
    for (const p of particles) {
      ctx.globalAlpha = Math.max(0, 1 - p.t / p.life);
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    ctx.globalAlpha = 1;
  }

  function render(view) {
    drawBackground(view.state, view.run && view.run.level);
    if (view.run && view.state !== 'title') drawObjects(view.run, view);
    drawParticles();
  }

  function clearEffects() { particles.length = 0; wrongFlash = null; }

  return { render, update, burst, flashWrong, clearEffects };
}
