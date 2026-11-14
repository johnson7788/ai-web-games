// Canvas 2D 渲染：旅客头像 + 护照/登机牌证件 + 行李 X 光 + 审批印章/反馈。
import { WORLD, PASSPORT, BOARDING, XRAY, COLORS, TODAY } from '../../config/game.config.js';
import { ITEMS } from '../../config/data.js';

const FONT = '"PingFang SC","Hiragino Sans GB","Microsoft YaHei","Segoe UI",sans-serif';
const itemById = Object.fromEntries(ITEMS.map((i) => [i.id, i]));

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

function face(ctx, x, y, r, seed) {
  let s = seed >>> 0;
  const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  const skins = ['#f1c27d', '#e0ac69', '#c68642', '#8d5524', '#ffdbac'];
  const hairs = ['#2b2b2b', '#5a3a1f', '#8a6a3a', '#1a1a1a', '#7a4a2a'];
  const skin = skins[Math.floor(rnd() * skins.length)];
  const hair = hairs[Math.floor(rnd() * hairs.length)];
  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = hair;
  ctx.beginPath();
  ctx.arc(x, y - r * 0.25, r * 1.02, Math.PI, 2 * Math.PI);
  ctx.fill();
  ctx.fillStyle = '#2b2b2b';
  ctx.beginPath();
  ctx.arc(x - r * 0.35, y + r * 0.05, r * 0.1, 0, Math.PI * 2);
  ctx.arc(x + r * 0.35, y + r * 0.05, r * 0.1, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#2b2b2b';
  ctx.lineWidth = r * 0.08;
  ctx.beginPath();
  ctx.arc(x, y + r * 0.35, r * 0.3, 0.15 * Math.PI, 0.85 * Math.PI);
  ctx.stroke();
}

function itemShape(ctx, item, x, y, s, color) {
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineWidth = s * 0.12;
  ctx.lineCap = 'round';
  switch (item.shape) {
    case 'rect':
      roundRect(ctx, x - s * 0.5, y - s * 0.35, s, s * 0.7, s * 0.1); ctx.fill(); break;
    case 'blob':
      ctx.beginPath(); ctx.ellipse(x, y, s * 0.5, s * 0.38, 0.3, 0, Math.PI * 2); ctx.fill(); break;
    case 'line':
      ctx.beginPath(); ctx.moveTo(x - s * 0.5, y + s * 0.3); ctx.lineTo(x + s * 0.5, y - s * 0.3); ctx.stroke(); break;
    case 'knife':
      ctx.beginPath(); ctx.moveTo(x - s * 0.5, y + s * 0.2); ctx.lineTo(x + s * 0.3, y - s * 0.2);
      ctx.lineTo(x + s * 0.5, y - s * 0.1); ctx.lineTo(x - s * 0.3, y + s * 0.35); ctx.closePath(); ctx.fill(); break;
    case 'gun':
      roundRect(ctx, x - s * 0.5, y - s * 0.2, s * 0.9, s * 0.3, s * 0.06); ctx.fill();
      ctx.fillRect(x - s * 0.3, y, s * 0.2, s * 0.4); break;
    case 'bottle':
      roundRect(ctx, x - s * 0.2, y - s * 0.4, s * 0.4, s * 0.8, s * 0.1); ctx.fill();
      ctx.fillRect(x - s * 0.1, y - s * 0.55, s * 0.2, s * 0.2); break;
    default:
      ctx.beginPath(); ctx.arc(x, y, s * 0.4, 0, Math.PI * 2); ctx.fill();
  }
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  canvas.width = WORLD.WIDTH;
  canvas.height = WORLD.HEIGHT;
  let stampFx = null;
  let flashFx = null;

  function stamp(text, color) { stampFx = { text, color, t: 0, life: 0.9 }; }
  function flash(color) { flashFx = { color, t: 0, life: 0.4 }; }
  function update(dt) {
    if (stampFx) { stampFx.t += dt; if (stampFx.t >= stampFx.life) stampFx = null; }
    if (flashFx) { flashFx.t += dt; if (flashFx.t >= flashFx.life) flashFx = null; }
  }

  function drawBackground() {
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
    const g = ctx.createRadialGradient(640, 200, 60, 640, 360, 900);
    g.addColorStop(0, COLORS.bgGlow);
    g.addColorStop(1, COLORS.bg);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
  }

  function card(x, y, w, h, title, accent) {
    ctx.fillStyle = COLORS.paper;
    roundRect(ctx, x, y, w, h, 14);
    ctx.fill();
    ctx.strokeStyle = COLORS.paperEdge;
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = accent;
    roundRect(ctx, x, y, w, 40, 14);
    ctx.fill();
    ctx.fillRect(x, y + 20, w, 20);
    ctx.fillStyle = '#fff';
    ctx.font = `800 18px ${FONT}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(title, x + 16, y + 21);
  }

  function field(label, value, x, y, danger) {
    ctx.fillStyle = '#8a7a55';
    ctx.font = `700 13px ${FONT}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(label.toUpperCase(), x, y);
    ctx.fillStyle = danger ? COLORS.danger : COLORS.ink;
    ctx.font = `800 21px ${FONT}`;
    ctx.fillText(value, x, y + 24);
  }

  function drawHeader(run, view) {
    face(ctx, 110, 108, 42, run.passenger.photoSeed);
    ctx.fillStyle = COLORS.ink;
    ctx.font = `800 26px ${FONT}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#eef2ff';
    ctx.fillText(run.passenger.name, 172, 98);
    ctx.fillStyle = 'rgba(238,242,255,0.6)';
    ctx.font = `600 16px ${FONT}`;
    ctx.fillText(`${view.passengerLabel} ${run.processed + 1}/${view.shiftSize} · ${run.passenger.boarding.flight}`, 172, 126);
  }

  function drawPassport(run, L) {
    const { X, Y, W, H } = PASSPORT;
    card(X, Y, W, H, L.passport, '#1e40af');
    // 照片
    ctx.fillStyle = '#dde6f0';
    roundRect(ctx, X + 18, Y + 58, 100, 120, 8);
    ctx.fill();
    face(ctx, X + 68, Y + 118, 42, run.passenger.photoSeed);
    // 字段
    const fx = X + 138;
    field(L.name, run.passenger.passport.name, fx, Y + 78);
    field(L.expiry, run.passenger.passport.expiry, fx, Y + 138);
    field(L.country, run.passenger.passport.country, fx, Y + 198);
    ctx.fillStyle = '#8a7a55';
    ctx.font = `600 13px ${FONT}`;
    ctx.fillText(`${L.today}: ${TODAY}`, X + 18, Y + H - 18);
  }

  function drawBoarding(run, L) {
    const { X, Y, W, H } = BOARDING;
    card(X, Y, W, H, L.boarding, '#0f766e');
    const fx = X + 24;
    field(L.name, run.passenger.boarding.name, fx, Y + 80);
    field(L.flight, run.passenger.boarding.flight, fx, Y + 140);
    field(L.dest, run.passenger.boarding.dest, fx, Y + 200);
    // 条码
    ctx.fillStyle = COLORS.ink;
    let s = run.passenger.photoSeed;
    for (let i = 0; i < 40; i += 1) {
      s = (s * 1103515245 + 12345) & 0x7fffffff;
      const w = 2 + (s % 4);
      ctx.fillRect(X + 24 + i * 7.5, Y + H - 46, w, 28);
    }
  }

  function drawXray(run, L) {
    const { X, Y, W, H } = XRAY;
    ctx.fillStyle = COLORS.xrayBg;
    roundRect(ctx, X, Y, W, H, 14);
    ctx.fill();
    ctx.strokeStyle = COLORS.panelEdge;
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = COLORS.accent;
    roundRect(ctx, X, Y, W, 40, 14);
    ctx.fill();
    ctx.fillRect(X, Y + 20, W, 20);
    ctx.fillStyle = '#04121f';
    ctx.font = `800 18px ${FONT}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(L.xray, X + 16, Y + 21);
    // 行李框
    ctx.strokeStyle = 'rgba(96,165,250,0.4)';
    ctx.lineWidth = 2;
    roundRect(ctx, X + 20, Y + 56, W - 40, H - 76, 10);
    ctx.stroke();
    // 物品
    const items = run.passenger.luggage.items;
    const cols = 3;
    items.forEach((id, i) => {
      const item = itemById[id];
      const col = i % cols;
      const row = Math.floor(i / cols);
      const ix = X + 70 + col * 110;
      const iy = Y + 110 + row * 90;
      const color = item.contraband ? COLORS.xrayContraband : COLORS.xrayItem;
      itemShape(ctx, item, ix, iy, 60, color);
    });
  }

  function drawEffects() {
    if (flashFx) {
      ctx.fillStyle = flashFx.color;
      ctx.globalAlpha = 0.22 * (1 - flashFx.t / flashFx.life);
      ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
      ctx.globalAlpha = 1;
    }
    if (stampFx) {
      const k = stampFx.t / stampFx.life;
      const scale = k < 0.2 ? 1.6 - 3 * k : 1;
      ctx.save();
      ctx.translate(640, 560);
      ctx.rotate(-0.12);
      ctx.scale(scale, scale);
      ctx.globalAlpha = k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3;
      ctx.strokeStyle = stampFx.color;
      ctx.lineWidth = 6;
      roundRect(ctx, -180, -46, 360, 92, 12);
      ctx.stroke();
      ctx.fillStyle = stampFx.color;
      ctx.font = `900 52px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(stampFx.text, 0, 2);
      ctx.restore();
      ctx.globalAlpha = 1;
    }
  }

  function render(view) {
    const { run, labels } = view;
    drawBackground();
    if (run) {
      drawHeader(run, view);
      drawPassport(run, labels);
      drawBoarding(run, labels);
      drawXray(run, labels);
    }
    drawEffects();
  }

  function clearEffects() { stampFx = null; flashFx = null; }

  return { render, update, stamp, flash, clearEffects };
}