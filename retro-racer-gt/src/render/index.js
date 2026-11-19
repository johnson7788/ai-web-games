// RETRO RACER GT · Canvas 2D 霓虹街机渲染（纯程序化，零素材零外链）
// 画 synthwave 天空 + 透视网格 + 4 车道公路 + 玩家车 + 车流 + 岩石 + 能量星 + 氮气焰。
import { WORLD, LANE_X, PLAYER, CAR, SPAWN, OBSTACLE, STAR } from '../../config/game.config.js';

const ROAD_LEFT = 320;
const ROAD_RIGHT = 960;
const LANE_W = 160;

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

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const dpr = Math.min((typeof window !== 'undefined' && window.devicePixelRatio) || 1, 2);
  const W = WORLD.WIDTH;
  const H = WORLD.HEIGHT;
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  let attractScroll = 0;

  function glow(color, blur) {
    ctx.shadowColor = color;
    ctx.shadowBlur = blur;
  }
  function noGlow() { ctx.shadowBlur = 0; }

  // ---------- 背景 ----------
  function drawSky() {
    const g = ctx.createLinearGradient(0, 0, 0, H * 0.72);
    g.addColorStop(0, '#0b0620');
    g.addColorStop(0.55, '#2a0f4a');
    g.addColorStop(1, '#5b1a6b');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H * 0.72);

    // 落日（synthwave 圆形 + 条纹）
    const cx = W / 2;
    const cy = H * 0.52;
    const r = 120;
    const sg = ctx.createLinearGradient(0, cy - r, 0, cy + r);
    sg.addColorStop(0, '#ffd76a');
    sg.addColorStop(0.55, '#ff7ad9');
    sg.addColorStop(1, '#7a3bff');
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = sg;
    ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
    // 条纹
    ctx.fillStyle = '#0b0620';
    for (let i = 0; i < 5; i += 1) {
      const yy = cy + r * 0.18 + i * r * 0.22;
      const hh = 6 + i * 4;
      ctx.fillRect(cx - r, yy, r * 2, hh);
    }
    ctx.restore();
    noGlow();

    // 透视网格地面
    ctx.strokeStyle = 'rgba(255,90,220,0.30)';
    ctx.lineWidth = 1;
    for (let i = 0; i < 12; i += 1) {
      const t = i / 11;
      const yy = H * 0.72 + t * t * (H * 0.28);
      ctx.beginPath();
      ctx.moveTo(0, yy);
      ctx.lineTo(W, yy);
      ctx.stroke();
    }
    for (let i = -8; i <= 8; i += 1) {
      ctx.beginPath();
      ctx.moveTo(W / 2 + i * 40 * 0.4, H * 0.72);
      ctx.lineTo(W / 2 + i * 130, H);
      ctx.stroke();
    }
  }

  // ---------- 公路 ----------
  function drawRoad(scroll) {
    ctx.fillStyle = '#120b24';
    ctx.fillRect(ROAD_LEFT - 6, 0, ROAD_RIGHT - ROAD_LEFT + 12, H);

    // 路沿霓虹
    glow('#22e0ff', 14);
    ctx.strokeStyle = '#22e0ff';
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(ROAD_LEFT, 0); ctx.lineTo(ROAD_LEFT, H); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(ROAD_RIGHT, 0); ctx.lineTo(ROAD_RIGHT, H); ctx.stroke();
    noGlow();

    // 车道分隔虚线
    const dashH = 42;
    const gap = 46;
    const off = ((scroll % (dashH + gap)) + (dashH + gap)) % (dashH + gap);
    glow('#ff4fd8', 8);
    ctx.strokeStyle = 'rgba(255,120,230,0.85)';
    ctx.lineWidth = 5;
    for (let l = 1; l < 4; l += 1) {
      const x = ROAD_LEFT + l * LANE_W;
      for (let y = -off - dashH; y < H + dashH; y += dashH + gap) {
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x, y + dashH);
        ctx.stroke();
      }
    }
    noGlow();
  }

  // ---------- 车辆 ----------
  function drawCar(x, y, w, h, color, opts = {}) {
    const { angle = 0, player = false, oncoming = false } = opts;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate((angle * Math.PI) / 180);
    const hw = w / 2;
    const hh = h / 2;

    if (player) {
      glow(color, 24);
      ctx.fillStyle = color;
      roundRect(ctx, -hw, -hh, w, h, 14);
      ctx.fill();
      noGlow();
      // 车顶 / 挡风
      ctx.fillStyle = '#0e2b3c';
      roundRect(ctx, -hw + 7, -hh + 8, w - 14, h * 0.42, 8);
      ctx.fill();
      ctx.fillStyle = 'rgba(140,240,255,0.9)';
      roundRect(ctx, -hw + 12, -hh + 14, w - 24, h * 0.16, 5);
      ctx.fill();
      // 尾灯
      glow('#ff2d55', 12);
      ctx.fillStyle = '#ff2d55';
      ctx.fillRect(-hw + 6, hh - 14, 10, 8);
      ctx.fillRect(hw - 16, hh - 14, 10, 8);
      noGlow();
      // 轮
      ctx.fillStyle = '#05030a';
      ctx.fillRect(-hw - 4, -hh + 10, 6, 20);
      ctx.fillRect(hw - 2, -hh + 10, 6, 20);
      ctx.fillRect(-hw - 4, hh - 30, 6, 20);
      ctx.fillRect(hw - 2, hh - 30, 6, 20);
    } else {
      glow(color, 14);
      ctx.fillStyle = color;
      roundRect(ctx, -hw, -hh, w, h, 12);
      ctx.fill();
      noGlow();
      ctx.fillStyle = 'rgba(10,10,20,0.55)';
      roundRect(ctx, -hw + 6, -hh + 6, w - 12, h * 0.42, 6);
      ctx.fill();
      if (oncoming) {
        // 对向车：白色头灯（顶部）
        glow('#fff7cc', 10);
        ctx.fillStyle = '#fff3b0';
        ctx.fillRect(-hw + 6, -hh + 2, 9, 7);
        ctx.fillRect(hw - 15, -hh + 2, 9, 7);
        noGlow();
      } else {
        // 同向车：红色尾灯（底部）
        glow('#ff5252', 10);
        ctx.fillStyle = '#ff5252';
        ctx.fillRect(-hw + 6, hh - 9, 9, 7);
        ctx.fillRect(hw - 15, hh - 9, 9, 7);
        noGlow();
      }
      ctx.fillStyle = '#05030a';
      ctx.fillRect(-hw - 4, -hh + 12, 5, 16);
      ctx.fillRect(hw - 1, -hh + 12, 5, 16);
      ctx.fillRect(-hw - 4, hh - 28, 5, 16);
      ctx.fillRect(hw - 1, hh - 28, 5, 16);
    }
    ctx.restore();
  }

  // ---------- 岩石 ----------
  function drawRock(x, y, t) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.sin(t * 1.5 + x) * 0.12);
    glow('#ff9a3d', 16);
    ctx.fillStyle = '#ff9a3d';
    ctx.beginPath();
    const s = OBSTACLE.rockW / 2;
    const pts = 6;
    for (let i = 0; i < pts; i += 1) {
      const rr = s * (i % 2 === 0 ? 1 : 0.78);
      const a = (i / pts) * Math.PI * 2 - Math.PI / 2;
      const px = Math.cos(a) * rr;
      const py = Math.sin(a) * rr;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    noGlow();
    ctx.strokeStyle = '#7a3200';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-s * 0.5, s * 0.1);
    ctx.lineTo(s * 0.1, -s * 0.2);
    ctx.lineTo(s * 0.5, s * 0.2);
    ctx.stroke();
    ctx.restore();
  }

  // ---------- 能量星 ----------
  function drawStar(x, y, t) {
    ctx.save();
    ctx.translate(x, y);
    const pulse = 1 + 0.16 * Math.sin(t * 5 + x);
    ctx.scale(pulse, pulse);
    glow('#ffd84d', 20);
    ctx.fillStyle = '#ffd84d';
    ctx.beginPath();
    const R = STAR.w / 2;
    const r = R * 0.45;
    for (let i = 0; i < 10; i += 1) {
      const rr = i % 2 === 0 ? R : r;
      const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
      const px = Math.cos(a) * rr;
      const py = Math.sin(a) * rr;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    noGlow();
    ctx.restore();
  }

  function draw(state, dt, view) {
    const speed = state ? state.speed : 420;
    const scroll = state ? (state.time * speed) : attractScroll;

    drawSky();
    drawRoad(scroll);

    // 车流 / 岩石 / 星（有 state 才画真实物体）
    if (state) {
      for (const c of state.cars) {
        const hue = c.hue || 200;
        const color = `hsl(${hue}, 95%, 60%)`;
        drawCar(LANE_X[c.lane], c.y, c.w, c.h, color, { oncoming: c.dir === -1 });
      }
      for (const r of state.rocks) drawRock(LANE_X[r.lane], r.y, state.time);
      for (const s of state.stars) drawStar(LANE_X[s.lane], s.y, state.time);

      // 玩家车（最亮）
      const px = state.laneX;
      const py = PLAYER.Y;
      const tilt = state.turnDir * CAR.carAng;
      if (state.nitroActive) drawNitroFlames(px, py, state.time, state.speed);
      drawCar(px, py, PLAYER.W, PLAYER.H, '#f4fbff', { angle: tilt, player: true });
    } else {
      // 吸睛模式：一辆演示车巡航
      drawCar(W / 2, H * 0.7, PLAYER.W, PLAYER.H, '#f4fbff', { player: true });
    }
  }

  function drawNitroFlames(px, py, t, speed) {
    const n = 5;
    for (let i = 0; i < n; i += 1) {
      const fx = px + (Math.sin(t * 30 + i * 2.1) * 12);
      const fy = py + PLAYER.H / 2 + 4 + i * 12;
      const len = 18 + Math.sin(t * 40 + i) * 8;
      glow(i % 2 ? '#22e0ff' : '#ff4fd8', 14);
      ctx.fillStyle = i % 2 ? 'rgba(120,240,255,0.9)' : 'rgba(255,120,230,0.9)';
      ctx.beginPath();
      ctx.ellipse(fx, fy, 9 - i, len / 2, 0, 0, Math.PI * 2);
      ctx.fill();
      noGlow();
    }
  }

  return {
    draw(state, dt, view) {
      // 兼容两种调用：draw(state, dt, view)
      draw(state, dt, view || {});
    },
    debugLayout() {
      return {
        road: { x: ROAD_LEFT, y: 0, w: ROAD_RIGHT - ROAD_LEFT, h: H },
        lanes: LANE_X.map((x) => ({ x: x - LANE_W / 2, y: 0, w: LANE_W, h: H })),
      };
    },
  };
}
