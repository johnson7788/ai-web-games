// PARK SLIDE IN · 霓虹街机渲染（程序化 canvas 2D，零素材零外链）
// 深色底 + 霓虹网格 + 合成波太阳 + 发光车位/能量球/护盾/巡逻无人机 + 发光玩家车。
import { WORLD, CAR } from '../../config/game.config.js';

const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

const PAL = {
  bg0: '#06060f',
  bg1: '#10101f',
  grid: 'rgba(0, 240, 255, 0.10)',
  sun: '#ff2bd6',
  sunCore: '#ff7ae8',
  bay: '#00f0ff',
  baySoft: 'rgba(0, 240, 255, 0.25)',
  orb: '#00f0ff',
  shield: '#ff2bd6',
  player: '#eaffff',
  playerGlow: '#00f0ff',
  playerAccent: '#ff2bd6',
  obstacle: '#24405e',
  obstacleEdge: 'rgba(80, 140, 220, 0.55)',
  drone: '#ff5a3c',
  wall: 'rgba(120, 140, 200, 0.5)',
  text: '#cfefff',
};

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = WORLD.WIDTH * dpr;
  canvas.height = WORLD.HEIGHT * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  let fx = []; // {x,y,vx,vy,life,ttl,color,size}
  let t = 0;

  function glow(color, blur = 12) {
    ctx.shadowColor = color;
    ctx.shadowBlur = blur;
  }
  function noGlow() {
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
  }

  function rr(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function drawBackground(sceneKey) {
    const g = ctx.createLinearGradient(0, 0, 0, WORLD.HEIGHT);
    g.addColorStop(0, PAL.bg0);
    g.addColorStop(1, PAL.bg1);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);

    // 合成波太阳（弱化，作为背景，不带横纹避免被误读成游戏物体）
    const sx = WORLD.WIDTH * 0.30;
    const sy = WORLD.HEIGHT * 0.46;
    const sunR = 110;
    ctx.globalAlpha = 0.5;
    ctx.fillStyle = PAL.sun;
    ctx.beginPath();
    ctx.arc(sx, sy, sunR, 0, TAU);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = PAL.sunCore;
    ctx.beginPath();
    ctx.arc(sx, sy, sunR * 0.80, 0, TAU);
    ctx.fill();
    ctx.fillStyle = PAL.bg1;
    ctx.beginPath();
    ctx.arc(sx, sy, sunR * 0.5, 0, TAU);
    ctx.fill();

    // 地平线网格（画在太阳之上，明确太阳是背景）
    ctx.strokeStyle = PAL.grid;
    ctx.lineWidth = 1;
    const horizon = WORLD.HEIGHT * 0.52;
    ctx.beginPath();
    for (let i = 0; i <= 14; i += 1) {
      const yy = horizon + i * 26;
      ctx.moveTo(0, yy);
      ctx.lineTo(WORLD.WIDTH, yy);
    }
    for (let i = 0; i <= 26; i += 1) {
      const xx = i * 64;
      ctx.moveTo(xx, horizon);
      ctx.lineTo(xx - (WORLD.WIDTH * 0.25), WORLD.HEIGHT);
    }
    ctx.stroke();

    if (!reduced) {
      // 扫描线
      ctx.fillStyle = 'rgba(0,0,0,0.06)';
      for (let y = 0; y < WORLD.HEIGHT; y += 4) ctx.fillRect(0, y, WORLD.WIDTH, 1);
    }
  }

  function drawBay(bay, state) {
    const x = bay.x - bay.w / 2;
    const y = bay.y - bay.h / 2;
    // 底座填充（更醒目）
    ctx.fillStyle = 'rgba(0, 240, 255, 0.16)';
    ctx.fillRect(x, y, bay.w, bay.h);
    // 虚线发光边框
    glow(PAL.bay, 18);
    ctx.strokeStyle = PAL.bay;
    ctx.lineWidth = 4;
    ctx.setLineDash([14, 9]);
    rr(x, y, bay.w, bay.h, 8);
    ctx.stroke();
    ctx.setLineDash([]);
    noGlow();
    // P 标记
    glow(PAL.bay, 12);
    ctx.fillStyle = PAL.bay;
    ctx.font = '700 56px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('P', bay.x, bay.y);
    // 明确目标文字（深色底板 + 亮字，一眼读懂目标）
    const label = 'PARK HERE';
    const labelY = bay.y - bay.h / 2 - 26;
    ctx.font = '700 22px system-ui, sans-serif';
    const lw = ctx.measureText(label).width;
    ctx.fillStyle = 'rgba(6, 6, 20, 0.82)';
    rr(bay.x - lw / 2 - 12, labelY - 16, lw + 24, 28, 8);
    ctx.fill();
    ctx.strokeStyle = PAL.bay;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = PAL.bay;
    ctx.fillText(label, bay.x, labelY + 2);
    noGlow();

    // 入位方向箭头（指向车位的开口侧，明确目标）
    const entry = (state && state.entry) || { heading: 0, reverse: false };
    const cos = Math.cos(entry.heading);
    const sin = Math.sin(entry.heading);
    const travelX = (entry.reverse ? -1 : 1) * cos;
    const travelY = (entry.reverse ? -1 : 1) * sin;
    const ax = bay.x - travelX * (bay.w / 2 + 30);
    const ay = bay.y - travelY * (bay.h / 2 + 30);
    ctx.save();
    ctx.translate(ax, ay);
    ctx.rotate(Math.atan2(travelY, travelX));
    glow(PAL.bay, 16);
    ctx.fillStyle = PAL.bay;
    for (const d of [0, 20, 40]) {
      ctx.beginPath();
      ctx.moveTo(d + 6, -15);
      ctx.lineTo(d + 22, 0);
      ctx.lineTo(d + 6, 15);
      ctx.closePath();
      ctx.fill();
    }
    noGlow();
    ctx.restore();
  }

  function drawObstacle(o) {
    const x = o.x - o.w / 2;
    const y = o.y - o.h / 2;
    ctx.fillStyle = PAL.obstacle;
    ctx.fillRect(x, y, o.w, o.h);
    ctx.strokeStyle = PAL.obstacleEdge;
    ctx.lineWidth = 2;
    rr(x + 3, y + 3, o.w - 6, o.h - 6, 6);
    ctx.stroke();
    // 车窗
    ctx.fillStyle = 'rgba(120, 180, 255, 0.18)';
    ctx.fillRect(x + 8, y + o.h * 0.18, o.w - 16, o.h * 0.30);
  }

  function drawOrb(o, i) {
    const pulse = reduced ? 1 : 0.8 + 0.2 * Math.sin(t * 4 + i * 1.3);
    const r = 9 * pulse;
    glow(PAL.orb, 16);
    ctx.fillStyle = PAL.orb;
    ctx.beginPath();
    ctx.arc(o.x, o.y, r, 0, TAU);
    ctx.fill();
    noGlow();
    ctx.fillStyle = '#eaffff';
    ctx.beginPath();
    ctx.arc(o.x, o.y, r * 0.4, 0, TAU);
    ctx.fill();
  }

  function drawShield(s, i) {
    const pulse = reduced ? 1 : 0.85 + 0.15 * Math.sin(t * 5 + i);
    const r = 13 * pulse;
    glow(PAL.shield, 16);
    ctx.strokeStyle = PAL.shield;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(s.x, s.y - r);
    ctx.lineTo(s.x + r, s.y);
    ctx.lineTo(s.x, s.y + r);
    ctx.lineTo(s.x - r, s.y);
    ctx.closePath();
    ctx.stroke();
    noGlow();
    ctx.fillStyle = PAL.shield;
    ctx.beginPath();
    ctx.arc(s.x, s.y, 3, 0, TAU);
    ctx.fill();
  }

  function drawDrone(m) {
    const x = m.x - m.w / 2;
    const y = m.y - m.h / 2;
    const blink = !reduced && (t * 2) % 1 < 0.5;
    glow(PAL.drone, 16);
    ctx.fillStyle = 'rgba(60, 24, 18, 0.9)';
    rr(x, y, m.w, m.h, 8);
    ctx.fill();
    ctx.strokeStyle = PAL.drone;
    ctx.lineWidth = 3;
    rr(x, y, m.w, m.h, 8);
    ctx.stroke();
    noGlow();
    // 警示灯
    ctx.fillStyle = blink ? '#ffd23c' : '#ff5a3c';
    ctx.beginPath();
    ctx.arc(m.x, m.y, 6, 0, TAU);
    ctx.fill();
    // 旋翼
    ctx.strokeStyle = 'rgba(255,90,60,0.7)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x - 8, m.y);
    ctx.lineTo(x + 2, m.y);
    ctx.moveTo(x + m.w - 2, m.y);
    ctx.lineTo(x + m.w + 8, m.y);
    ctx.stroke();
  }

  function drawCar(car, isPlayer) {
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.heading);

    // 轮子（前轮随转向）
    const wheelW = 8;
    const wheelH = 16;
    const wy = 24;
    for (const [wx, steer] of [[CAR.FRONT_AXLE, car.steer], [CAR.REAR_AXLE, 0]]) {
      for (const side of [-1, 1]) {
        ctx.save();
        ctx.translate(wx, side * wy);
        ctx.rotate(steer);
        ctx.fillStyle = '#0b0b16';
        ctx.fillRect(-wheelH / 2, -wheelW / 2, wheelH, wheelW);
        ctx.restore();
      }
    }

    // 车体
    const hw = CAR.WIDTH / 2;
    const hl = CAR.LENGTH / 2;
    if (isPlayer) {
      glow(PAL.playerGlow, 20);
      ctx.fillStyle = PAL.player;
    } else {
      ctx.fillStyle = '#1a2740';
    }
    rr(-hl, -hw, CAR.LENGTH, CAR.WIDTH, 14);
    ctx.fill();
    if (isPlayer) {
      noGlow();
      // 引擎盖饰条
      ctx.strokeStyle = PAL.playerAccent;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(-hl + 10, -hw + 6);
      ctx.lineTo(hl - 12, -hw + 6);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-hl + 10, hw - 6);
      ctx.lineTo(hl - 12, hw - 6);
      ctx.stroke();
    }

    // 车窗
    ctx.fillStyle = isPlayer ? 'rgba(0, 20, 30, 0.85)' : 'rgba(120, 180, 255, 0.18)';
    rr(-6, -hw + 7, 30, CAR.WIDTH - 14, 6);
    ctx.fill();
    rr(30, -hw + 7, 18, CAR.WIDTH - 14, 6);
    ctx.fill();

    if (isPlayer) {
      // 车灯
      glow('#ffe97a', 10);
      ctx.fillStyle = '#ffe97a';
      ctx.fillRect(hl - 3, -hw + 4, 3, 8);
      ctx.fillRect(hl - 3, hw - 12, 3, 8);
      noGlow();
      // 尾灯
      glow(PAL.playerAccent, 8);
      ctx.fillStyle = PAL.playerAccent;
      ctx.fillRect(-hl, -hw + 4, 3, 8);
      ctx.fillRect(-hl, hw - 12, 3, 8);
      noGlow();
    }

    ctx.restore();
  }

  function emitExhaust(car, dt) {
    if (Math.abs(car.speed) < 12 || fx.length > 120) return;
    const cos = Math.cos(car.heading);
    const sin = Math.sin(car.heading);
    const back = -CAR.LENGTH / 2;
    const perp = -Math.sin(car.heading);
    const perp2 = Math.cos(car.heading);
    const bx = car.x + back * cos;
    const by = car.y + back * sin;
    for (const side of [-1, 1]) {
      if (Math.random() < 0.6) {
        fx.push({
          x: bx + side * 10 * perp2,
          y: by + side * 10 * perp,
          vx: -cos * 40 - Math.sign(car.speed) * 10 * perp2 * side,
          vy: -sin * 40 + Math.sign(car.speed) * 10 * perp * side,
          life: 0,
          ttl: 0.4 + Math.random() * 0.25,
          color: Math.random() < 0.5 ? '#00f0ff' : '#ff2bd6',
          size: 2 + Math.random() * 3,
        });
      }
    }
  }

  function updateFx(dt) {
    for (const p of fx) {
      p.life += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.94;
      p.vy *= 0.94;
    }
    fx = fx.filter((p) => p.life < p.ttl);
  }

  function drawFx() {
    for (const p of fx) {
      const a = 1 - p.life / p.ttl;
      ctx.globalAlpha = Math.max(0, a);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size * a, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function burst(x, y, color, n = 12) {
    for (let i = 0; i < n; i += 1) {
      const ang = Math.random() * TAU;
      const sp = 40 + Math.random() * 120;
      fx.push({
        x, y,
        vx: Math.cos(ang) * sp,
        vy: Math.sin(ang) * sp,
        life: 0,
        ttl: 0.35 + Math.random() * 0.3,
        color,
        size: 2 + Math.random() * 3,
      });
    }
  }

  function draw(state, dt, view = {}) {
    t += reduced ? 0 : dt;
    const sceneKey = state ? state.level : 'title';

    if (state && state.phase === 'playing') emitExhaust(state.car, dt);
    updateFx(dt);

    ctx.clearRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);

    if (view.shake > 0) {
      ctx.save();
      ctx.translate((Math.random() - 0.5) * view.shake, (Math.random() - 0.5) * view.shake);
    }

    drawBackground(sceneKey);

    if (state) {
      drawBay(state.bay, state);
      for (const o of state.obstacles) drawObstacle(o);
      for (const m of state.moving) drawDrone(m);
      state.orbs.forEach(drawOrb);
      state.shields.forEach(drawShield);
      drawFx();
      drawCar(state.car, true);
    }

    if (view.shake > 0) ctx.restore();

    // 车头方向提示（玩家车上的小箭头由车体本身表达，无需额外）
  }

  function debugLayout(state) {
    if (!state) return null;
    return { bay: { x: state.bay.x, y: state.bay.y, w: state.bay.w, h: state.bay.h } };
  }

  return { draw, burst, debugLayout, reduced };
}
