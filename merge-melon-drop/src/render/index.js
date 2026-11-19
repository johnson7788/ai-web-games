// MERGE MELON DROP · Canvas 2D 渲染（霓虹街机风格，程序化，无任何素材文件）
//
// 画：深空渐变背景 + 网格、霓虹容器、警示虚线、持球 + 下落引导线、
//     霓虹水果（径向渐变 + 描边辉光 + 表情 + 阶数）、岩石、粒子特效（合成/压碎/星爆）。
// 性能：DPR ≤2；粒子池上限分档；prefers-reduced-motion 时关闭震屏与粒子。
import { WORLD, TIERS, MAX_TIER, ROCK } from '../../config/game.config.js';

const FONT = "'Segoe UI', 'PingFang SC', 'Hiragino Sans', 'Microsoft YaHei', 'Noto Sans', monospace";

function roundedRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function createRenderer(canvas) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = WORLD.WIDTH * dpr;
  canvas.height = WORLD.HEIGHT * dpr;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  const fx = [];        // 粒子 {x,y,vx,vy,ttl,life,size,color,shape}
  let shake = 0;
  let flash = 0;        // 星爆全屏闪光
  let reduced = false;
  const MAX_FX = 220;

  function addFx(p) {
    if (fx.length >= MAX_FX) fx.shift();
    fx.push(p);
  }

  function burst(x, y, color, count, speed, size) {
    if (reduced) return;
    for (let i = 0; i < count; i += 1) {
      const a = Math.random() * Math.PI * 2;
      const v = (0.3 + Math.random() * 0.7) * speed;
      addFx({
        x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 40,
        ttl: 0.4 + Math.random() * 0.4, life: 0.6,
        size: size * (0.5 + Math.random()), color,
        shape: Math.random() < 0.3 ? 'rect' : 'circle',
      });
    }
  }

  // ---- 背景 ----
  function drawBackground(t) {
    const g = ctx.createLinearGradient(0, 0, 0, WORLD.HEIGHT);
    g.addColorStop(0, '#0b0820');
    g.addColorStop(0.55, '#151033');
    g.addColorStop(1, '#1d1238');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);

    // 网格（淡紫）
    ctx.strokeStyle = 'rgba(140, 120, 220, 0.08)';
    ctx.lineWidth = 1;
    const grid = 48;
    for (let x = (t * 8) % grid; x < WORLD.WIDTH; x += grid) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, WORLD.HEIGHT); ctx.stroke();
    }
    for (let y = 0; y < WORLD.HEIGHT; y += grid) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(WORLD.WIDTH, y); ctx.stroke();
    }

    // 星点
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    for (let i = 0; i < 60; i += 1) {
      const sx = ((i * 173 + 31) % WORLD.WIDTH);
      const sy = ((i * 97 + 17) % WORLD.HEIGHT);
      const tw = 0.4 + 0.6 * Math.abs(Math.sin(t * 1.5 + i));
      ctx.globalAlpha = tw * 0.6;
      ctx.fillRect(sx, sy, 2, 2);
    }
    ctx.globalAlpha = 1;
  }

  // ---- 容器 ----
  function drawContainer() {
    const L = WORLD.WALL_L, R = WORLD.WALL_R, T = WORLD.CEIL_Y, B = WORLD.FLOOR_Y;

    // 内部半透明
    ctx.fillStyle = 'rgba(10, 8, 26, 0.55)';
    ctx.fillRect(L, T, R - L, B - T);

    // 左右壁 + 底部霓虹
    ctx.lineWidth = 3;
    ctx.shadowColor = '#7cf3ff';
    ctx.shadowBlur = 14;
    ctx.strokeStyle = '#37d6e8';
    ctx.beginPath();
    ctx.moveTo(L, T); ctx.lineTo(L, B);
    ctx.moveTo(R, T); ctx.lineTo(R, B);
    ctx.stroke();
    ctx.strokeStyle = '#ff5cd9';
    ctx.shadowColor = '#ff5cd9';
    ctx.beginPath();
    ctx.moveTo(L, B); ctx.lineTo(R, B);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // 顶部开口
    ctx.strokeStyle = 'rgba(55, 214, 232, 0.35)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(L, T); ctx.lineTo(R, T);
    ctx.stroke();
  }

  // ---- 警示虚线（平时很淡，避免被误认成目标线；危险时变红）----
  function drawDashLine(warn) {
    const y = WORLD.DASH_Y;
    ctx.save();
    ctx.lineWidth = warn ? 3 : 2;
    ctx.setLineDash([10, 9]);
    ctx.strokeStyle = warn ? '#ff3355' : 'rgba(255, 90, 110, 0.28)';
    ctx.shadowColor = warn ? '#ff3355' : 'transparent';
    ctx.shadowBlur = warn ? 12 : 0;
    ctx.beginPath();
    ctx.moveTo(WORLD.WALL_L, y);
    ctx.lineTo(WORLD.WALL_R, y);
    ctx.stroke();
    ctx.restore();
    ctx.shadowBlur = 0;
  }

  // ---- 水果 / 岩石 ----
  function drawOrb(x, y, tier, r, opts = {}) {
    const t = TIERS[tier];
    ctx.save();
    // 辉光
    ctx.shadowColor = t.rim;
    ctx.shadowBlur = opts.glow === false ? 0 : 16;

    // 主体径向渐变
    const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r);
    g.addColorStop(0, t.rim);
    g.addColorStop(0.45, t.color);
    g.addColorStop(1, t.dark);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();

    ctx.shadowBlur = 0;
    // 描边
    ctx.strokeStyle = t.rim;
    ctx.lineWidth = Math.max(1.5, r * 0.06);
    ctx.stroke();

    // 高光
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.beginPath();
    ctx.ellipse(x - r * 0.38, y - r * 0.45, r * 0.2, r * 0.13, -0.6, 0, Math.PI * 2);
    ctx.fill();

    // 表情（角色感）
    const eyeY = y - r * 0.08;
    const eyeR = Math.max(1.6, r * 0.12);
    const ex = r * 0.3;
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(x - ex, eyeY, eyeR, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(x + ex, eyeY, eyeR, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#1a1030';
    ctx.beginPath(); ctx.arc(x - ex + eyeR * 0.25, eyeY, eyeR * 0.5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(x + ex + eyeR * 0.25, eyeY, eyeR * 0.5, 0, Math.PI * 2); ctx.fill();
    // 微笑
    ctx.strokeStyle = 'rgba(26,16,48,0.85)';
    ctx.lineWidth = Math.max(1.5, r * 0.07);
    ctx.beginPath();
    ctx.arc(x, y + r * 0.14, r * 0.3, 0.2, Math.PI - 0.2);
    ctx.stroke();

    // 阶数（合成顺序可读）
    if (r >= 24) {
      ctx.fillStyle = 'rgba(255,255,255,0.92)';
      ctx.font = `bold ${Math.round(r * 0.42)}px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(tier), x, y + r * 0.52);
    }
    ctx.restore();
  }

  function drawRock(x, y, r) {
    ctx.save();
    ctx.shadowColor = '#888';
    ctx.shadowBlur = 10;
    const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.35, r * 0.1, x, y, r);
    g.addColorStop(0, '#b9b9c9');
    g.addColorStop(0.5, '#7a7a8c');
    g.addColorStop(1, '#3f3f50');
    ctx.fillStyle = g;
    // 多边形岩石轮廓
    ctx.beginPath();
    const pts = 9;
    for (let i = 0; i < pts; i += 1) {
      const a = (i / pts) * Math.PI * 2;
      const rr = r * (0.86 + 0.14 * Math.sin(i * 5.1));
      const px = x + Math.cos(a) * rr;
      const py = y + Math.sin(a) * rr;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = '#2c2c3a';
    ctx.lineWidth = Math.max(1.5, r * 0.05);
    ctx.stroke();
    // 裂纹
    ctx.strokeStyle = 'rgba(30,30,40,0.7)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x - r * 0.3, y - r * 0.4); ctx.lineTo(x, y - r * 0.05); ctx.lineTo(x - r * 0.15, y + r * 0.4);
    ctx.moveTo(x + r * 0.25, y - r * 0.35); ctx.lineTo(x + r * 0.05, y + r * 0.1);
    ctx.stroke();
    ctx.restore();
  }

  function landingY(state) {
    const r = state.heldTier === -1 ? ROCK.RADIUS : TIERS[state.heldTier].r;
    let top = WORLD.FLOOR_Y;
    for (const b of state.bodies) {
      // 与持球竖线相交的球
      if (Math.abs(b.x - state.heldX) < b.r + r) top = Math.min(top, b.y - b.r);
    }
    return Math.max(WORLD.CEIL_Y + r + 4, Math.min(WORLD.FLOOR_Y - r, top - r));
  }

  function drawHeld(state) {
    const tier = state.heldTier;
    const r = tier === -1 ? ROCK.RADIUS : TIERS[tier].r;
    const x = state.heldX;
    const y = WORLD.HOLD_Y;
    const ly = landingY(state);

    // 明亮下落引导线 + 落点预览圈（把「往哪放」讲清楚）
    ctx.save();
    ctx.strokeStyle = 'rgba(124, 243, 255, 0.9)';
    ctx.lineWidth = 2.5;
    ctx.setLineDash([5, 6]);
    ctx.shadowColor = '#7cf3ff';
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.moveTo(x, y + r);
    ctx.lineTo(x, ly);
    ctx.stroke();
    ctx.restore();

    // 落点预览（虚线圆）
    ctx.save();
    ctx.setLineDash([3, 4]);
    ctx.strokeStyle = 'rgba(124, 243, 255, 0.85)';
    ctx.lineWidth = 2;
    ctx.shadowColor = '#7cf3ff';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(x, ly, r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
    ctx.shadowBlur = 0;

    // 向下箭头
    ctx.save();
    ctx.fillStyle = '#7cf3ff';
    ctx.beginPath();
    ctx.moveTo(x, y + r + 14);
    ctx.lineTo(x - 6, y + r + 4);
    ctx.lineTo(x + 6, y + r + 4);
    ctx.closePath();
    ctx.fill();
    ctx.restore();

    if (tier === -1) drawRock(x, y, r);
    else drawOrb(x, y, tier, r, { glow: true });
  }

  function drawBodies(state) {
    for (const b of state.bodies) {
      if (b.kind === 'rock') drawRock(b.x, b.y, b.r);
      else drawOrb(b.x, b.y, b.tier, b.r, {});
      // 越线警告：球变红闪
      if (b.overLineT > 1) {
        const blink = Math.sin(b.overLineT * 20) > 0;
        if (blink) {
          ctx.save();
          ctx.strokeStyle = '#ff3355';
          ctx.lineWidth = 3;
          ctx.shadowColor = '#ff3355';
          ctx.shadowBlur = 12;
          ctx.beginPath();
          ctx.arc(b.x, b.y, b.r + 2, 0, Math.PI * 2);
          ctx.stroke();
          ctx.restore();
        }
      }
    }
  }

  function drawFx(dt) {
    for (let i = fx.length - 1; i >= 0; i -= 1) {
      const p = fx[i];
      p.ttl -= dt;
      if (p.ttl <= 0) { fx.splice(i, 1); continue; }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 260 * dt;
      const k = Math.max(0, p.ttl / p.life);
      ctx.globalAlpha = k;
      ctx.fillStyle = p.color;
      if (p.shape === 'rect') {
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.ttl * 6);
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
        ctx.restore();
      } else {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  let warnState = false;

  return {
    draw(state, dt) {
      const t = (state ? state.time : 0);
      warnState = false;
      if (state) {
        for (const b of state.bodies) if (b.overLineT > 1) { warnState = true; break; }
      }

      ctx.save();
      if (shake > 0 && !reduced) {
        ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
      }
      drawBackground(t);
      drawContainer();
      drawDashLine(warnState);
      if (state) {
        drawBodies(state);
        if (state.phase === 'playing') drawHeld(state);
      } else {
        // 标题屏：底部摆几个演示水果
        const demoTiers = [0, 1, 2, 3, 4];
        let x = WORLD.WALL_L + 44;
        for (const tier of demoTiers) {
          const r = TIERS[tier].r;
          drawOrb(x, WORLD.FLOOR_Y - r - 4, tier, r, {});
          x += r * 2 + 12;
        }
      }
      drawFx(dt);

      if (flash > 0) {
        ctx.fillStyle = `rgba(255, 235, 150, ${Math.min(1, flash)})`;
        ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
      }
      ctx.restore();
      if (shake > 0) shake = Math.max(0, shake - dt * 40);
      if (flash > 0) flash = Math.max(0, flash - dt * 2.2);
    },

    /** 事件 → 视觉反馈（main 消费 sim 事件时调用） */
    fx(name, payload = {}) {
      switch (name) {
        case 'merge': {
          const tier = payload.tier ?? 0;
          const color = TIERS[Math.min(MAX_TIER, tier + 1)].color;
          burst(payload.x, payload.y, color, reduced ? 0 : 14, 240, 5);
          if (!reduced) shake = Math.min(6, shake + 2);
          break;
        }
        case 'rock_crush':
          burst(payload.x, payload.y, '#9a9aac', reduced ? 0 : 18, 260, 5);
          if (!reduced) shake = Math.min(8, shake + 3);
          break;
        case 'rock':
          burst(payload.x, payload.y, '#7a7a8c', reduced ? 0 : 6, 120, 4);
          break;
        case 'watermelon':
          flash = 0.9;
          burst(payload.x, payload.y, '#ffd54a', reduced ? 0 : 40, 420, 7);
          burst(payload.x, payload.y, '#ff8fb1', reduced ? 0 : 24, 300, 5);
          if (!reduced) shake = 10;
          break;
        case 'combo':
          break;
        default:
          break;
      }
    },

    debugLayout() {
      return {
        container: { x: WORLD.WALL_L, y: WORLD.CEIL_Y, w: WORLD.WALL_R - WORLD.WALL_L, h: WORLD.FLOOR_Y - WORLD.CEIL_Y },
        dashY: WORLD.DASH_Y,
        holdY: WORLD.HOLD_Y,
        wallL: WORLD.WALL_L,
        wallR: WORLD.WALL_R,
        floorY: WORLD.FLOOR_Y,
      };
    },

    setReducedMotion(b) { reduced = !!b; },
  };
}
