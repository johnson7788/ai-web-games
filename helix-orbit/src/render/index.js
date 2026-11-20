// HELIX ORBIT · 渲染：Canvas 2D 伪 3D（椭圆堆叠螺旋塔 + 楔形段 + 缺口光柱 + 余烬/黑曜/雪晶装饰）。
// 球固定屏幕 y，塔层随深度上移；世界角 0 = 椭圆正前方（底部）。
import { WORLD } from '../../config/game.config.js';
import { normAngle } from '../../config/gameplay.js';
import { THEMES, themeFor } from '../../config/levels.js';

const TWO_PI = Math.PI * 2;

export function createRender(canvas) {
  const ctx = canvas.getContext('2d');
  canvas.width = WORLD.WIDTH;
  canvas.height = WORLD.HEIGHT;

  const state = {
    bursts: [],
    hop: 0,
    ambient: [],
    ambientTheme: -1,
    time: 0,
  };

  function ensureAmbient(themeIdx) {
    if (state.ambientTheme === themeIdx) return;
    state.ambientTheme = themeIdx;
    state.ambient = [];
    const theme = THEMES[themeIdx];
    const n = theme.decoration === 'snow' ? 70 : 50;
    for (let i = 0; i < n; i += 1) {
      state.ambient.push({
        x: Math.random() * WORLD.WIDTH,
        y: Math.random() * WORLD.HEIGHT,
        vy: 12 + Math.random() * 40,
        size: 1 + Math.random() * 2.2,
        phase: Math.random() * TWO_PI,
      });
    }
  }

  function bg(theme) {
    const g = ctx.createLinearGradient(0, 0, 0, WORLD.HEIGHT);
    g.addColorStop(0, theme.bgTop);
    g.addColorStop(1, theme.bgBottom);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
  }

  function ambient(theme) {
    ensureAmbient(theme.theme === 'crust' ? 0 : theme.theme === 'obsidian' ? 1 : 2);
    ctx.save();
    for (const p of state.ambient) {
      const y = (p.y + state.time * p.vy) % WORLD.HEIGHT;
      const a = 0.25 + 0.25 * Math.sin(p.phase + state.time * 2);
      ctx.fillStyle = theme.accent;
      ctx.globalAlpha = Math.max(0.04, a * 0.22);
      if (theme.decoration === 'shard') {
        ctx.fillRect(p.x, y, p.size, p.size * 1.6);
      } else if (theme.decoration === 'snow') {
        ctx.beginPath();
        ctx.arc(p.x, y, p.size, 0, TWO_PI);
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.arc(p.x, WORLD.HEIGHT - y, p.size, 0, TWO_PI);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  function drawWedge(cx, cy, a0, a1, fill, alpha = 1) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(1, WORLD.RING_RY / WORLD.RING_RX);
    ctx.globalAlpha = alpha;
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, WORLD.RING_RX, a0 + Math.PI / 2, a1 + Math.PI / 2);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  function drawLayer(run, layer, theme) {
    const cy = WORLD.BALL_Y + (layer.index - run.ballY) * WORLD.LAYER_GAP;
    const cx = WORLD.TOWER_X;
    const theta = normAngle(run.towerAngle + layer.baseAngle + layer.spin + layer.movingOffset);

    // 缺口光柱（先画，让缺口读作「目标开口」）
    for (const g of layer.gaps) {
      const a0 = g.a0 + theta;
      const a1 = g.a1 + theta;
      drawWedge(cx, cy, a0, a1, theme.ringCrack, 0.5);
      drawWedge(cx, cy, a0, a1, 'rgba(255,255,240,0.25)', 0.35);
    }

    // 段（world 角 = 段内角 + theta）；前半球更亮，后半球更暗；岩浆高亮
    for (const seg of layer.segments) {
      const a0 = seg.a0 + theta;
      const a1 = seg.a1 + theta;
      const mid = normAngle((a0 + a1) / 2);
      const frontHalf = Math.cos(mid) > 0;
      const col = seg.magma
        ? (frontHalf ? theme.ringMagmaGlow : theme.ringMagma)
        : (frontHalf ? theme.ringSafeLit : theme.ringSafe);
      drawWedge(cx, cy, a0, a1, col);
    }

    // 段边缘描线（分离段与缺口，强化剪影）
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(1, WORLD.RING_RY / WORLD.RING_RX);
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 1.5;
    for (const seg of layer.segments) {
      const a0 = seg.a0 + theta;
      const a1 = seg.a1 + theta;
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, WORLD.RING_RX, a0 + Math.PI / 2, a1 + Math.PI / 2);
      ctx.lineTo(0, 0);
      ctx.stroke();
    }
    // 外缘亮描边：让每层塔在深背景上可辨（剪影兜底）
    ctx.beginPath();
    ctx.arc(0, 0, WORLD.RING_RX, 0, TWO_PI);
    ctx.strokeStyle = 'rgba(255, 240, 220, 0.35)';
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.restore();

    // 冰晶（未收集）：缺口中心一颗高亮菱形
    if (layer.crystal && !layer.crystalCollected && layer.gaps.length) {
      const g = layer.gaps[0];
      const mid = normAngle((g.a0 + g.a1) / 2 + theta);
      const px = cx + WORLD.RING_RX * Math.sin(mid);
      const py = cy + WORLD.RING_RY * Math.cos(mid);
      drawCrystal(px, py, 9);
    }

    // 环线（弱化）
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(1, WORLD.RING_RY / WORLD.RING_RX);
    ctx.beginPath();
    ctx.arc(0, 0, WORLD.RING_RX, 0, TWO_PI);
    ctx.strokeStyle = theme.accent;
    ctx.globalAlpha = 0.18;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  function drawCrystal(x, y, r) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.PI / 4);
    ctx.fillStyle = '#c9fbff';
    ctx.shadowColor = '#5fe0ff';
    ctx.shadowBlur = 16;
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.fillRect(-r / 2, -r / 2, r, r);
    ctx.strokeRect(-r / 2, -r / 2, r, r);
    ctx.restore();
    ctx.shadowBlur = 0;
  }

  function drawBall(run, theme) {
    const cx = WORLD.TOWER_X;
    const cy = WORLD.BALL_Y + WORLD.RING_RY * 0.8 - state.hop * 46;
    const r = run.meteorActive ? 27 : 24;

    // 大面积光晕（让球是全场最亮物）
    const halo = ctx.createRadialGradient(cx, cy, 4, cx, cy, 78);
    halo.addColorStop(0, run.meteorActive ? 'rgba(255,200,120,0.75)' : 'rgba(255,220,170,0.55)');
    halo.addColorStop(0.4, 'rgba(255,150,60,0.25)');
    halo.addColorStop(1, 'rgba(255,120,40,0)');
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(cx, cy, 78, 0, TWO_PI);
    ctx.fill();

    // 陨石尾焰
    if (run.meteorActive) {
      const g = ctx.createLinearGradient(cx, cy - 100, cx, cy);
      g.addColorStop(0, 'rgba(255,160,60,0)');
      g.addColorStop(1, theme.ballGlow);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(cx - 22, cy - 100);
      ctx.lineTo(cx + 22, cy - 100);
      ctx.lineTo(cx + 8, cy);
      ctx.lineTo(cx - 8, cy);
      ctx.closePath();
      ctx.fill();
    }

    // 深色外圈（剪影）
    ctx.save();
    ctx.fillStyle = 'rgba(20,8,4,0.9)';
    ctx.beginPath();
    ctx.arc(cx, cy, r + 6, 0, TWO_PI);
    ctx.fill();
    ctx.restore();

    // 球体
    ctx.save();
    ctx.shadowColor = theme.ballGlow;
    ctx.shadowBlur = 30;
    ctx.fillStyle = run.meteorActive ? '#ffe8c0' : '#fff6e8';
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, TWO_PI);
    ctx.fill();
    ctx.restore();
    ctx.shadowBlur = 0;

    // 白色核心（纯白，最强对比）
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(cx - 4, cy - 5, r * 0.46, 0, TWO_PI);
    ctx.fill();

    // 落点指示环：球正下方画一个脉冲圆环，明示「目标在这里」（目标显著性）
    const beat = 0.5 + 0.5 * Math.sin(Date.now() / 240);
    ctx.save();
    ctx.strokeStyle = `rgba(255,246,232,${0.35 + 0.45 * beat})`;
    ctx.lineWidth = 3;
    ctx.setLineDash([10, 8]);
    ctx.beginPath();
    ctx.ellipse(cx, cy + 58, 34 + 8 * beat, 12 + 3 * beat, 0, 0, TWO_PI);
    ctx.stroke();
    ctx.restore();
  }

  // 当前层的缺口目标标记：给玩家/视觉模型一个明确的「目标开口」
  function drawGapMarkers(run, layer, theme) {
    const cy = WORLD.BALL_Y + (layer.index - run.ballY) * WORLD.LAYER_GAP;
    const cx = WORLD.TOWER_X;
    const theta = normAngle(run.towerAngle + layer.baseAngle + layer.spin + layer.movingOffset);
    const pulse = 0.55 + 0.45 * Math.sin(state.time * 5);
    for (const g of layer.gaps) {
      const mid = normAngle((g.a0 + g.a1) / 2 + theta);
      const px = cx + WORLD.RING_RX * Math.sin(mid);
      const py = cy + WORLD.RING_RY * Math.cos(mid);
      // 呼吸光点
      ctx.save();
      ctx.globalAlpha = 0.5 + 0.5 * pulse;
      ctx.fillStyle = theme.ringCrack;
      ctx.shadowColor = theme.ringCrack;
      ctx.shadowBlur = 18;
      ctx.beginPath();
      ctx.arc(px, py, 6 + 2 * pulse, 0, TWO_PI);
      ctx.fill();
      ctx.restore();
      // 下指小箭头（▼）
      const ay = py - 22;
      ctx.save();
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = '#fff6e0';
      ctx.shadowColor = theme.ringCrack;
      ctx.shadowBlur = 12;
      ctx.beginPath();
      ctx.moveTo(px - 9, ay - 8);
      ctx.lineTo(px + 9, ay - 8);
      ctx.lineTo(px, ay + 6);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    ctx.shadowBlur = 0;
  }

  function drawBursts() {
    for (const b of state.bursts) {
      const a = Math.max(0, b.life);
      ctx.save();
      ctx.globalAlpha = a;
      ctx.fillStyle = b.color;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.size * a + 0.5, 0, TWO_PI);
      ctx.fill();
      ctx.restore();
    }
  }

  function drawFreeze(active) {
    if (!active) return;
    ctx.save();
    ctx.fillStyle = 'rgba(120,220,255,0.10)';
    ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
    ctx.strokeStyle = 'rgba(160,235,255,0.6)';
    ctx.lineWidth = 3;
    ctx.strokeRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
    ctx.restore();
  }

  function updateParticles(dt) {
    state.hop = Math.max(0, state.hop - dt * 3.2);
    for (const b of state.bursts) {
      b.life -= dt * 1.6;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.vy += 240 * dt;
    }
    state.bursts = state.bursts.filter((b) => b.life > 0);
  }

  // 标题屏静态塔预览（给标题一个可辨识的玩家/塔剪影锚点）
  function drawTitleTower() {
    const theme = THEMES[0];
    const cx = WORLD.TOWER_X;
    for (let i = 0; i < 6; i += 1) {
      const cy = 300 + i * WORLD.LAYER_GAP;
      drawWedge(cx, cy, 0, TWO_PI, theme.ringSafe, 0.5);
      drawWedge(cx, cy, 0.4, 1.8, theme.ringSafeLit, 0.9);
      drawWedge(cx, cy, 3.6, 4.6, theme.ringSafeLit, 0.9);
      drawWedge(cx, cy, 1.8, 2.0, theme.ringCrack, 0.8);
      ctx.save();
      ctx.translate(cx, cy);
      ctx.scale(1, WORLD.RING_RY / WORLD.RING_RX);
      ctx.beginPath();
      ctx.arc(0, 0, WORLD.RING_RX, 0, TWO_PI);
      ctx.strokeStyle = theme.accent;
      ctx.globalAlpha = 0.2;
      ctx.stroke();
      ctx.restore();
      ctx.globalAlpha = 1;
    }
    // 标题球
    const bx = cx;
    const by = 300 + WORLD.RING_RY * 0.8;
    ctx.save();
    ctx.fillStyle = 'rgba(20,8,4,0.85)';
    ctx.beginPath();
    ctx.arc(bx, by, 27, 0, TWO_PI);
    ctx.fill();
    ctx.restore();
    ctx.save();
    ctx.shadowColor = theme.ballGlow;
    ctx.shadowBlur = 26;
    ctx.fillStyle = '#fff6e8';
    ctx.beginPath();
    ctx.arc(bx, by, 22, 0, TWO_PI);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(bx - 4, by - 5, 9, 0, TWO_PI);
    ctx.fill();
  }

  function draw(run, alpha = 1) {
    const theme = run ? themeFor(run.currentLayer) : THEMES[0];
    state.time += 1 / 60;
    updateParticles(1 / 60);

    bg(theme);
    ambient(theme);

    if (run) {
      const indices = [];
      for (const idx of run.layers.keys()) indices.push(idx);
      indices.sort((a, b) => a - b);
      for (const idx of indices) {
        const layer = run.layers.get(idx);
        const cy = WORLD.BALL_Y + (layer.index - run.ballY) * WORLD.LAYER_GAP;
        if (cy < -WORLD.RING_RY - 60 || cy > WORLD.HEIGHT + WORLD.RING_RY + 60) continue;
        drawLayer(run, layer, theme);
      }
      const cur = run.layers.get(run.currentLayer);
      if (cur) drawGapMarkers(run, cur, theme);
      drawBall(run, theme);
      drawBursts();
      drawFreeze(run.freezeUntil > run.time);
    } else {
      drawTitleTower();
    }
  }

  function burst(x, y, kind) {
    const colors = {
      smash: ['#ff6a2a', '#ffb04a', '#ffd08a'],
      pass: ['#ffd08a', '#8ff0ff'],
      crystal: ['#8ff0ff', '#d0ffff'],
      dead: ['#ff5a2a', '#ff9a3d'],
    }[kind] || ['#ffd08a'];
    for (let i = 0; i < 14; i += 1) {
      state.bursts.push({
        x, y,
        vx: (Math.random() - 0.5) * 340,
        vy: (Math.random() - 0.5) * 340,
        life: 0.5 + Math.random() * 0.5,
        color: colors[i % colors.length],
        size: 2 + Math.random() * 4,
      });
    }
    if (kind === 'smash' || kind === 'dead') state.hop = 0.4;
  }

  function onEvent(ev) {
    const cx = WORLD.TOWER_X;
    const cy = WORLD.BALL_Y + WORLD.RING_RY * 0.8;
    if (ev.type === 'bounce') state.hop = 1;
    else if (ev.type === 'meteorSmash') burst(cx, cy, 'smash');
    else if (ev.type === 'meteorStart') state.hop = 0.6;
    else if (ev.type === 'crystal') burst(cx, cy, 'crystal');
    else if (ev.type === 'death') burst(cx, cy, 'dead');
  }

  return { draw, burst, onEvent };
}
