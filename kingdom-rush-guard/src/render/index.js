// Canvas 2D 渲染：霓虹街机风（纯程序化，零素材）。
import { WORLD } from '../../config/game.config.js';
import { LEVELS, ENEMY_DEFS, TOWER_DEFS, TOWER_ORDER } from '../../config/levels.js';

const SCENES = {
  'neon-violet': ['#0a0618', '#170b2e', '#2a1440'],
  'neon-cyan': ['#041014', '#07222a', '#0a3a44'],
  'neon-gold': ['#0d0a04', '#221607', '#3a2608'],
};

const TOWER_COLOR = {
  laser: '#ff5470',
  tesla: '#b983ff',
  rail: '#ff9f1c',
  drone: '#2de2e6',
};

function withGlow(ctx, color, blur, fn) {
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = blur;
  fn();
  ctx.restore();
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  canvas.width = WORLD.WIDTH;
  canvas.height = WORLD.HEIGHT;
  let tGlobal = 0;

  function bg(sceneKey) {
    const [c0, c1, c2] = SCENES[sceneKey] || SCENES['neon-violet'];
    const g = ctx.createLinearGradient(0, 0, 0, WORLD.HEIGHT);
    g.addColorStop(0, c0);
    g.addColorStop(0.55, c1);
    g.addColorStop(1, c2);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);

    // 微弱星点网格
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    for (let y = 0; y < WORLD.HEIGHT; y += 40) {
      for (let x = 0; x < WORLD.WIDTH; x += 40) {
        if (((x * 7 + y * 13) % 40) === 0) ctx.fillRect(x, y, 2, 2);
      }
    }
  }

  function path(pts, color) {
    ctx.save();
    ctx.strokeStyle = 'rgba(90,70,150,0.55)';
    ctx.lineWidth = 18;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i += 1) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.stroke();

    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.shadowColor = color;
    ctx.shadowBlur = 12;
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i += 1) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.stroke();
    ctx.restore();
  }

  function base(x, y, hpRatio, time) {
    ctx.save();
    const pulse = 0.6 + Math.sin(time * 3) * 0.3;
    // 光柱：明确这是要守的目标
    ctx.fillStyle = 'rgba(126,249,255,0.10)';
    ctx.fillRect(x - 34, y - 120, 68, 250);
    // 城墙（要塞）
    withGlow(ctx, '#7ef9ff', 20, () => {
      ctx.fillStyle = '#12314a';
      ctx.strokeStyle = '#7ef9ff';
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.moveTo(x - 44, y + 130);
      ctx.lineTo(x - 44, y - 44);
      ctx.lineTo(x - 14, y - 86);
      ctx.lineTo(x + 14, y - 86);
      ctx.lineTo(x + 44, y - 44);
      ctx.lineTo(x + 44, y + 130);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    });
    // 核心钻石（会呼吸）
    withGlow(ctx, '#ffe066', 26 * pulse, () => {
      ctx.fillStyle = '#ffe066';
      ctx.beginPath();
      ctx.moveTo(x, y - 32);
      ctx.lineTo(x + 22, y);
      ctx.lineTo(x, y + 32);
      ctx.lineTo(x - 22, y);
      ctx.closePath();
      ctx.fill();
    });
    // 目标标签
    ctx.fillStyle = '#7ef9ff';
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('DEFEND', x, y - 104);
    // 血条
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(x - 44, y + 140, 88, 10);
    ctx.fillStyle = hpRatio > 0.5 ? '#4ade80' : hpRatio > 0.25 ? '#fbbf24' : '#f87171';
    ctx.fillRect(x - 44, y + 140, 88 * Math.max(0, hpRatio), 10);
    ctx.restore();
  }

  function spawnPortal(x, y, time) {
    const pulse = 0.6 + Math.sin(time * 4) * 0.3;
    ctx.save();
    withGlow(ctx, '#ff5470', 16 * pulse, () => {
      ctx.strokeStyle = '#ff5470';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(x, y, 16, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x - 8, y); ctx.lineTo(x + 8, y);
      ctx.moveTo(x, y - 8); ctx.lineTo(x, y + 8);
      ctx.stroke();
    });
    ctx.restore();
  }

  function spawnZone(level, time) {
    for (let lane = 0; lane < 3; lane += 1) {
      const p = level.paths[lane][0];
      spawnPortal(p[0], p[1], time);
    }
    ctx.save();
    ctx.fillStyle = '#ff9aa8';
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText('◄ ENEMIES', 1212, 88);
    ctx.restore();
  }

  function hexagon(cx, cy, r) {
    ctx.beginPath();
    for (let i = 0; i < 6; i += 1) {
      const a = (Math.PI / 3) * i - Math.PI / 2;
      const px = cx + r * Math.cos(a);
      const py = cy + r * Math.sin(a);
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
  }

  function buildSpot(spot, hovered, selected) {
    ctx.save();
    const r = 22;
    if (spot.blocked) {
      // 岩石封锁（✕ 表示不可建造）
      ctx.fillStyle = '#332848';
      ctx.strokeStyle = '#8a7fb0';
      ctx.lineWidth = 2;
      hexagon(spot.x, spot.y, r);
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = '#b9aede';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(spot.x - 9, spot.y - 9); ctx.lineTo(spot.x + 9, spot.y + 9);
      ctx.moveTo(spot.x + 9, spot.y - 9); ctx.lineTo(spot.x - 9, spot.y + 9);
      ctx.stroke();
    } else {
      const col = selected ? '#ffe066' : hovered ? '#7ef9ff' : 'rgba(150,130,220,0.9)';
      ctx.strokeStyle = col;
      ctx.lineWidth = selected || hovered ? 3 : 2;
      ctx.setLineDash([6, 6]);
      ctx.shadowColor = col;
      ctx.shadowBlur = selected || hovered ? 14 : 6;
      hexagon(spot.x, spot.y, r);
      ctx.stroke();
      ctx.setLineDash([]);
      // 中心点
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(spot.x, spot.y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function tower(t, time) {
    const col = TOWER_COLOR[t.type];
    ctx.save();
    withGlow(ctx, col, 16, () => {
      // 底座
      ctx.fillStyle = 'rgba(20,16,40,0.9)';
      ctx.strokeStyle = col;
      ctx.lineWidth = 3;
      hexagon(t.x, t.y, 24);
      ctx.fill();
      ctx.stroke();
    });

    // 塔形（按类型）
    ctx.fillStyle = col;
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1.5;
    if (t.type === 'laser') {
      ctx.beginPath(); ctx.moveTo(t.x, t.y - 18); ctx.lineTo(t.x - 6, t.y + 8); ctx.lineTo(t.x + 6, t.y + 8); ctx.closePath(); ctx.fill();
    } else if (t.type === 'tesla') {
      ctx.beginPath(); ctx.arc(t.x, t.y, 9, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#fff';
      ctx.beginPath(); ctx.moveTo(t.x, t.y - 14); ctx.lineTo(t.x, t.y + 14); ctx.moveTo(t.x - 14, t.y); ctx.lineTo(t.x + 14, t.y); ctx.stroke();
    } else if (t.type === 'rail') {
      ctx.fillRect(t.x - 10, t.y - 10, 20, 20);
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(t.x, t.y, 4, 0, Math.PI * 2); ctx.fill();
    } else {
      // drone：旋转小旋翼
      const a = time * 6;
      for (let i = 0; i < 3; i += 1) {
        const ang = a + i * (Math.PI * 2 / 3);
        ctx.fillStyle = col;
        ctx.beginPath();
        ctx.ellipse(t.x + Math.cos(ang) * 12, t.y + Math.sin(ang) * 12, 7, 3, ang, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(t.x, t.y, 5, 0, Math.PI * 2); ctx.fill();
    }

    // 等级点
    ctx.fillStyle = '#ffe066';
    for (let i = 0; i < t.level; i += 1) {
      ctx.fillRect(t.x - 12 + i * 7, t.y + 18, 5, 5);
    }
    ctx.restore();
  }

  function enemy(e, time) {
    const def = ENEMY_DEFS[e.type];
    ctx.save();
    withGlow(ctx, def.color, 14, () => {
      ctx.fillStyle = def.color;
      ctx.beginPath();
      ctx.arc(e.x, e.y, def.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(e.x - 3, e.y - 2, 2.5, 0, Math.PI * 2);
      ctx.arc(e.x + 3, e.y - 2, 2.5, 0, Math.PI * 2);
      ctx.fill();
    });
    // 血条
    const w = def.radius * 2 + 4;
    const ratio = e.hp / e.maxHp;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(e.x - w / 2, e.y - def.radius - 8, w, 4);
    ctx.fillStyle = ratio > 0.5 ? '#4ade80' : '#f87171';
    ctx.fillRect(e.x - w / 2, e.y - def.radius - 8, w * Math.max(0, ratio), 4);
    // 减速标志
    if (e.slowUntil > time) {
      ctx.strokeStyle = '#7ef9ff';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(e.x, e.y, def.radius + 4, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  function core(c, time) {
    const pulse = 1 + Math.sin(time * 5) * 0.2;
    ctx.save();
    withGlow(ctx, '#ffe066', 18, () => {
      ctx.fillStyle = '#ffe066';
      ctx.beginPath();
      ctx.arc(c.x, c.y, 9 * pulse, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.fillStyle = '#7a5c00';
    ctx.font = 'bold 10px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('◆', c.x, c.y);
    ctx.restore();
  }

  function particles(fxQueue, time) {
    for (const fx of fxQueue) {
      if (fx.ttl <= 0) continue;
      const a = Math.max(0, fx.ttl / fx.max);
      ctx.save();
      ctx.globalAlpha = a;
      if (fx.kind === 'muzzle') {
        withGlow(ctx, fx.color || '#fff', 12, () => {
          ctx.fillStyle = fx.color || '#fff';
          ctx.beginPath(); ctx.arc(fx.x, fx.y, 8 * a + 2, 0, Math.PI * 2); ctx.fill();
        });
      } else if (fx.kind === 'boom') {
        withGlow(ctx, '#ffb347', 20, () => {
          ctx.strokeStyle = '#ffb347';
          ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(fx.x, fx.y, (1 - a) * 30 + 4, 0, Math.PI * 2); ctx.stroke();
        });
      } else if (fx.kind === 'orbital') {
        withGlow(ctx, '#ffffff', 30, () => {
          ctx.fillStyle = `rgba(255,255,255,${a * 0.35})`;
          ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
        });
      }
      ctx.restore();
    }
  }

  function draw(state, dt, view) {
    tGlobal += dt;
    const time = state ? state.time : tGlobal;
    const level = state ? LEVELS[(state.level - 1) || 0] : LEVELS[0];
    const sceneKey = (view && view.sceneKey) || level.scene;

    bg(sceneKey);

    if (!state) return;

    for (let i = 0; i < level.paths.length; i += 1) {
      const colors = ['#ff5470', '#2de2e6', '#b983ff'];
      path(level.paths[i], colors[i % colors.length]);
    }

    for (const spot of level.buildSpots) {
      const hovered = view && view.hoverSpot === spot.id;
      const selected = view && view.selectedSpot === spot.id;
      buildSpot(spot, hovered, selected);
    }

    for (const t of state.towers) tower(t, time);
    for (const c of state.cores) core(c, time);
    for (const e of state.enemies) enemy(e, time);

    base(92, 360, state.baseHp / state.baseMaxHp, time);
    spawnZone(level, time);

    if (view) {
      particles(view.fxQueue || [], time);
    }

    // 超载提示
    if (state.overdrive) {
      ctx.save();
      ctx.strokeStyle = '#ffe066';
      ctx.lineWidth = 4;
      ctx.shadowColor = '#ffe066';
      ctx.shadowBlur = 18;
      ctx.globalAlpha = 0.55 + Math.sin(time * 8) * 0.2;
      ctx.strokeRect(6, 6, WORLD.WIDTH - 12, WORLD.HEIGHT - 12);
      ctx.restore();
    }
  }

  return { draw };
}
