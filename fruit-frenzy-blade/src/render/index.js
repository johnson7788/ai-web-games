// Canvas 2D 渲染：霓虹街机风切水果（纯程序化，零素材）。
// 角色/水果/炸弹/岩石/刀光/粒子/闪白全部即时绘制。
import { WORLD, FRUIT } from '../../config/game.config.js';

const W = WORLD.WIDTH;
const H = WORLD.HEIGHT;

// 每种实体的配色（与 sim 里的 fruitColor 对应，这里只做渲染）
const PALETTE = {
  fruit: { light: '#ff7a85', mid: '#ff4757', dark: '#b71540', leaf: '#3ddc84' },
  golden: { light: '#fff1a8', mid: '#ffc93c', dark: '#d99a06', leaf: '#7ce4ff' },
  bomb: { light: '#3a3a48', mid: '#22222c', dark: '#0c0c12', fuse: '#ffb300', ring: '#ff3b4a' },
  rock: { light: '#aeb6c6', mid: '#7c8394', dark: '#4a4f5c' },
};

const reducedMotion = typeof window !== 'undefined'
  && typeof window.matchMedia === 'function'
  && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function rr(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const dpr = Math.min((typeof window !== 'undefined' && window.devicePixelRatio) || 1, 2);
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  let t = 0;

  // ---------- 背景 ----------
  function drawBackground() {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#0b0f2a');
    g.addColorStop(0.5, '#131a3f');
    g.addColorStop(1, '#0a0d1f');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // 霓虹网格（透视感地面）
    ctx.save();
    ctx.strokeStyle = 'rgba(120, 160, 255, 0.10)';
    ctx.lineWidth = 1;
    const horizon = H * 0.62;
    for (let i = 0; i <= 12; i += 1) {
      const x = (i / 12) * W;
      ctx.beginPath();
      ctx.moveTo(x, horizon);
      ctx.lineTo(W / 2 + (x - W / 2) * 2.4, H);
      ctx.stroke();
    }
    for (let i = 0; i <= 6; i += 1) {
      const y = horizon + ((H - horizon) * i) / 6;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }
    ctx.restore();

    // 环境光晕 + 漂浮星点
    const bob = reducedMotion ? 0 : Math.sin(t * 0.8);
    const glow = ctx.createRadialGradient(W / 2, H * 0.34, 40, W / 2, H * 0.34, 360);
    glow.addColorStop(0, `rgba(120, 90, 255, ${0.14 + 0.04 * bob})`);
    glow.addColorStop(1, 'rgba(120, 90, 255, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    for (let i = 0; i < 40; i += 1) {
      const sx = ((i * 173.7) % W + W) % W;
      const sy = ((i * 97.3) % (H * 0.55) + H * 0.05) % H;
      const tw = 0.4 + 0.6 * Math.abs(Math.sin(t * 1.4 + i));
      ctx.globalAlpha = tw * 0.5;
      ctx.fillRect(sx, sy, 2, 2);
    }
    ctx.globalAlpha = 1;

    // 底部光带
    const band = ctx.createLinearGradient(0, H - 90, 0, H);
    band.addColorStop(0, 'rgba(255, 60, 120, 0)');
    band.addColorStop(1, 'rgba(255, 60, 120, 0.12)');
    ctx.fillStyle = band;
    ctx.fillRect(0, H - 90, W, 90);
  }

  // ---------- 单个实体（水果/炸弹/岩石/金果）----------
  function drawBody(x, y, r, type, color, rotation) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rotation || 0);

    if (type === 'bomb') {
      // 暗黑球体 + 红色脉冲环 + 引信火花
      const pulse = 1 + 0.08 * Math.sin(t * 6);
      const bg = ctx.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r * 1.15);
      bg.addColorStop(0, PALETTE.bomb.mid);
      bg.addColorStop(1, PALETTE.bomb.dark);
      ctx.fillStyle = bg;
      ctx.beginPath();
      ctx.arc(0, 0, r * pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = PALETTE.bomb.ring;
      ctx.lineWidth = 3;
      ctx.globalAlpha = 0.85;
      ctx.stroke();
      ctx.globalAlpha = 1;
      // 骷髅 X 标记
      ctx.strokeStyle = 'rgba(255,255,255,0.85)';
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-r * 0.4, -r * 0.4); ctx.lineTo(r * 0.4, r * 0.4);
      ctx.moveTo(r * 0.4, -r * 0.4); ctx.lineTo(-r * 0.4, r * 0.4);
      ctx.stroke();
      // 引信
      ctx.strokeStyle = PALETTE.bomb.fuse;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(r * 0.2, -r * 0.85);
      ctx.quadraticCurveTo(r * 0.6, -r * 1.3, r * 0.9, -r * 1.05);
      ctx.stroke();
      const spark = ctx.createRadialGradient(r * 0.9, -r * 1.05, 1, r * 0.9, -r * 1.05, 8);
      spark.addColorStop(0, '#fff');
      spark.addColorStop(1, 'rgba(255,140,40,0)');
      ctx.fillStyle = spark;
      ctx.beginPath();
      ctx.arc(r * 0.9, -r * 1.05, 8, 0, Math.PI * 2);
      ctx.fill();
    } else if (type === 'rock') {
      // 岩石：多边形 + 切面
      ctx.fillStyle = color || PALETTE.rock.mid;
      ctx.beginPath();
      const pts = 7;
      for (let i = 0; i < pts; i += 1) {
        const a = (i / pts) * Math.PI * 2 - Math.PI / 2;
        const rr2 = r * (i % 2 === 0 ? 1.05 : 0.82);
        const px = Math.cos(a) * rr2;
        const py = Math.sin(a) * rr2;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = PALETTE.rock.dark;
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.strokeStyle = PALETTE.rock.light;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-r * 0.5, -r * 0.2); ctx.lineTo(-r * 0.1, r * 0.5);
      ctx.moveTo(r * 0.4, -r * 0.45); ctx.lineTo(r * 0.05, r * 0.4);
      ctx.stroke();
    } else {
      // 水果/金果：径向渐变圆 + 高光 + 叶茎
      const c = type === 'golden' ? PALETTE.golden : PALETTE.fruit;
      const midColor = color || c.mid;
      const bg = ctx.createRadialGradient(-r * 0.35, -r * 0.35, r * 0.15, 0, 0, r * 1.1);
      bg.addColorStop(0, c.light);
      bg.addColorStop(0.55, midColor);
      bg.addColorStop(1, c.dark);
      ctx.fillStyle = bg;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fill();
      // 高光
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(-r * 0.25, -r * 0.3, r * 0.55, Math.PI * 0.9, Math.PI * 1.6);
      ctx.stroke();
      // 茎 + 叶
      ctx.strokeStyle = '#7a5c3a';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(0, -r);
      ctx.lineTo(r * 0.15, -r * 1.35);
      ctx.stroke();
      ctx.fillStyle = c.leaf;
      ctx.beginPath();
      ctx.ellipse(r * 0.55, -r * 1.05, r * 0.42, r * 0.18, -0.6, 0, Math.PI * 2);
      ctx.fill();
      if (type === 'golden') {
        // 四角星芒
        const tw = 0.5 + 0.5 * Math.sin(t * 5);
        ctx.strokeStyle = `rgba(255,255,255,${0.6 + 0.4 * tw})`;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-r * 0.1, -r * 1.7); ctx.lineTo(r * 0.05, -r * 1.1);
        ctx.moveTo(r * 0.1, -r * 1.7); ctx.lineTo(-r * 0.05, -r * 1.1);
        ctx.stroke();
      }
      // 目标指示环（虚线脉冲，读作「可切目标」）
      ctx.save();
      ctx.setLineDash([7, 5]);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, r * 1.32 + Math.sin(t * 5) * 2, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    ctx.restore();
  }

  // 被切开的两半（半圆果瓣 + 亮色切面，清楚读作「被切开的水果」）
  function drawSplit(s) {
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.rotate(s.rotation);
    ctx.globalAlpha = Math.max(0, Math.min(1, s.ttl / 0.6));
    const c = s.type === 'golden' ? PALETTE.golden : s.type === 'rock' ? PALETTE.rock : PALETTE.fruit;
    const r = FRUIT.radius * 0.85;
    // 果皮半圆
    ctx.fillStyle = s.color || c.mid;
    ctx.beginPath();
    ctx.arc(0, 0, r, Math.PI, 0);
    ctx.closePath();
    ctx.fill();
    // 果肉切面（亮色）
    ctx.fillStyle = 'rgba(255, 244, 214, 0.92)';
    ctx.fillRect(-r, -2, r * 2, 4);
    ctx.strokeStyle = c.dark;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-r, 0);
    ctx.lineTo(r, 0);
    ctx.stroke();
    ctx.restore();
  }

  // 粒子
  function drawParticles(list) {
    for (const p of list) {
      ctx.globalAlpha = Math.max(0, Math.min(1, p.ttl / 0.4));
      ctx.fillStyle = p.color || '#fff';
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size || 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // 刀光拖尾
  function drawTrails(trails) {
    for (const tr of trails) {
      const a = Math.max(0, Math.min(1, tr.ttl / 0.24));
      ctx.save();
      ctx.lineCap = 'round';
      ctx.strokeStyle = `rgba(150, 220, 255, ${0.35 * a})`;
      ctx.lineWidth = 14;
      ctx.beginPath();
      ctx.moveTo(tr.x0, tr.y0);
      ctx.lineTo(tr.x1, tr.y1);
      ctx.stroke();
      ctx.strokeStyle = `rgba(255, 255, 255, ${0.9 * a})`;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.moveTo(tr.x0, tr.y0);
      ctx.lineTo(tr.x1, tr.y1);
      ctx.stroke();
      ctx.restore();
    }
  }

  // 全屏闪白
  function drawFlash(flash) {
    if (!flash || flash <= 0) return;
    ctx.fillStyle = `rgba(255, 255, 255, ${Math.max(0, Math.min(1, flash))})`;
    ctx.fillRect(0, 0, W, H);
  }

  // 得分飘字（+N）
  function drawPopups(popups) {
    for (const p of popups || []) {
      const a = Math.max(0, Math.min(1, p.ttl / 0.7));
      ctx.save();
      ctx.globalAlpha = a;
      ctx.font = '800 34px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.lineWidth = 5;
      ctx.strokeStyle = 'rgba(0,0,0,0.55)';
      ctx.strokeText(p.text, p.x, p.y);
      ctx.fillStyle = '#ffe066';
      ctx.fillText(p.text, p.x, p.y);
      ctx.restore();
    }
  }

  // 标题装饰场景
  function drawTitleDeco() {
    const items = [
      { x: W * 0.22, y: H * 0.42, type: 'fruit', color: '#ff4757', rot: 0.4 },
      { x: W * 0.36, y: H * 0.26, type: 'golden', color: '#ffc93c', rot: 1.1 },
      { x: W * 0.5, y: H * 0.36, type: 'fruit', color: '#7fe06a', rot: 2.0 },
      { x: W * 0.64, y: H * 0.24, type: 'rock', color: '#7c8394', rot: 0.2 },
      { x: W * 0.78, y: H * 0.42, type: 'fruit', color: '#ffa63d', rot: 1.6 },
      { x: W * 0.28, y: H * 0.6, type: 'bomb', color: '#22222c', rot: 0.0 },
      { x: W * 0.72, y: H * 0.6, type: 'fruit', color: '#ffd24a', rot: 2.4 },
    ];
    for (const it of items) {
      const bobY = reducedMotion ? 0 : Math.sin(t * 1.6 + it.x) * 8;
      drawBody(it.x, it.y + bobY, FRUIT.radius * 1.05, it.type, it.color, it.rot);
    }
    // 底部大标题光晕由 DOM 负责，这里只留一点分隔线
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    ctx.fillRect(0, H * 0.72, W, 2);
  }

  return {
    render(sim, opts = {}) {
      const { phase = 'playing', fx = {} } = opts;
      t += reducedMotion ? 0 : 1 / 60;
      drawBackground();

      if (!sim || phase === 'title' || phase === 'tutorial') {
        drawTitleDeco();
        return;
      }

      // 飞行实体
      for (const f of sim.state.fruits) {
        drawBody(f.x, f.y, f.radius, f.type, f.color, f.rotation);
      }
      for (const s of sim.state.splits) drawSplit(s);
      drawParticles(sim.state.particles);
      drawTrails(fx.trails || []);
      drawPopups(fx.popups || []);
      drawFlash(fx.flash || 0);
    },

    resize() {
      const d = Math.min((typeof window !== 'undefined' && window.devicePixelRatio) || 1, 2);
      canvas.width = W * d;
      canvas.height = H * d;
      ctx.setTransform(d, 0, 0, d, 0, 0);
    },
  };
}
