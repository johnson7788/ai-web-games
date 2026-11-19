// MONKEY DASH RUN · Canvas 程序化渲染（霓虹街机风，零素材）
import { WORLD, LANES_X, PLAYER_Y, PLAYER_R, ENTITY_R } from '../../config/game.config.js';

const W = WORLD.WIDTH;
const H = WORLD.HEIGHT;

const COL = {
  bgTop: '#0a0a20',
  bgBottom: '#12122f',
  grid: '#20204a',
  lane: '#2b2b5e',
  laneEdge: '#3d3d7a',
  leftGlow: '#38f0ff',
  rightGlow: '#ff3df0',
  banana: '#ffd93d',
  shield: '#38f0ff',
  spark: '#ff3df0',
  cactus: '#3dff8f',
  wasp: '#ffd93d',
  rock: '#b9c0d0',
  player: '#ffcf3d',
};

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const dpr = Math.min(2, (typeof window !== 'undefined' ? window.devicePixelRatio : 1) || 1);
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  canvas.style.width = `${W}px`;
  canvas.style.height = `${H}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  function glow(color, blur, fn) {
    ctx.save();
    ctx.shadowColor = color;
    ctx.shadowBlur = blur;
    fn();
    ctx.restore();
  }

  function drawBackground(scrollY, time) {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, COL.bgTop);
    g.addColorStop(1, COL.bgBottom);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // 滚动霓虹网格（向下滚动 = scrollY 增加）
    const gap = 90;
    const off = scrollY % gap;
    ctx.strokeStyle = COL.grid;
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.55;
    for (let y = off - gap; y < H + gap; y += gap) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }
    ctx.globalAlpha = 1;

    // 两侧霓虹藤蔓（三角叶，缓慢视差）
    drawVines(scrollY * 0.5, time);
  }

  function drawVines(scrollY, time) {
    ctx.save();
    ctx.globalAlpha = 0.7;
    for (let i = 0; i < 7; i += 1) {
      const y = ((i * 240 - scrollY * 1.4) % (H + 260)) - 130;
      const side = i % 2 === 0 ? 40 : W - 40;
      const s = side < W / 2 ? 1 : -1;
      ctx.fillStyle = i % 2 === 0 ? '#14335a' : '#2a144a';
      ctx.beginPath();
      ctx.moveTo(side, y);
      ctx.lineTo(side + s * 70, y - 90);
      ctx.lineTo(side + s * 46, y - 16);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  function drawLanes(scrollY) {
    const dash = 40;
    for (const x of LANES_X) {
      // 车道底
      ctx.fillStyle = COL.lane;
      ctx.fillRect(x - 120, 0, 240, H);
      // 车道边线（虚线向下滚动）
      ctx.strokeStyle = COL.laneEdge;
      ctx.lineWidth = 3;
      ctx.setLineDash([dash, dash]);
      const off = scrollY % (dash * 2);
      ctx.lineDashOffset = off;
      for (const dx of [-120, 120]) {
        ctx.beginPath();
        ctx.moveTo(x + dx, 0);
        ctx.lineTo(x + dx, H);
        ctx.stroke();
      }
      ctx.setLineDash([]);
    }
    // 中央分隔
    ctx.fillStyle = COL.grid;
    ctx.fillRect(W / 2 - 4, 0, 8, H);
  }

  function drawMonkey(x, y, state, time, reduced) {
    const bob = reduced ? 0 : Math.sin(time * 6) * 3;
    const cy = y + bob;
    ctx.save();
    // 身体
    glow(COL.player, 18, () => {
      ctx.fillStyle = COL.player;
      ctx.beginPath();
      ctx.arc(x, cy, 24, 0, Math.PI * 2);
      ctx.fill();
    });
    // 耳朵
    for (const ex of [-20, 20]) {
      glow('#ff9d3d', 8, () => {
        ctx.fillStyle = '#ffb84d';
        ctx.beginPath();
        ctx.arc(x + ex, cy - 20, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#7a4a1f';
        ctx.beginPath();
        ctx.arc(x + ex, cy - 20, 4, 0, Math.PI * 2);
        ctx.fill();
      });
    }
    // 脸
    ctx.fillStyle = '#8a5a24';
    ctx.beginPath();
    ctx.arc(x, cy + 2, 14, 0, Math.PI);
    ctx.fill();
    // 眼睛
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(x - 7, cy - 4, 5, 0, Math.PI * 2);
    ctx.arc(x + 7, cy - 4, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1a1030';
    ctx.beginPath();
    ctx.arc(x - 6, cy - 4, 2.4, 0, Math.PI * 2);
    ctx.arc(x + 8, cy - 4, 2.4, 0, Math.PI * 2);
    ctx.fill();

    // 无敌/冲刺光环
    if (state.invincible > 0) {
      glow(COL.shield, 22, () => {
        ctx.strokeStyle = COL.shield;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(x, cy, 34, 0, Math.PI * 2);
        ctx.stroke();
      });
    }
    if (state.rush > 0) {
      glow(COL.spark, 26, () => {
        ctx.strokeStyle = COL.spark;
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.arc(x, cy, 38 + (reduced ? 0 : Math.sin(time * 10) * 3), 0, Math.PI * 2);
        ctx.stroke();
      });
      // 速度线
      if (!reduced) {
        ctx.strokeStyle = 'rgba(255,255,255,0.55)';
        ctx.lineWidth = 2;
        for (let i = 0; i < 5; i += 1) {
          const ly = y - 60 - i * 26 + (scrollOff(time) % 26);
          ctx.beginPath();
          ctx.moveTo(x - 40 + i * 16, ly);
          ctx.lineTo(x + 40 - i * 16, ly - 20);
          ctx.stroke();
        }
      }
    }
    ctx.restore();
  }

  function scrollOff(time) {
    return (time * 900) % 26;
  }

  function drawEntity(e, time) {
    const x = e.kind === 'wasp' ? e.x : (LANES_X[e.lane] ?? LANES_X[0]);
    const y = e.y;
    ctx.save();
    if (e.kind === 'cactus') {
      glow(COL.cactus, 12, () => {
        ctx.fillStyle = COL.cactus;
        ctx.beginPath();
        ctx.ellipse(x, y, 16, 26, 0, 0, Math.PI * 2);
        ctx.fill();
        // 刺
        ctx.strokeStyle = COL.cactus;
        ctx.lineWidth = 3;
        for (let a = 0; a < Math.PI * 2; a += Math.PI / 4) {
          ctx.beginPath();
          ctx.moveTo(x + Math.cos(a) * 16, y + Math.sin(a) * 26);
          ctx.lineTo(x + Math.cos(a) * 30, y + Math.sin(a) * 40);
          ctx.stroke();
        }
      });
      ctx.fillStyle = '#0f3a22';
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, Math.PI * 2);
      ctx.fill();
    } else if (e.kind === 'wasp') {
      const flap = Math.sin(time * 40 + e.t) * 0.6;
      // 翅膀
      glow('rgba(255,255,255,0.7)', 8, () => {
        ctx.fillStyle = 'rgba(220,240,255,0.7)';
        ctx.beginPath();
        ctx.ellipse(x - 18, y - 6, 12, 6, -0.4 + flap, 0, Math.PI * 2);
        ctx.ellipse(x + 18, y - 6, 12, 6, 0.4 - flap, 0, Math.PI * 2);
        ctx.fill();
      });
      glow(COL.wasp, 10, () => {
        ctx.fillStyle = COL.wasp;
        ctx.beginPath();
        ctx.arc(x, y, 16, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.fillStyle = '#1a1030';
      ctx.fillRect(x - 14, y - 4, 28, 6);
      ctx.fillRect(x - 14, y + 4, 28, 6);
    } else if (e.kind === 'rock') {
      glow(COL.rock, 12, () => {
        ctx.fillStyle = COL.rock;
        ctx.beginPath();
        ctx.arc(x, y, 34, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.fillStyle = '#5a5f6e';
      ctx.beginPath();
      ctx.arc(x - 10, y - 8, 7, 0, Math.PI * 2);
      ctx.arc(x + 12, y + 6, 5, 0, Math.PI * 2);
      ctx.fill();
    } else if (e.kind === 'banana') {
      glow(COL.banana, 14, () => {
        ctx.strokeStyle = COL.banana;
        ctx.lineWidth = 9;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.arc(x, y, 20, -0.9, 2.4);
        ctx.stroke();
      });
    } else if (e.kind === 'shield') {
      glow(COL.shield, 16, () => {
        ctx.strokeStyle = COL.shield;
        ctx.lineWidth = 5;
        ctx.beginPath();
        ctx.moveTo(x, y - 20);
        ctx.lineTo(x + 16, y - 10);
        ctx.lineTo(x + 16, y + 8);
        ctx.quadraticCurveTo(x + 16, y + 22, x, y + 24);
        ctx.quadraticCurveTo(x - 16, y + 22, x - 16, y + 8);
        ctx.lineTo(x - 16, y - 10);
        ctx.closePath();
        ctx.stroke();
      });
    } else if (e.kind === 'spark') {
      glow(COL.spark, 18, () => {
        ctx.fillStyle = COL.spark;
        const s = 14 + Math.sin(time * 8 + e.t) * 4;
        ctx.beginPath();
        for (let i = 0; i < 4; i += 1) {
          const a = (Math.PI / 2) * i;
          ctx.moveTo(x, y);
          ctx.quadraticCurveTo(
            x + Math.cos(a) * s * 0.3 - Math.sin(a) * s * 0.3,
            y + Math.sin(a) * s * 0.3 + Math.cos(a) * s * 0.3,
            x + Math.cos(a) * s, y + Math.sin(a) * s,
          );
          ctx.quadraticCurveTo(
            x + Math.cos(a) * s * 0.3 + Math.sin(a) * s * 0.3,
            y + Math.sin(a) * s * 0.3 - Math.cos(a) * s * 0.3,
            x, y,
          );
        }
        ctx.fill();
      });
    }
    ctx.restore();
  }

  function draw(state, dt, view) {
    const time = (view && view.time) || 0;
    const reduced = !!(view && view.reducedMotion);
    const scrollY = state ? state.distance : 0;
    ctx.clearRect(0, 0, W, H);
    drawBackground(scrollY, time);
    drawLanes(scrollY);

    if (state) {
      // 实体按 y 排序绘制（近的在上层）
      const sorted = [...state.entities].sort((a, b) => a.y - b.y);
      for (const e of sorted) drawEntity(e, time);
      drawMonkey(LANES_X[state.lane] ?? LANES_X[0], PLAYER_Y, state, time, reduced);
    } else {
      // 标题屏：中央演示猴子
      drawMonkey(W / 2, H / 2 + 40, { invincible: 0, rush: 0 }, time, reduced);
    }
  }

  return {
    draw,
    debugLayout() {
      return {
        player: { x: (LANES_X[0] ?? 380) - 120, y: PLAYER_Y - 40, w: 240, h: 80 },
      };
    },
  };
}
