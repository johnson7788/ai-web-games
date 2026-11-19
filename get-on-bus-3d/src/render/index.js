// GET ON BUS 3D · 程序化霓虹街机渲染（纯 canvas 2D，零素材）
// 俯视角 + 伪 3D 深度：滚动城市街区、霓虹车道、横穿车、公交车、道具与粒子。
import { WORLD } from '../../config/game.config.js';

const COLORS = {
  bgTop: '#0a0618',
  bgBottom: '#1b0d30',
  road: '#120d20',
  roadEdge: '#2a1f52',
  laneCyan: '#22e6ff',
  laneMagenta: '#ff3ec8',
  dash: '#ffd166',
  busBody: '#eafcff',
  busAccent: '#ff3ec8',
  busGlow: '#22e6ff',
  pickGreen: '#4ade80',
  dropGold: '#ffd166',
  shield: '#22e6ff',
  turbo: '#ffb703',
  coin: '#ffd166',
};

const REDUCED = typeof window !== 'undefined'
  && window.matchMedia
  && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function glow(ctx, color, blur, fn) {
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = blur;
  fn();
  ctx.restore();
}

function rr(ctx, x, y, w, h, r) {
  const rad = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const DPR = Math.min(window.devicePixelRatio || 1, 2);
  let W = WORLD.WIDTH;
  let H = WORLD.HEIGHT;

  function resize() {
    W = canvas.clientWidth || WORLD.WIDTH;
    H = canvas.clientHeight || WORLD.HEIGHT;
    canvas.width = Math.floor(W * DPR);
    canvas.height = Math.floor(H * DPR);
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  }
  resize();
  window.addEventListener('resize', resize);

  // 视觉粒子（纯装饰）
  let particles = [];
  let lastNearMisses = 0;
  let lastPhase = 'countdown';

  function spawn(p) {
    if (particles.length > 60) return;
    particles.push(p);
  }

  // 生成城市街区（确定性，随 camera 滚动）
  function drawCity(camY) {
    const top = camY;
    const bottom = camY + H;
    // 垂直道路两侧的建筑带
    for (const side of [-1, 1]) {
      const x0 = side === -1 ? -WORLD.WIDTH / 2 : 150;
      const x1 = side === -1 ? -150 : WORLD.WIDTH / 2;
      const step = 120;
      const start = Math.floor(top / step) * step;
      for (let y = start; y < bottom; y += step) {
        const seed = Math.floor(y / step);
        const w = 70 + ((seed * 37) % 50);
        const h = step - 16;
        const bx = side === -1 ? x1 - w - 20 : x0 + 20;
        const by = y + 6;
        const hue = (seed % 5);
        const base = hue === 0 ? '#160a2e' : hue === 1 ? '#14092b' : hue === 2 ? '#180c33' : hue === 3 ? '#120824' : '#1a0d38';
        ctx.fillStyle = base;
        rr(ctx, bx, by, w, h, 6);
        ctx.fill();
        // 霓虹窗点（低对比，纯背景质感）
        ctx.fillStyle = ['#ffd166', '#22e6ff', '#ff3ec8', '#4ade80'][seed % 4];
        for (let wy = by + 12; wy < by + h - 10; wy += 24) {
          for (let wx = bx + 12; wx < bx + w - 12; wx += 22) {
            if ((seed + Math.floor(wx) + Math.floor(wy)) % 4 === 0) {
              ctx.globalAlpha = 0.28;
              ctx.fillRect(wx, wy, 5, 8);
              ctx.globalAlpha = 1;
            }
          }
        }
      }
    }
  }

  function drawRoad(camY) {
    const top = camY;
    const bottom = camY + H;
    const half = 130;
    const sx = (x) => x + W / 2;
    const sy = (y) => y - camY;
    // 路面
    ctx.fillStyle = COLORS.road;
    ctx.fillRect(sx(-half), 0, half * 2, H);
    // 路缘霓虹
    ctx.fillStyle = COLORS.roadEdge;
    ctx.fillRect(sx(-half - 8), 0, 8, H);
    ctx.fillRect(sx(half), 0, 8, H);
    glow(ctx, COLORS.laneCyan, 8, () => {
      ctx.fillStyle = COLORS.laneCyan;
      ctx.fillRect(sx(-half - 8), 0, 3, H);
      ctx.fillRect(sx(half + 5), 0, 3, H);
    });
    // 车道虚线（滚动）
    const dashStep = 60;
    const start = Math.floor(top / dashStep) * dashStep;
    ctx.fillStyle = COLORS.dash;
    ctx.globalAlpha = 0.5;
    for (let y = start; y < bottom; y += dashStep) {
      ctx.fillRect(sx(-4), sy(y), 8, 26);
    }
    ctx.globalAlpha = 1;
  }

  function drawMarkers(run, camY) {
    if (!run) return;
    const sx = (x) => x + W / 2;
    const sy = (y) => y - camY;
    const st = run.state;
    const COL = { pickup: COLORS.pickGreen, dropoff: COLORS.dropGold, end: COLORS.laneMagenta };
    const LABEL = { pickup: 'PICK UP', dropoff: 'DROP OFF', end: 'FINISH' };
    const GLYPH = { pickup: 'P', dropoff: 'D', end: '★' };
    // 下一个目标（首个还未到达的 pickup/dropoff/end）
    let next = null;
    for (const pt of st.points) {
      if ((pt.type === 'pickup' || pt.type === 'dropoff' || pt.type === 'end') && pt.dist > st.dist + 2) {
        next = pt;
        break;
      }
    }
    for (const pt of st.points) {
      if (pt.type !== 'pickup' && pt.type !== 'dropoff' && pt.type !== 'end') continue;
      const color = COL[pt.type];
      const isNext = next && pt === next;
      const px = sx(pt.x);
      const py = sy(pt.y);
      const r = isNext ? 22 : 14;
      const pulse = isNext && !REDUCED ? Math.sin(performance.now() / 220) * 4 : 0;
      // 下一个目标的醒目脉冲环
      if (isNext) {
        glow(ctx, color, 20, () => {
          ctx.strokeStyle = color;
          ctx.lineWidth = 5;
          ctx.beginPath();
          ctx.arc(px, py, r + 12 + pulse, 0, Math.PI * 2);
          ctx.stroke();
        });
        ctx.strokeStyle = 'rgba(10,6,24,0.9)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(px, py, r + 12 + pulse, 0, Math.PI * 2);
        ctx.stroke();
      }
      // 实体目标圆
      glow(ctx, color, 12, () => {
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(px, py, r, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.fillStyle = '#061018';
      ctx.font = `bold ${isNext ? 20 : 13}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(GLYPH[pt.type], px, py + 1);
      // 下一个目标配文字标签
      if (isNext) {
        const label = LABEL[pt.type];
        ctx.font = 'bold 14px system-ui, sans-serif';
        const tw = ctx.measureText(label).width + 20;
        ctx.fillStyle = 'rgba(10,6,24,0.92)';
        rr(ctx, px - tw / 2, py + r + 10, tw, 22, 7);
        ctx.fill();
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        rr(ctx, px - tw / 2, py + r + 10, tw, 22, 7);
        ctx.stroke();
        ctx.fillStyle = color;
        ctx.fillText(label, px, py + r + 21);
      }
    }
  }

  function drawGoalCue(run, camY) {
    const st = run.state;
    let next = null;
    for (const pt of st.points) {
      if ((pt.type === 'pickup' || pt.type === 'dropoff' || pt.type === 'end') && pt.dist > st.dist + 2) {
        next = pt;
        break;
      }
    }
    if (!next) return;
    const color = next.type === 'pickup' ? COLORS.pickGreen : next.type === 'dropoff' ? COLORS.dropGold : COLORS.laneMagenta;
    const label = next.type === 'pickup' ? 'PICK UP' : next.type === 'dropoff' ? 'DROP OFF' : 'FINISH';
    const gy = next.y - camY;
    // 目标在屏幕内 → 不重复画底部提示
    if (gy > -20 && gy < H + 20) return;
    const bx = W / 2;
    const by = H - 52;
    const pulse = REDUCED ? 0 : Math.sin(performance.now() / 240) * 3;
    // 底部悬浮指示：箭头 + 标签
    glow(ctx, color, 16, () => {
      ctx.fillStyle = 'rgba(10,6,24,0.92)';
      rr(ctx, bx - 120, by - 16, 240, 34, 10);
      ctx.fill();
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      rr(ctx, bx - 120, by - 16, 240, 34, 10);
      ctx.stroke();
    });
    // 箭头（指向下方）
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(bx + 70, by - 4 + pulse);
    ctx.lineTo(bx + 82, by + 12 + pulse);
    ctx.lineTo(bx + 58, by + 12 + pulse);
    ctx.closePath();
    ctx.fill();
    ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = color;
    ctx.fillText(`NEXT · ${label}`, bx - 8, by + 1 + pulse * 0.3);
  }

  function drawPickups(run, camY) {
    if (!run) return;
    const sx = (x) => x + W / 2;
    const sy = (y) => y - camY;
    for (const pk of run.state.pickups) {
      if (pk.taken) continue;
      const px = sx(pk.x);
      const py = sy(pk.y);
      const bob = REDUCED ? 0 : Math.sin(performance.now() / 300 + pk.d) * 4;
      if (pk.type === 'shield') {
        glow(ctx, COLORS.shield, 12, () => {
          ctx.fillStyle = COLORS.shield;
          ctx.beginPath();
          for (let i = 0; i < 6; i += 1) {
            const a = (Math.PI / 3) * i + Math.PI / 6;
            const r = 15;
            const vx = px + Math.cos(a) * r;
            const vy = py + bob + Math.sin(a) * r;
            if (i === 0) ctx.moveTo(vx, vy);
            else ctx.lineTo(vx, vy);
          }
          ctx.closePath();
          ctx.fill();
        });
      } else if (pk.type === 'turbo') {
        glow(ctx, COLORS.turbo, 12, () => {
          ctx.fillStyle = COLORS.turbo;
          ctx.beginPath();
          ctx.moveTo(px, py + bob - 15);
          ctx.lineTo(px + 14, py + bob + 8);
          ctx.lineTo(px, py + bob + 4);
          ctx.lineTo(px - 14, py + bob + 8);
          ctx.closePath();
          ctx.fill();
        });
      } else {
        glow(ctx, COLORS.coin, 12, () => {
          ctx.fillStyle = COLORS.coin;
          ctx.beginPath();
          ctx.arc(px, py + bob, 13, 0, Math.PI * 2);
          ctx.fill();
        });
        ctx.fillStyle = '#6a4a00';
        ctx.font = 'bold 12px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('$', px, py + bob + 1);
      }
      // 道具小标签（避免被误读为未知图形）
      const tag = pk.type === 'shield' ? 'SHIELD' : pk.type === 'turbo' ? 'BOOST' : 'COIN';
      ctx.font = 'bold 10px system-ui, sans-serif';
      const tw = ctx.measureText(tag).width + 12;
      ctx.fillStyle = 'rgba(10,6,24,0.9)';
      rr(ctx, px - tw / 2, py + bob + 18, tw, 15, 5);
      ctx.fill();
      ctx.fillStyle = pk.type === 'shield' ? COLORS.shield : pk.type === 'turbo' ? COLORS.turbo : COLORS.coin;
      ctx.fillText(tag, px, py + bob + 25);
    }
  }

  function drawCar(car, camY) {
    const sx = car.x + W / 2;
    const sy = car.y - camY;
    const dir = car.vx >= 0 ? 1 : -1;
    const w = car.r * 2.4;
    const h = car.r * 1.5;
    glow(ctx, '#ff5e5e', 8, () => {
      ctx.fillStyle = '#1a0b2e';
      rr(ctx, sx - w / 2, sy - h / 2, w, h, 6);
      ctx.fill();
      ctx.fillStyle = '#ff5e5e';
      rr(ctx, sx - w / 2 + 3, sy - h / 2 + 3, w - 6, h - 6, 4);
      ctx.fill();
    });
    // 车灯
    ctx.fillStyle = '#fff';
    ctx.fillRect(dir === 1 ? sx + w / 2 - 5 : sx - w / 2, sy - h / 2 + 3, 5, 4);
    ctx.fillRect(dir === 1 ? sx + w / 2 - 5 : sx - w / 2, sy + h / 2 - 7, 5, 4);
  }

  function drawBus(run, camY) {
    const st = run.state;
    const sx = st.x + W / 2;
    const sy = st.y - camY;
    const angle = Math.atan2(st.heading.y, st.heading.x) + Math.PI / 2;
    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(angle);
    const len = 52;
    const wid = 30;
    // 阴影
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    rr(ctx, -len / 2 + 3, -wid / 2 + 5, len, wid, 10);
    ctx.fill();
    // 车身
    glow(ctx, COLORS.busGlow, 14, () => {
      ctx.fillStyle = COLORS.busBody;
      rr(ctx, -len / 2, -wid / 2, len, wid, 9);
      ctx.fill();
    });
    // 顶部霓虹条
    ctx.fillStyle = COLORS.busAccent;
    rr(ctx, -len / 2 + 4, -wid / 2 + 4, len - 8, 5, 3);
    ctx.fill();
    // 挡风玻璃
    ctx.fillStyle = '#12263a';
    rr(ctx, -len / 2 + 6, -wid / 2 + 12, len - 12, 6, 3);
    ctx.fill();
    // 车灯
    ctx.fillStyle = '#fff7c0';
    rr(ctx, -len / 2 - 3, -wid / 2 + 3, 5, 7, 2);
    ctx.fill();
    rr(ctx, -len / 2 - 3, wid / 2 - 10, 5, 7, 2);
    ctx.fill();
    // 护盾光环
    if (st.shield > 0 && !REDUCED) {
      glow(ctx, COLORS.shield, 16, () => {
        ctx.strokeStyle = COLORS.shield;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, 36 + Math.sin(performance.now() / 200) * 3, 0, Math.PI * 2);
        ctx.stroke();
      });
    }
    ctx.restore();
  }

  function drawParticles(dt) {
    for (let i = particles.length - 1; i >= 0; i -= 1) {
      const p = particles[i];
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.life -= dt;
      if (p.life <= 0) {
        particles.splice(i, 1);
        continue;
      }
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x + W / 2, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  function renderTitle() {
    const camY = -200;
    ctx.fillStyle = COLORS.bgTop;
    ctx.fillRect(0, 0, W, H);
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, COLORS.bgTop);
    g.addColorStop(1, COLORS.bgBottom);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    drawCity(camY);
    drawRoad(camY);
    // 一条装饰公交
    const fake = { state: { x: 0, y: 220, heading: { x: 0, y: 1 }, shield: 0 } };
    drawBus(fake, camY);
    drawParticles(1 / 60);
  }

  function render(run) {
    if (!run) {
      renderTitle();
      return;
    }
    const st = run.state;
    const camY = st.y - H * 0.40;

    ctx.fillStyle = COLORS.bgTop;
    ctx.fillRect(0, 0, W, H);
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, COLORS.bgTop);
    g.addColorStop(1, COLORS.bgBottom);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    drawCity(camY);
    drawRoad(camY);
    drawMarkers(run, camY);
    drawPickups(run, camY);
    for (const car of st.cars) drawCar(car, camY);
    drawBus(run, camY);
    drawGoalCue(run, camY);

    // 事件驱动的粒子
    if (st.nearMisses > lastNearMisses && !REDUCED) {
      lastNearMisses = st.nearMisses;
      for (let i = 0; i < 10; i += 1) {
        spawn({
          x: st.x, y: st.y - 20, r: 2 + Math.random() * 2,
          vx: (Math.random() - 0.5) * 220, vy: -Math.random() * 120,
          life: 0.5, maxLife: 0.5, color: COLORS.turbo,
        });
      }
    }
    if (st.phase === 'crashed' && lastPhase !== 'crashed' && !REDUCED) {
      for (let i = 0; i < 40; i += 1) {
        spawn({
          x: st.x, y: st.y, r: 2 + Math.random() * 3,
          vx: (Math.random() - 0.5) * 420, vy: (Math.random() - 0.5) * 420,
          life: 0.8 + Math.random() * 0.5, maxLife: 1, color: i % 2 ? COLORS.busAccent : COLORS.laneCyan,
        });
      }
    }
    lastPhase = st.phase;
    drawParticles(1 / 60);
  }

  return {
    render,
    renderTitle,
    resize,
    get width() { return W; },
    get height() { return H; },
  };
}
