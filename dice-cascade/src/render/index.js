// src/render/index.js — Canvas 2D 渲染：神殿背景 / 弹珠板 / 落珠动画 / 骰面 / 粒子。
// 只画，不碰 sim/存档；所有几何从 config/gameplay.js 的 BOARD 读。
import { WORLD, BOARD, ROLL_SETTLE_SEC, TRIPLE_BONUS, clamp } from '../../config/gameplay.js';
import { sceneOf } from './theme.js';

function easeOutQuad(t) {
  return 1 - (1 - t) * (1 - t);
}

export function createRender(canvas) {
  const ctx = canvas.getContext('2d');
  canvas.width = WORLD.WIDTH;
  canvas.height = WORLD.HEIGHT;
  const particles = [];
  let shake = 0;

  function burst(x, y, kind) {
    const colors = kind === 'gold' ? ['#ffd98a', '#ffcf6a', '#fff3cf']
      : kind === 'rune' ? ['#8cffcb', '#c9ffe2', '#46c98a']
      : kind === 'cursed' ? ['#ff6a5a', '#ff8c7a', '#ffb0a0']
      : ['#ffe9b0', '#fff7df', '#ffcf6a'];
    for (let i = 0; i < (kind === 'triple' ? 26 : 12); i += 1) {
      particles.push({
        x, y,
        vx: (Math.random() - 0.5) * (kind === 'triple' ? 420 : 220),
        vy: (Math.random() - 0.7) * 200,
        life: kind === 'triple' ? 0.9 : 0.5,
        maxLife: kind === 'triple' ? 0.9 : 0.5,
        r: 1.5 + Math.random() * 2.6,
        color: colors[i % colors.length],
      });
    }
    if (kind === 'triple') shake = 0.35;
  }

  function drawBackdrop(t) {
    const g = ctx.createLinearGradient(0, 0, 0, WORLD.HEIGHT);
    g.addColorStop(0, t.bgTop);
    g.addColorStop(1, t.bgBottom);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
  }

  function drawDeco(t) {
    if (t.deco === 'columns') {
      for (let i = 0; i < 3; i += 1) {
        const x = 40 + i * 100;
        ctx.fillStyle = t.column;
        ctx.fillRect(x, 60, 34, 600);
        ctx.fillStyle = t.columnEdge;
        ctx.fillRect(x, 60, 34, 14);
        ctx.fillRect(x, 646, 34, 14);
      }
      for (let i = 0; i < 3; i += 1) {
        const x = 1220 - i * 100;
        ctx.fillStyle = t.column;
        ctx.fillRect(x, 60, 34, 600);
        ctx.fillStyle = t.columnEdge;
        ctx.fillRect(x, 60, 34, 14);
        ctx.fillRect(x, 646, 34, 14);
      }
    } else if (t.deco === 'vines') {
      ctx.strokeStyle = t.columnEdge;
      ctx.lineWidth = 5;
      for (let i = 0; i < 5; i += 1) {
        const x = 30 + i * 55;
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.bezierCurveTo(x + 20, 120, x - 16, 260, x + 6, 420);
        ctx.stroke();
      }
    } else {
      ctx.strokeStyle = t.archGlow;
      ctx.lineWidth = 3;
      for (let i = 0; i < 6; i += 1) {
        const x = 40 + i * 55;
        ctx.beginPath();
        ctx.moveTo(x, 600);
        ctx.lineTo(x + 18, 470);
        ctx.lineTo(x + 8, 330);
        ctx.stroke();
      }
    }
  }

  function drawArch(t) {
    ctx.save();
    ctx.strokeStyle = t.arch;
    ctx.lineWidth = 8;
    ctx.shadowColor = t.archGlow;
    ctx.shadowBlur = 18;
    roundRect(ctx, 272, 72, 736, 500, 26);
    ctx.stroke();
    ctx.restore();
  }

  function drawLanes(run, t) {
    const bet = new Set(run ? run.betSel : []);
    const n = run ? run.diceCount : 1;
    for (let i = 0; i < n; i += 1) {
      const x = BOARD.LANE_X[i];
      const y = BOARD.ENTRY_Y;
      const active = bet.has(i);
      const face = run && run.lastRoll ? run.lastRoll.faces[i] : null;
      ctx.fillStyle = active ? t.laneActive : t.lane;
      ctx.strokeStyle = active ? '#ffffff' : t.bucketLine;
      ctx.lineWidth = active ? 3 : 1.5;
      roundRect(ctx, x - 62, y - 30, 124, 60, 14);
      ctx.fill();
      ctx.stroke();
      // 掷前显示骰位序号，掷后显示骰面
      const label = face != null ? String(face) : String(i + 1);
      ctx.fillStyle = active ? '#1a1206' : (face != null ? '#fff4dd' : t.text);
      ctx.font = 'bold 30px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, x, y + 1);
    }
  }

  function drawPegs(t) {
    const rows = BOARD.ROWS;
    const spanX = BOARD.BOARD_RIGHT - BOARD.BOARD_LEFT;
    const top = BOARD.PEG_TOP;
    const bottom = BOARD.PEG_BOTTOM;
    for (let r = 0; r < rows; r += 1) {
      const y = top + ((bottom - top) * (r + 0.5)) / rows;
      const offset = r % 2 === 0 ? 0 : (spanX / (BOARD.BUCKETS + 1)) / 2;
      const count = BOARD.BUCKETS + 1;
      for (let c = 0; c < count; c += 1) {
        const x = BOARD.BOARD_LEFT + offset + (spanX / (BOARD.BUCKETS + 1)) * c;
        ctx.fillStyle = t.peg;
        ctx.strokeStyle = t.pegEdge;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(x, y, 11, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
    }
  }

  function drawBuckets(run, t) {
    const spanX = BOARD.BOARD_RIGHT - BOARD.BOARD_LEFT;
    const step = spanX / BOARD.BUCKETS;
    const y = BOARD.BUCKET_Y;
    const h = BOARD.BUCKET_H;
    for (let b = 0; b < BOARD.BUCKETS; b += 1) {
      const x = BOARD.BOARD_LEFT + step * b;
      ctx.fillStyle = t.bucket;
      ctx.strokeStyle = b === BOARD.RUNE_BUCKET ? t.rune : t.bucketLine;
      ctx.lineWidth = b === BOARD.RUNE_BUCKET ? 3 : 1.5;
      roundRect(ctx, x + 4, y, step - 8, h, 10);
      ctx.fill();
      ctx.stroke();
      // 桶倍率标签
      ctx.fillStyle = b === BOARD.RUNE_BUCKET ? t.rune : t.text;
      ctx.font = b === BOARD.RUNE_BUCKET ? 'bold 20px system-ui, sans-serif' : 'bold 22px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      if (b === BOARD.RUNE_BUCKET) ctx.fillText('RUNE', x + step / 2, y + h / 2);
      else ctx.fillText('×' + BOARD.BUCKET_MULT[b], x + step / 2, y + h / 2);
    }
  }

  function drawBeads(run, t) {
    if (!run || !run.lastRoll) return;
    const start = run.lastRoll.startTime;
    const prog = clamp((run.time - start) / ROLL_SETTLE_SEC, 0, 1);
    for (const b of run.lastRoll.beads) {
      const lx = BOARD.LANE_X[b.lane];
      const bx = BOARD.BOARD_LEFT + ((BOARD.BOARD_RIGHT - BOARD.BOARD_LEFT) / BOARD.BUCKETS) * (b.bucket + 0.5);
      const y = BOARD.ENTRY_Y + (BOARD.BUCKET_Y + BOARD.BUCKET_H / 2 - BOARD.ENTRY_Y) * easeOutQuad(prog);
      const x = lx + (bx - lx) * prog + Math.sin(prog * Math.PI * 5) * 16 * (1 - prog);
      ctx.save();
      ctx.shadowColor = t.beadGlow;
      ctx.shadowBlur = 16;
      ctx.fillStyle = t.bead;
      ctx.beginPath();
      ctx.arc(x, y, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  function drawTripleGlow(run, t) {
    if (!run || !run.lastRoll || !run.lastRoll.triple) return;
    const k = 0.5 + 0.5 * Math.sin(performance.now() / 120);
    ctx.save();
    ctx.fillStyle = `rgba(255, 217, 138, ${0.10 + 0.10 * k})`;
    ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
    ctx.strokeStyle = t.archGlow;
    ctx.lineWidth = 10 + 4 * k;
    ctx.shadowColor = t.archGlow;
    ctx.shadowBlur = 30;
    roundRect(ctx, 272, 72, 736, 500, 26);
    ctx.stroke();
    ctx.restore();
  }

  function drawParticles(dt) {
    const remaining = [];
    for (const p of particles) {
      p.life -= dt;
      if (p.life <= 0) continue;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 260 * dt;
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
      remaining.push(p);
    }
    ctx.globalAlpha = 1;
    particles.length = 0;
    particles.push(...remaining);
  }

  function draw(run, alpha = 1) {
    const scene = run ? run.scene : 1;
    const t = sceneOf(scene);
    ctx.clearRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);

    ctx.save();
    if (shake > 0) {
      ctx.translate((Math.random() - 0.5) * 10 * (shake / 0.35), (Math.random() - 0.5) * 8 * (shake / 0.35));
      shake = Math.max(0, shake - 1 / 60);
    }

    drawBackdrop(t);
    drawDeco(t);
    drawArch(t);
    if (run) {
      drawTripleGlow(run, t);
      drawLanes(run, t);
      drawPegs(t);
      drawBuckets(run, t);
      drawBeads(run, t);
    } else {
      drawLanes(null, t);
      drawPegs(t);
      drawBuckets(null, t);
    }
    ctx.restore();

    drawParticles(1 / 60);
  }

  return { draw, burst, get particles() { return particles; } };
}

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
