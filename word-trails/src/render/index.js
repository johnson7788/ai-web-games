// Canvas 2D 渲染：词面板（字母砖）+ 字母环拖拽轨迹 + 拼词反馈粒子/浮字。
import { WORLD, PANEL, RING, COLORS } from '../../config/game.config.js';

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

export function ringNodePos(i, n) {
  const a = -Math.PI / 2 + (i * 2 * Math.PI) / n;
  return { x: RING.CX + RING.R * Math.cos(a), y: RING.CY + RING.R * Math.sin(a), a };
}

export function wordRowRect(run, wi) {
  const w = run.words[wi];
  const rowW = w.length * (PANEL.TILE + PANEL.GAP) - PANEL.GAP;
  const x = PANEL.X + (PANEL.W - rowW) / 2;
  const y = PANEL.Y + 56 + wi * (PANEL.TILE + PANEL.ROW_GAP);
  return { x, y, w: rowW, h: PANEL.TILE };
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  canvas.width = WORLD.WIDTH;
  canvas.height = WORLD.HEIGHT;
  const particles = [];
  const popups = [];
  let shakeT = 0;
  let shakeMag = 0;

  function burst(x, y, color, n = 14) {
    for (let i = 0; i < n; i += 1) {
      const a = Math.random() * Math.PI * 2;
      const sp = 50 + Math.random() * 200;
      particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 50, life: 0.5 + Math.random() * 0.3, t: 0, color, size: 3 + Math.random() * 4 });
    }
  }
  function popup(text, x, y, color = COLORS.accent, big = false) {
    popups.push({ text, x, y, color, t: 0, life: big ? 1.1 : 0.8, big });
  }
  function shake(mag = 7) { shakeMag = Math.max(shakeMag, mag); shakeT = 0.26; }
  function update(dt) {
    for (let i = particles.length - 1; i >= 0; i -= 1) {
      const p = particles[i];
      p.t += dt;
      if (p.t >= p.life) { particles.splice(i, 1); continue; }
      p.vy += 480 * dt; p.x += p.vx * dt; p.y += p.vy * dt;
    }
    for (let i = popups.length - 1; i >= 0; i -= 1) {
      popups[i].t += dt;
      if (popups[i].t >= popups[i].life) popups.splice(i, 1);
    }
    if (shakeT > 0) shakeT = Math.max(0, shakeT - dt); else shakeMag = 0;
  }

  function drawBackground() {
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
    const g = ctx.createRadialGradient(955, 420, 60, 640, 360, 860);
    g.addColorStop(0, COLORS.bgGlow);
    g.addColorStop(1, COLORS.bg);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
  }

  function drawTile(x, y, ch, state) {
    const T = PANEL.TILE;
    let fill = COLORS.tileHidden;
    let edge = COLORS.tileHiddenEdge;
    let ink = 'rgba(234,242,255,0.25)';
    if (state === 'found') { fill = COLORS.tileFound; edge = COLORS.tileFoundEdge; ink = '#04211c'; }
    else if (state === 'revealed') { fill = COLORS.tileRevealed; edge = '#b45309'; ink = '#3b2503'; }
    ctx.fillStyle = fill;
    roundRect(ctx, x, y, T, T, 8);
    ctx.fill();
    ctx.strokeStyle = edge;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = ink;
    ctx.font = `800 ${T * 0.56}px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(state === 'hidden' ? '' : ch, x + T / 2, y + T / 2 + 1);
    if (state === 'hidden') {
      ctx.fillStyle = 'rgba(234,242,255,0.12)';
      ctx.beginPath();
      ctx.arc(x + T / 2, y + T / 2, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawWordPanel(run, view) {
    ctx.fillStyle = COLORS.panel;
    roundRect(ctx, PANEL.X - 16, PANEL.Y - 50, PANEL.W + 32, PANEL.H + 60, 18);
    ctx.fill();
    ctx.strokeStyle = COLORS.panelEdge;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = COLORS.accent;
    ctx.font = `700 20px ${FONT}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(view.panelTitle || '', PANEL.X, PANEL.Y - 22);

    const now = view.now || 0;
    run.words.forEach((w, wi) => {
      const row = wordRowRect(run, wi);
      const isFound = run.found.has(w);
      const flash = view.foundFlash && view.foundFlash.wordIdx === wi && now < view.foundFlash.until;
      for (let pos = 0; pos < w.length; pos += 1) {
        const x = row.x + pos * (PANEL.TILE + PANEL.GAP);
        const revealed = run.revealed.has(`${wi}:${pos}`);
        const state = isFound ? 'found' : (revealed ? 'revealed' : 'hidden');
        drawTile(x, row.y, w[pos], state);
      }
      if (flash) {
        ctx.fillStyle = 'rgba(94,234,212,0.18)';
        roundRect(ctx, row.x - 6, row.y - 6, row.w + 12, row.h + 12, 10);
        ctx.fill();
      }
    });
  }

  function drawRing(run, view) {
    const n = run.ring.length;
    const sel = view.selection || [];
    // 轨迹
    if (sel.length > 0) {
      ctx.strokeStyle = COLORS.trail;
      ctx.lineWidth = 8;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      sel.forEach((idx, k) => {
        const p = ringNodePos(idx, n);
        if (k === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
      });
      if (view.pointer) ctx.lineTo(view.pointer.x, view.pointer.y);
      ctx.stroke();
    }
    // 节点
    for (let i = 0; i < n; i += 1) {
      const p = ringNodePos(i, n);
      const selected = sel.includes(i);
      ctx.fillStyle = selected ? COLORS.nodeSel : COLORS.node;
      ctx.beginPath();
      ctx.arc(p.x, p.y, RING.NODE, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = selected ? '#0f766e' : COLORS.nodeEdge;
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.fillStyle = selected ? '#04211c' : COLORS.ink;
      ctx.font = `800 ${RING.NODE * 0.8}px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(run.ring[i], p.x, p.y + 1);
    }
    // 中心提示
    ctx.fillStyle = 'rgba(234,242,255,0.35)';
    ctx.font = `600 15px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText(view.ringHint || '', RING.CX, RING.CY);
  }

  function drawCurrentWord(view) {
    const word = view.currentWord || '';
    const cx = RING.CX;
    const cy = RING.WORD_Y;
    const w = Math.max(220, word.length * 46 + 60);
    ctx.fillStyle = 'rgba(19,28,40,0.9)';
    roundRect(ctx, cx - w / 2, cy - 34, w, 68, 16);
    ctx.fill();
    ctx.strokeStyle = word ? COLORS.accent : COLORS.panelEdge;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = word ? COLORS.ink : 'rgba(234,242,255,0.3)';
    ctx.font = `800 34px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(word || view.wordPlaceholder || '', cx, cy + 1);
  }

  function drawParticles() {
    for (const p of particles) {
      ctx.globalAlpha = Math.max(0, 1 - p.t / p.life);
      ctx.fillStyle = p.color;
      roundRect(ctx, p.x - p.size / 2, p.y - p.size / 2, p.size, p.size, 1.5);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
  function drawPopups() {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    for (const p of popups) {
      const k = p.t / p.life;
      const alpha = k < 0.15 ? k / 0.15 : 1 - Math.max(0, (k - 0.6) / 0.4);
      ctx.globalAlpha = Math.max(0, alpha);
      ctx.font = `800 ${(p.big ? 40 : 24)}px ${FONT}`;
      ctx.fillStyle = p.color;
      ctx.shadowColor = 'rgba(0,0,0,0.5)';
      ctx.shadowBlur = 8;
      ctx.fillText(p.text, p.x, p.y - k * 44);
      ctx.shadowBlur = 0;
    }
    ctx.globalAlpha = 1;
  }

  function render(view) {
    const { run } = view;
    ctx.save();
    if (shakeT > 0 && shakeMag > 0) {
      const m = shakeMag * (shakeT / 0.26);
      ctx.translate((Math.random() - 0.5) * m, (Math.random() - 0.5) * m);
    }
    drawBackground();
    if (run) {
      drawWordPanel(run, view);
      drawCurrentWord(view);
      drawRing(run, view);
    }
    drawParticles();
    drawPopups();
    ctx.restore();
  }

  function hitRing(x, y, n) {
    for (let i = 0; i < n; i += 1) {
      const p = ringNodePos(i, n);
      const dx = x - p.x;
      const dy = y - p.y;
      if (dx * dx + dy * dy <= (RING.NODE + 10) ** 2) return i;
    }
    return -1;
  }

  function clearEffects() {
    particles.length = 0;
    popups.length = 0;
    shakeT = 0;
    shakeMag = 0;
  }

  return { render, update, burst, popup, shake, hitRing, clearEffects, ringNodePos, wordRowRect };
}