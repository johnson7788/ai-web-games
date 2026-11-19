// Canvas 2D 渲染：霓虹街机风程序化交通场景（零素材零外链）。
// 只画「场景图」；题干/按钮/分数等文字走 DOM（避免 canvas 豆腐块）。
// 布局约定：顶部 HUD 56px，底部控制台 deck 470px 起，中间 56–470 是场景区。
import { WORLD } from '../../config/game.config.js';

const C = {
  sky: '#0b1026',
  skyHi: '#1a1f4e',
  road: '#14152b',
  roadEdge: '#2a2c4a',
  lane: '#ffd166',
  sidewalk: '#23264a',
  neon: '#22d3ee',
  magenta: '#ff2fd6',
  green: '#3dff8b',
  red: '#ff3355',
  amber: '#ffb020',
  white: '#f4f7ff',
  dark: '#0a0c1c',
};

const ROAD_TOP = 252;
const ROAD_BOT = 470;
const LANE_Y = 361;
const SIDEWALK_TOP = 210;

function rr(ctx, x, y, w, h, r) {
  const rad = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
}

function glow(ctx, color, blur = 18) {
  ctx.shadowColor = color;
  ctx.shadowBlur = blur;
}
function noGlow(ctx) {
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
}

function skyline(ctx, t) {
  const grad = ctx.createLinearGradient(0, 0, 0, WORLD.HEIGHT);
  grad.addColorStop(0, C.skyHi);
  grad.addColorStop(1, C.sky);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
  const seed = 7;
  for (let i = 0; i < 60; i += 1) {
    const x = (i * 137 + seed) % WORLD.WIDTH;
    const y = (i * 89 + seed * 3) % 190;
    const tw = 0.5 + 0.5 * Math.sin(t / 500 + i);
    ctx.fillStyle = `rgba(160,200,255,${0.2 + 0.5 * tw})`;
    ctx.fillRect(x, y, 2, 2);
  }
  ctx.fillStyle = '#111432';
  for (let x = 0; x < WORLD.WIDTH; x += 70) {
    const h = 40 + ((x * 31) % 90);
    ctx.fillRect(x, 200 - h, 54, h);
  }
}

function road(ctx) {
  ctx.fillStyle = C.road;
  ctx.fillRect(0, ROAD_TOP, WORLD.WIDTH, ROAD_BOT - ROAD_TOP);
  ctx.fillStyle = C.roadEdge;
  ctx.fillRect(0, ROAD_TOP - 4, WORLD.WIDTH, 5);
  ctx.fillRect(0, ROAD_BOT - 2, WORLD.WIDTH, 4);
  ctx.strokeStyle = C.lane;
  ctx.lineWidth = 7;
  ctx.setLineDash([34, 28]);
  ctx.beginPath();
  ctx.moveTo(0, LANE_Y);
  ctx.lineTo(WORLD.WIDTH, LANE_Y);
  ctx.stroke();
  ctx.setLineDash([]);
}

function sidewalkStrip(ctx) {
  ctx.fillStyle = C.sidewalk;
  ctx.fillRect(0, SIDEWALK_TOP, WORLD.WIDTH, ROAD_TOP - SIDEWALK_TOP);
  ctx.fillStyle = C.neon;
  ctx.fillRect(0, ROAD_TOP - 3, WORLD.WIDTH, 2);
  ctx.strokeStyle = 'rgba(120,130,180,0.25)';
  ctx.lineWidth = 1;
  for (let x = 0; x < WORLD.WIDTH; x += 64) {
    ctx.beginPath();
    ctx.moveTo(x, SIDEWALK_TOP);
    ctx.lineTo(x, ROAD_TOP);
    ctx.stroke();
  }
}

function crosswalk(ctx, x, w = 260) {
  ctx.fillStyle = C.white;
  const stripes = 7;
  const sw = w / stripes;
  for (let i = 0; i < stripes; i += 1) {
    const sx = x + i * sw;
    ctx.fillRect(sx + 5, LANE_Y - 13, sw - 10, 26);
  }
}

function trafficLight(ctx, x, baseY, active) {
  ctx.fillStyle = '#1c1f36';
  ctx.fillRect(x - 5, baseY - 40, 10, 60);
  ctx.fillStyle = '#0d0f1e';
  rr(ctx, x - 26, baseY - 96, 52, 100, 12);
  ctx.fill();
  const lights = [
    { c: 'red', on: active === 'red', cy: baseY - 76 },
    { c: 'amber', on: active === 'amber', cy: baseY - 46 },
    { c: 'green', on: active === 'green', cy: baseY - 16 },
  ];
  for (const L of lights) {
    const col = L.c === 'red' ? C.red : L.c === 'amber' ? C.amber : C.green;
    ctx.fillStyle = L.on ? col : 'rgba(255,255,255,0.06)';
    if (L.on) glow(ctx, col, 22);
    ctx.beginPath();
    ctx.arc(x, L.cy, 13, 0, Math.PI * 2);
    ctx.fill();
    noGlow(ctx);
  }
}

function person(ctx, x, y, s = 1, opts = {}) {
  const { color = C.white, run = false, arms = 'down' } = opts;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(0, -62, 15, 0, Math.PI * 2);
  ctx.fill();
  rr(ctx, -13, -44, 26, 34, 8);
  ctx.fill();
  ctx.strokeStyle = color;
  ctx.lineWidth = 9;
  ctx.lineCap = 'round';
  const spread = run ? 16 : 6;
  ctx.beginPath();
  ctx.moveTo(-7, -10);
  ctx.lineTo(-7 - spread, 14);
  ctx.moveTo(7, -10);
  ctx.lineTo(7 + spread, 14);
  ctx.stroke();
  ctx.lineWidth = 7;
  if (arms === 'up') {
    ctx.beginPath();
    ctx.moveTo(-13, -38); ctx.lineTo(-30, -60);
    ctx.moveTo(13, -38); ctx.lineTo(30, -60);
    ctx.stroke();
  } else if (arms === 'side') {
    ctx.beginPath();
    ctx.moveTo(-13, -38); ctx.lineTo(-34, -26);
    ctx.moveTo(13, -38); ctx.lineTo(34, -26);
    ctx.stroke();
  } else {
    ctx.beginPath();
    ctx.moveTo(-13, -38); ctx.lineTo(-20, -8);
    ctx.moveTo(13, -38); ctx.lineTo(20, -8);
    ctx.stroke();
  }
  ctx.restore();
}

function car(ctx, x, y, s = 1, color = C.neon) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.fillStyle = color;
  rr(ctx, -70, -34, 140, 56, 16);
  ctx.fill();
  rr(ctx, -40, -54, 70, 30, 12);
  ctx.fill();
  ctx.fillStyle = '#0b1030';
  rr(ctx, -34, -48, 26, 20, 4); ctx.fill();
  rr(ctx, -2, -48, 26, 20, 4); ctx.fill();
  ctx.fillStyle = C.dark;
  ctx.beginPath(); ctx.arc(-44, 24, 12, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(44, 24, 12, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = C.amber;
  ctx.fillRect(-70, -20, 8, 12);
  ctx.fillRect(62, -20, 8, 12);
  ctx.restore();
}

function bus(ctx, x, y, s = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.fillStyle = '#ffb020';
  rr(ctx, -110, -60, 220, 96, 12);
  ctx.fill();
  ctx.fillStyle = '#0b1030';
  for (let i = 0; i < 4; i += 1) {
    rr(ctx, -96 + i * 48, -50, 36, 26, 4); ctx.fill();
  }
  ctx.fillStyle = C.dark;
  ctx.beginPath(); ctx.arc(-70, 38, 14, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(70, 38, 14, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function skateboard(ctx, x, y, s = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.fillStyle = C.magenta;
  rr(ctx, -36, -8, 72, 16, 8);
  ctx.fill();
  ctx.fillStyle = C.dark;
  ctx.beginPath(); ctx.arc(-22, 10, 7, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(22, 10, 7, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function guardrail(ctx, x, y, w) {
  ctx.strokeStyle = '#e8ecff';
  ctx.lineWidth = 6;
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + w, y);
  ctx.stroke();
  for (let px = x; px <= x + w; px += 46) {
    ctx.fillStyle = '#3a3f66';
    ctx.fillRect(px - 4, y, 8, 40);
  }
  ctx.strokeStyle = '#5a6090';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(x, y + 26);
  ctx.lineTo(x + w, y + 26);
  ctx.stroke();
}

// ---------- 各场景（元素都在 56–470 场景区内） ----------
const ON_ROAD = 428;      // 车行道内人物脚底 y
const ON_WALK = 236;      // 人行道上人物脚底 y
const CAR_Y = 350;        // 车道内车体中心 y

const SCENES = {
  jaywalk(ctx) {
    road(ctx); sidewalkStrip(ctx);
    crosswalk(ctx, 900, 220);
    trafficLight(ctx, 880, ROAD_TOP, 'red');
    car(ctx, 300, CAR_Y - 40, 1.0, C.red);
    person(ctx, 620, ON_ROAD, 1, { color: C.white, run: true, arms: 'side' });
  },
  sidewalk(ctx) {
    road(ctx); sidewalkStrip(ctx);
    car(ctx, 900, CAR_Y - 40, 1, C.green);
    person(ctx, 300, ON_WALK, 1, { color: C.white });
  },
  skateboard(ctx) {
    road(ctx); sidewalkStrip(ctx);
    car(ctx, 940, CAR_Y + 40, 0.9, C.neon);
    person(ctx, 460, ON_ROAD - 26, 0.9, { color: C.magenta, arms: 'side' });
    skateboard(ctx, 460, ON_ROAD - 4, 1);
  },
  crosswalk(ctx) {
    road(ctx); sidewalkStrip(ctx);
    crosswalk(ctx, 480, 280);
    car(ctx, 180, CAR_Y + 40, 1, C.neon);
    car(ctx, 980, CAR_Y - 40, 0.9, C.amber);
    person(ctx, 620, ON_ROAD, 1, { color: C.white });
  },
  guardrail(ctx) {
    road(ctx); sidewalkStrip(ctx);
    guardrail(ctx, 400, ROAD_TOP - 10, 420);
    car(ctx, 220, CAR_Y + 40, 1, C.neon);
    person(ctx, 700, ROAD_TOP - 46, 0.95, { color: C.amber, arms: 'up' });
  },
  lookBoth(ctx) {
    road(ctx); sidewalkStrip(ctx);
    crosswalk(ctx, 500, 260);
    car(ctx, 900, CAR_Y - 40, 0.95, C.red);
    person(ctx, 640, ON_WALK + 14, 1, { color: C.white, arms: 'side' });
    ctx.fillStyle = C.green;
    glow(ctx, C.green, 14);
    ctx.font = 'bold 28px sans-serif';
    ctx.fillText('◀', 566, ROAD_TOP - 24);
    ctx.fillText('▶', 706, ROAD_TOP - 24);
    noGlow(ctx);
  },
  greenCross(ctx) {
    road(ctx); sidewalkStrip(ctx);
    crosswalk(ctx, 480, 280);
    trafficLight(ctx, 880, ROAD_TOP, 'green');
    person(ctx, 620, ON_ROAD, 1, { color: C.green });
  },
  redWait(ctx) {
    road(ctx); sidewalkStrip(ctx);
    crosswalk(ctx, 480, 280);
    trafficLight(ctx, 880, ROAD_TOP, 'red');
    person(ctx, 700, ON_WALK + 8, 1, { color: C.white });
  },
  carChase(ctx) {
    road(ctx); sidewalkStrip(ctx);
    bus(ctx, 860, CAR_Y - 20, 1);
    person(ctx, 560, ON_ROAD, 1, { color: C.red, run: true, arms: 'up' });
  },
  push(ctx) {
    road(ctx); sidewalkStrip(ctx);
    car(ctx, 920, CAR_Y + 40, 0.9, C.amber);
    person(ctx, 420, ON_ROAD, 1, { color: C.red, arms: 'side' });
    person(ctx, 540, ON_ROAD - 26, 0.85, { color: C.white, arms: 'up' });
  },
};

function drawScene(ctx, key, t) {
  skyline(ctx, t);
  const fn = SCENES[key] || SCENES.crosswalk;
  fn(ctx);
}

function titleBackdrop(ctx, t) {
  skyline(ctx, t);
  road(ctx);
  sidewalkStrip(ctx);
  const phase = Math.floor(t / 700) % 3;
  trafficLight(ctx, 640, ROAD_TOP, phase === 0 ? 'green' : phase === 1 ? 'amber' : 'red');
  crosswalk(ctx, 480, 320);
  person(ctx, 620, ON_WALK + 8, 1, { color: C.white });
}

function resultBackdrop(ctx, t) {
  skyline(ctx, t);
  road(ctx);
  trafficLight(ctx, 200, ROAD_TOP, 'green');
  trafficLight(ctx, 1080, ROAD_TOP, 'green');
  crosswalk(ctx, 480, 320);
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  let dpr = 1;
  function resize() {
    dpr = Math.min(2, (typeof window !== 'undefined' && window.devicePixelRatio) || 1);
    canvas.width = WORLD.WIDTH * dpr;
    canvas.height = WORLD.HEIGHT * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  resize();

  return {
    resize,
    render(view) {
      const phase = view.phase || 'title';
      const t = view.timeMs || 0;
      ctx.clearRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
      if (phase === 'title') titleBackdrop(ctx, t);
      else if (phase === 'result') resultBackdrop(ctx, t);
      else if (view.scene) drawScene(ctx, view.scene, t);
      else titleBackdrop(ctx, t);
    },
  };
}
