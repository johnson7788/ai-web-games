// LIL HERO SAGA · Canvas 2D 渲染（霓虹街机，纯程序化，零素材）
// 相机水平跟随玩家；DPR ≤2；所有形状程序化。
import { WORLD } from '../../config/game.config.js';
import { LEVEL } from '../../config/levels.js';

const GROUND_Y = LEVEL.groundY;
const COLOR = {
  red: '#ff2d55', yellow: '#ffd60a', blue: '#0a84ff',
  orange: '#ff9500', purple: '#bf5af2', green: '#30d158', white: '#f5f5ff',
};
const ENEMY_COLOR = {
  walker: '#ff375f', archer: '#ff9f0a', bat: '#bf5af2', sworder: '#64d2ff', wizard: '#ff6482', boss: '#ff2d55',
};

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

function glow(ctx, x, y, r, color, alpha = 0.5) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, color);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.globalAlpha = alpha;
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
  ctx.globalAlpha = 1;
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const dpr = Math.min(2, (typeof window !== 'undefined' && window.devicePixelRatio) || 1);
  canvas.width = WORLD.WIDTH * dpr;
  canvas.height = WORLD.HEIGHT * dpr;

  let stars = [];
  for (let i = 0; i < 90; i += 1) {
    stars.push({ x: Math.random() * WORLD.WIDTH, y: Math.random() * 420, s: Math.random() * 2 + 0.5, p: Math.random() });
  }

  function cameraX(state) {
    if (!state) return 0;
    const cx = state.player.x + state.player.w / 2 - WORLD.WIDTH / 2;
    return Math.max(0, Math.min(state.width - WORLD.WIDTH, cx));
  }

  function drawBackground(state, t, cam) {
    const g = ctx.createLinearGradient(0, 0, 0, WORLD.HEIGHT);
    g.addColorStop(0, '#0d0722');
    g.addColorStop(0.6, '#1c0b3a');
    g.addColorStop(1, '#2a0f4a');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);

    // 星星（视差）
    ctx.fillStyle = '#c9b8ff';
    for (const st of stars) {
      const sx = (st.x - cam * st.p * 0.3 + WORLD.WIDTH * 10) % WORLD.WIDTH;
      ctx.globalAlpha = 0.3 + 0.4 * st.p;
      ctx.fillRect(sx, st.y, st.s, st.s);
    }
    ctx.globalAlpha = 1;

    // 城市天际线（远层）
    ctx.fillStyle = '#2b1155';
    for (let i = 0; i < 14; i += 1) {
      const bw = 70 + ((i * 53) % 60);
      const bh = 60 + ((i * 97) % 130);
      const bx = i * 110 - cam * 0.2;
      ctx.fillRect(((bx % (WORLD.WIDTH + 120)) + WORLD.WIDTH + 120) % (WORLD.WIDTH + 120) - 60, GROUND_Y - bh, bw, bh);
    }

    // 网格地面（近层）
    ctx.strokeStyle = 'rgba(120, 60, 220, 0.25)';
    ctx.lineWidth = 1;
    for (let gx = -cam + (cam % 40); gx < WORLD.WIDTH + 40; gx += 40) {
      ctx.beginPath();
      ctx.moveTo(gx, GROUND_Y);
      ctx.lineTo(gx - 24, WORLD.HEIGHT);
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(180, 120, 255, 0.5)';
    ctx.beginPath();
    ctx.moveTo(0, GROUND_Y);
    ctx.lineTo(WORLD.WIDTH, GROUND_Y);
    ctx.stroke();
  }

  function worldX(x, cam) { return x - cam; }

  function drawGround(state, cam) {
    ctx.fillStyle = '#160a30';
    for (const seg of LEVEL.groundSegments) {
      const x0 = worldX(seg.x, cam);
      const x1 = worldX(seg.x + seg.w, cam);
      if (x1 < 0 || x0 > WORLD.WIDTH) continue;
      ctx.fillRect(x0, GROUND_Y, x1 - x0, WORLD.HEIGHT - GROUND_Y);
      // 霓虹顶边
      ctx.fillStyle = '#7a3ce0';
      ctx.fillRect(x0, GROUND_Y, x1 - x0, 3);
      ctx.fillStyle = '#160a30';
    }
    // 平台
    for (const pl of LEVEL.platforms) {
      const x0 = worldX(pl.x, cam);
      if (x0 + pl.w < 0 || x0 > WORLD.WIDTH) continue;
      ctx.fillStyle = '#1d0c3c';
      roundRect(ctx, x0, pl.y, pl.w, pl.h, 4);
      ctx.fill();
      ctx.fillStyle = '#39e6d0';
      roundRect(ctx, x0, pl.y, pl.w, 3, 2);
      ctx.fill();
    }
  }

  function drawRock(state, cam) {
    for (const r of state.rocks) {
      const x0 = worldX(r.x, cam);
      if (x0 + r.w < -10 || x0 > WORLD.WIDTH + 10) continue;
      const c = COLOR[r.color] || '#ffffff';
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.fillRect(x0 - 2, r.y + 2, r.w + 4, r.h);
      ctx.fillStyle = c;
      roundRect(ctx, x0, r.y, r.w, r.h, 5);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.fillRect(x0 + 6, r.y + 8, 5, r.h - 16);
      glow(ctx, x0 + r.w / 2, r.y + r.h / 2, 22, c, 0.35);
    }
  }

  function drawFlag(state, cam) {
    if (state.flag.reached) return;
    const x0 = worldX(state.flag.x, cam);
    if (x0 < -20 || x0 > WORLD.WIDTH + 20) return;
    ctx.fillStyle = '#c9c9d8';
    ctx.fillRect(x0, GROUND_Y - 120, 4, 120);
    ctx.fillStyle = '#ffd60a';
    ctx.beginPath();
    ctx.moveTo(x0 + 4, GROUND_Y - 120);
    ctx.lineTo(x0 + 48, GROUND_Y - 106);
    ctx.lineTo(x0 + 4, GROUND_Y - 92);
    ctx.closePath();
    ctx.fill();
    glow(ctx, x0 + 4, GROUND_Y - 100, 26, '#ffd60a', 0.5);
  }

  function drawPlayer(state, t, cam) {
    const p = state.player;
    const x0 = worldX(p.x, cam);
    const cy = p.y + p.h / 2;
    const aura = p.aura && COLOR[p.aura] ? COLOR[p.aura] : null;

    // 冲刺残影
    if (p.dashT > 0) {
      ctx.globalAlpha = 0.3;
      ctx.fillStyle = aura || '#ffd60a';
      roundRect(ctx, x0 - p.facing * 12, p.y, p.w, p.h, 14);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    // 身体
    const bodyColor = aura || (p.invincible > 0 && Math.floor(t * 12) % 2 === 0 ? '#ffffff' : '#7ef0ff');
    glow(ctx, x0 + p.w / 2, cy, 26, bodyColor, 0.45);
    ctx.fillStyle = bodyColor;
    roundRect(ctx, x0, p.y, p.w, p.h, 14);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    roundRect(ctx, x0, p.y, p.w, p.h, 14);
    ctx.stroke();
    ctx.fillStyle = '#0a1c2e';
    ctx.fillRect(x0 + (p.facing > 0 ? 18 : 5), p.y + 10, 6, 6);
    ctx.fillRect(x0 + (p.facing > 0 ? 18 : 5), p.y + 22, 6, 6);

    // 持有颜色指示（三色小点）
    const heldColors = p.held.length ? p.held : [];
    heldColors.forEach((c, i) => {
      ctx.fillStyle = COLOR[c];
      ctx.beginPath();
      ctx.arc(x0 + p.w / 2 + (i - (heldColors.length - 1) / 2) * 12, p.y - 8, 5, 0, Math.PI * 2);
      ctx.fill();
    });
  }

  function drawEnemy(state, t, cam) {
    for (const e of state.enemies) {
      const x0 = worldX(e.x, cam);
      if (x0 + e.w < -20 || x0 > WORLD.WIDTH + 20) continue;
      const c = ENEMY_COLOR[e.type] || '#ff375f';
      const cy = e.y + e.h / 2;
      glow(ctx, x0 + e.w / 2, cy, 20, c, e.slow > 0 ? 0.7 : 0.35);

      if (e.type === 'bat') {
        ctx.fillStyle = c;
        const wing = Math.sin(t * 12) * 6;
        ctx.beginPath();
        ctx.moveTo(x0 + e.w / 2, e.y + e.h / 2);
        ctx.quadraticCurveTo(x0 - wing, e.y - 4, x0 + e.w / 2 - wing, e.y);
        ctx.quadraticCurveTo(x0 + e.w / 2, e.y + e.h / 2, x0 + e.w / 2 + wing, e.y);
        ctx.fill();
      } else if (e.type === 'archer') {
        ctx.fillStyle = c;
        ctx.fillRect(x0, e.y + e.h - 6, e.w, 6);
        ctx.fillRect(x0 + e.w / 2 - 3, e.y, 6, e.h - 4);
        ctx.fillRect(x0 + (e.facing > 0 ? e.w - 2 : -2), e.y + 10, 10, 3);
      } else if (e.type === 'wizard' || e.type === 'boss') {
        ctx.fillStyle = c;
        ctx.beginPath();
        ctx.arc(x0 + e.w / 2, e.y + e.h / 3, e.w / 2.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(x0 + e.w / 2 - 2, e.y + e.h / 3 - 12, 4, 8);
      } else {
        // walker / sworder：带刺的团
        ctx.fillStyle = c;
        roundRect(ctx, x0, e.y, e.w, e.h, 8);
        ctx.fill();
        ctx.fillStyle = 'rgba(0,0,0,0.35)';
        for (let s = 0; s < 3; s += 1) {
          ctx.beginPath();
          ctx.arc(x0 + 6 + s * 10, e.y - 3, 3, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // 血条（非满血时）
      if (e.hp < e.maxHp && (e.type === 'wizard' || e.type === 'boss')) {
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(x0, e.y - 8, e.w, 4);
        ctx.fillStyle = '#ff2d55';
        ctx.fillRect(x0, e.y - 8, e.w * Math.max(0, e.hp / e.maxHp), 4);
      }
    }
  }

  function drawProjectiles(state, cam) {
    for (const pr of state.projectiles) {
      const x0 = worldX(pr.x, cam);
      if (x0 + pr.w < -10 || x0 > WORLD.WIDTH + 10) continue;
      const c = pr.from === 'player' ? (COLOR[pr.color] || '#fff') : '#ff5f8f';
      glow(ctx, x0 + pr.w / 2, pr.y + pr.h / 2, 14, c, 0.6);
      ctx.fillStyle = c;
      if (pr.type === 'arrow') {
        ctx.fillRect(x0, pr.y, pr.w, pr.h);
      } else {
        ctx.beginPath();
        ctx.arc(x0 + pr.w / 2, pr.y + pr.h / 2, pr.w / 2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    for (const b of state.beams) {
      const x0 = worldX(b.x, cam);
      glow(ctx, x0 + b.w / 2, b.y + b.h / 2, 20, '#ff2d55', 0.7);
      ctx.fillStyle = '#ff2d55';
      ctx.fillRect(x0, b.y, b.w, b.h);
    }
  }

  function drawPickups(state, t, cam) {
    for (const pk of state.pickups) {
      if (pk.taken) continue;
      const x0 = worldX(pk.x, cam);
      if (x0 < -20 || x0 > WORLD.WIDTH + 20) continue;
      if (pk.kind === 'bottle') {
        const c = COLOR[pk.color] || '#fff';
        ctx.fillStyle = c;
        roundRect(ctx, x0 - 6, pk.y - 14 + Math.sin(t * 3 + pk.x) * 3, 12, 18, 4);
        ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.6)';
        ctx.fillRect(x0 - 4, pk.y - 8, 8, 3);
      } else {
        ctx.fillStyle = '#ffd60a';
        ctx.beginPath();
        ctx.arc(x0, pk.y + Math.sin(t * 2 + pk.x) * 3, 6, 0, Math.PI * 2);
        ctx.fill();
        glow(ctx, x0, pk.y, 14, '#ffd60a', 0.5);
      }
    }
  }

  function drawFx(state, t, view, cam) {
    for (const fx of view.fxQueue || []) {
      if (fx.type === 'ring' && fx.ttl > 0) {
        const x0 = worldX(fx.x, cam);
        const r = (1 - fx.ttl / fx.max) * fx.r;
        ctx.strokeStyle = fx.color || '#ffd60a';
        ctx.globalAlpha = Math.max(0, fx.ttl / fx.max);
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(x0, fx.y, r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
      }
    }
  }

  // 目标指引：向右的发光箭头 + 旗标（保证目标在任意截图里可见）
  function drawGoalMarker(state, t) {
    if (!state || state.phase !== 'playing') return;
    const isBoss = state.act >= 2 && state.enemies.some((e) => e.type === 'boss');
    const x = WORLD.WIDTH - 46;
    const y = 64;
    const c = isBoss ? '#ff2d55' : '#ffd60a';
    const pulse = 0.6 + 0.4 * Math.sin(t * 4);
    glow(ctx, x, y, 26, c, 0.5 * pulse);
    ctx.fillStyle = c;
    // 箭头
    ctx.beginPath();
    ctx.moveTo(x - 12, y - 10);
    ctx.lineTo(x + 8, y);
    ctx.lineTo(x - 12, y + 10);
    ctx.closePath();
    ctx.fill();
    // 旗标 / Boss 点
    if (isBoss) {
      ctx.beginPath();
      ctx.arc(x - 22, y, 6, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillRect(x - 24, y - 12, 3, 24);
      ctx.beginPath();
      ctx.moveTo(x - 21, y - 12);
      ctx.lineTo(x - 4, y - 6);
      ctx.lineTo(x - 21, y);
      ctx.closePath();
      ctx.fill();
    }
  }

  function draw(state, dt, view = {}) {
    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const cam = cameraX(state);
    const t = state ? state.time : 0;
    const shake = view.shake || 0;
    if (shake > 0) {
      ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
    }

    drawBackground(state, t, cam);
    if (!state) { ctx.restore(); return; }
    drawGround(state, cam);
    drawRock(state, cam);
    drawFlag(state, cam);
    drawPickups(state, t, cam);
    drawProjectiles(state, cam);
    drawEnemy(state, t, cam);
    drawPlayer(state, t, cam);
    drawFx(state, t, view, cam);
    drawGoalMarker(state, t);
    ctx.restore();
  }

  return {
    draw,
    // 视觉评审/教程用布局（无真实 DOM 交互位，返回 HUD 大致区域）
    debugLayout() {
      return {
        hud: { x: 0, y: 0, w: WORLD.WIDTH, h: 56 },
        player: { x: 200, y: 300, w: 60, h: 60 },
      };
    },
  };
}
