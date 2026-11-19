// 霓虹街机渲染：程序化 canvas 2D，零素材。砖块/球/炮台/粒子全手绘。
import { WORLD, GRID, CANNON, BALL, DANGER_Y } from '../../config/game.config.js';

const HP_COLORS = {
  1: '#00e5ff', 2: '#39ff88', 3: '#ffe14d', 4: '#ff9f1c',
  5: '#ff4d8d', 6: '#ff3b3b', 7: '#b14dff', 8: '#3b82ff', 9: '#ffffff',
};

const TYPE_COLORS = {
  h: '#ffd166',
  v: '#ffd166',
  b: '#ff5c5c',
  plus: '#4ade80',
  scatter: '#22d3ee',
  rock: '#64748b',
};

function hpColor(hp) {
  return HP_COLORS[Math.min(9, Math.max(1, hp))] || '#00e5ff';
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = WORLD.WIDTH * dpr;
  canvas.height = WORLD.HEIGHT * dpr;
  canvas.style.width = `${WORLD.WIDTH}px`;
  canvas.style.height = `${WORLD.HEIGHT}px`;
  ctx.scale(dpr, dpr);

  function roundRect(x, y, w, h, r) {
    const rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  }

  function drawBackground(scene) {
    const grad = ctx.createLinearGradient(0, 0, 0, WORLD.HEIGHT);
    if (scene === 'sunset') {
      grad.addColorStop(0, '#160a24');
      grad.addColorStop(1, '#2a0e2e');
    } else if (scene === 'aurora') {
      grad.addColorStop(0, '#04141f');
      grad.addColorStop(1, '#0a1a2e');
    } else {
      grad.addColorStop(0, '#05060f');
      grad.addColorStop(1, '#0d1030');
    }
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);

    // 微弱网格
    ctx.strokeStyle = 'rgba(120,140,255,0.05)';
    ctx.lineWidth = 1;
    for (let x = 0; x <= WORLD.WIDTH; x += 80) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, WORLD.HEIGHT); ctx.stroke();
    }
    for (let y = 0; y <= WORLD.HEIGHT; y += 80) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(WORLD.WIDTH, y); ctx.stroke();
    }
  }

  function drawDangerLine() {
    ctx.save();
    ctx.strokeStyle = 'rgba(255,80,80,0.5)';
    ctx.setLineDash([10, 8]);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(GRID.X0 - 12, DANGER_Y);
    ctx.lineTo(GRID.X0 + GRID.COLS * GRID.CELL_W + (GRID.COLS - 1) * GRID.GAP + 12, DANGER_Y);
    ctx.stroke();
    ctx.restore();
  }

  function drawBrick(b) {
    ctx.save();
    const color = b.type === 'num' ? hpColor(b.hp) : (TYPE_COLORS[b.type] || '#888');
    ctx.shadowColor = color;
    ctx.shadowBlur = b.type === 'rock' ? 4 : 12;
    ctx.fillStyle = color;
    roundRect(b.x, b.y, b.w, b.h, 8);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.globalAlpha = 0.25;
    ctx.fillStyle = '#ffffff';
    roundRect(b.x + 3, b.y + 3, b.w - 6, 6, 3);
    ctx.fill();
    ctx.globalAlpha = 1;

    // 描边
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 1.5;
    roundRect(b.x, b.y, b.w, b.h, 8);
    ctx.stroke();

    // 内容
    ctx.fillStyle = 'rgba(0,0,0,0.75)';
    ctx.font = 'bold 20px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const cx = b.x + b.w / 2;
    const cy = b.y + b.h / 2;
    if (b.type === 'num') {
      ctx.fillText(String(b.hp), cx, cy + 1);
    } else if (b.type === 'rock') {
      ctx.fillText('▲', cx, cy + 1);
    } else if (b.type === 'h') {
      ctx.fillText('⟷', cx, cy + 1);
    } else if (b.type === 'v') {
      ctx.fillText('⟵⟶', cx, cy + 1);
    } else if (b.type === 'b') {
      ctx.fillText('●', cx, cy + 1);
    } else if (b.type === 'plus') {
      ctx.fillText('+1', cx, cy + 1);
    } else if (b.type === 'scatter') {
      ctx.fillText('⟨⟩', cx, cy + 1);
    }
    ctx.restore();
  }

  function drawCannon(angle, firing) {
    ctx.save();
    ctx.translate(CANNON.X, CANNON.Y);
    ctx.rotate((angle * Math.PI) / 180);
    // 底座
    ctx.fillStyle = '#1b2340';
    ctx.strokeStyle = '#3b82ff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 26, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // 炮管
    ctx.fillStyle = '#3b82ff';
    ctx.shadowColor = '#3b82ff';
    ctx.shadowBlur = 14;
    roundRect(-9, -40, 18, 44, 6);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.restore();

    // 瞄准引导线
    ctx.save();
    ctx.strokeStyle = 'rgba(120,180,255,0.6)';
    ctx.setLineDash([6, 10]);
    ctx.lineWidth = 2;
    const rad = (angle * Math.PI) / 180;
    const dx = Math.sin(rad);
    const dy = -Math.cos(rad);
    ctx.beginPath();
    ctx.moveTo(CANNON.X + dx * 44, CANNON.Y + dy * 44);
    ctx.lineTo(CANNON.X + dx * 200, CANNON.Y + dy * 200);
    ctx.stroke();
    ctx.restore();
  }

  function drawBall(b) {
    ctx.save();
    ctx.shadowColor = '#7dd3fc';
    ctx.shadowBlur = 16;
    ctx.fillStyle = '#e0f2fe';
    ctx.beginPath();
    ctx.arc(b.x, b.y, BALL.R, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#38bdf8';
    ctx.beginPath();
    ctx.arc(b.x, b.y, BALL.R - 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawParticles(fx) {
    for (const p of fx) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, Math.min(1, p.ttl / p.maxTtl));
      ctx.fillStyle = p.color || '#fff';
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size || 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  return {
    draw(state, dt, view) {
      ctx.clearRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
      drawBackground(state ? state.scene : 'nebula');
      drawDangerLine();

      if (!state) {
        // 标题屏：装饰性霓虹砖条
        const demo = ['2', '4', '1', '3', '2', '1'];
        for (let c = 0; c < 6; c += 1) {
          const b = { type: 'num', hp: Number(demo[c]), x: GRID.X0 + c * (GRID.CELL_W + GRID.GAP) + 50, y: GRID.Y0 + 40, w: GRID.CELL_W - 40, h: GRID.CELL_H };
          drawBrick(b);
        }
        drawCannon(0, false);
        return;
      }

      for (const b of state.bricks) {
        if (b.dead) continue;
        drawBrick(b);
      }
      for (const b of state.balls) drawBall(b);
      drawCannon(state.cannonAngle, state.phase === 'flying');
      if (view && view.fx) drawParticles(view.fx);
    },

    debugLayout() {
      return {
        grid: { x: GRID.X0, y: GRID.Y0, w: GRID.COLS * GRID.CELL_W + (GRID.COLS - 1) * GRID.GAP, h: GRID.ROWS * GRID.CELL_H + (GRID.ROWS - 1) * GRID.GAP },
        cell: GRID.CELL_W,
        cannon: { x: CANNON.X, y: CANNON.Y },
        dangerY: DANGER_Y,
      };
    },
  };
}
