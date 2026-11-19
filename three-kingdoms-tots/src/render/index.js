// Three Kingdoms Tots · Canvas 2D 渲染：场景 / 兵线 / 主城 / 箭塔 / 小将 / 法术特效。
// 只消费 run.state（契约）+ view（fxQueue/shake/hover/cursor）。
// 像素换算全部在此完成（sim 只给 lane / x，x 为世界坐标 0..1280）。
// 契约 API：createRenderer(canvas) → { draw(state, dt, view), debugLayout(), resize(w,h) }。
import { WORLD, LAYOUT } from '../../config/game.config.js';
import { CARD_MAP } from '../../config/levels.js';

const SCENES = {
  dawn: { skyTop: '#FFE2B0', skyMid: '#F2B36B', skyBot: '#D98A4A', ground: '#E0B877', groundDark: '#C89A5C', lane: 'rgba(0,0,0,0.08)', stars: false },
  dusk: { skyTop: '#B64B5E', skyMid: '#8A3A55', skyBot: '#4A2A4A', ground: '#9A5A48', groundDark: '#7A3A40', lane: 'rgba(0,0,0,0.12)', stars: false },
  night: { skyTop: '#0C2B3A', skyMid: '#12364A', skyBot: '#0A2230', ground: '#1B4A50', groundDark: '#123A40', lane: 'rgba(0,0,0,0.16)', stars: true },
};

const PLAYER_TINT = '#E8403A';
const ENEMY_TINT = '#3A6FD8';

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

let bgCache = null;
let bgKey = null;
function getBackground(sceneKey) {
  if (bgCache && bgKey === sceneKey) return bgCache;
  const c = document.createElement('canvas');
  c.width = WORLD.WIDTH;
  c.height = WORLD.HEIGHT;
  drawBackground(c.getContext('2d'), SCENES[sceneKey] || SCENES.dawn);
  bgCache = c;
  bgKey = sceneKey;
  return c;
}

function drawBackground(g, P) {
  const W = WORLD.WIDTH, H = WORLD.HEIGHT;
  const sky = g.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, P.skyTop);
  sky.addColorStop(0.55, P.skyMid);
  sky.addColorStop(1, P.skyBot);
  g.fillStyle = sky;
  g.fillRect(0, 0, W, H);

  if (P.stars) {
    for (let i = 0; i < 70; i += 1) {
      const x = (i * 137.5) % W;
      const y = (i * 89.7) % (H * 0.5);
      g.fillStyle = `rgba(220,240,255,${0.25 + (i % 5) * 0.12})`;
      g.beginPath();
      g.arc(x, y, 0.6 + (i % 3) * 0.7, 0, Math.PI * 2);
      g.fill();
    }
  } else {
    const gx = P === SCENES.dusk ? W - 220 : 200;
    const gy = 150;
    const halo = g.createRadialGradient(gx, gy, 20, gx, gy, 320);
    halo.addColorStop(0, 'rgba(255,230,150,0.5)');
    halo.addColorStop(1, 'rgba(255,230,150,0)');
    g.fillStyle = halo;
    g.fillRect(0, 0, W, H);
  }

  // 远山剪影
  g.fillStyle = P.groundDark;
  g.beginPath();
  g.moveTo(0, LAYOUT.FIELD_BOT);
  for (let i = 0; i <= 8; i += 1) {
    const x = (W / 8) * i;
    g.lineTo(x, LAYOUT.FIELD_TOP + 120 - Math.sin(i * 1.6 + 1) * 46);
  }
  g.lineTo(W, LAYOUT.FIELD_BOT);
  g.closePath();
  g.fill();

  // 地面
  const grd = g.createLinearGradient(0, LAYOUT.FIELD_TOP, 0, LAYOUT.FIELD_BOT);
  grd.addColorStop(0, P.ground);
  grd.addColorStop(1, P.groundDark);
  g.fillStyle = grd;
  g.fillRect(0, LAYOUT.FIELD_TOP, W, LAYOUT.FIELD_BOT - LAYOUT.FIELD_TOP);

  // 中线
  g.strokeStyle = 'rgba(255,255,255,0.30)';
  g.lineWidth = 3;
  g.setLineDash([10, 12]);
  g.beginPath();
  g.moveTo(W / 2, LAYOUT.FIELD_TOP + 6);
  g.lineTo(W / 2, LAYOUT.FIELD_BOT - 6);
  g.stroke();
  g.setLineDash([]);
}

function laneY(lane) {
  return LAYOUT.LANE_Y[Math.max(0, Math.min(1, lane | 0))];
}

// ---- 小将绘制（统一 chibi，按卡种类区分武器/体型）----
function drawTot(ctx, x, y, e, clock, opts = {}) {
  const card = CARD_MAP[e.cardId] || {};
  const color = card.color || '#E8703A';
  const tint = e.side === 'player' ? PLAYER_TINT : ENEMY_TINT;
  const face = e.side === 'player' ? 1 : -1;
  const s = opts.scale || 1;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s * face, s);

  // 阴影
  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.beginPath();
  ctx.ellipse(0, 16, 16, 5, 0, 0, Math.PI * 2);
  ctx.fill();

  if (card.kind === 'machine') {
    // 投石车
    ctx.fillStyle = color;
    rr(ctx, -16, -2, 32, 14, 4); ctx.fill();
    ctx.fillStyle = '#4A3A2A';
    ctx.beginPath(); ctx.arc(-10, 4, 7, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(10, 4, 7, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#3A2A1A';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(0, -2); ctx.lineTo(6 + Math.sin(clock * 3) * 4, -14); ctx.stroke();
    ctx.fillStyle = '#D9C46A';
    ctx.beginPath(); ctx.arc(6 + Math.sin(clock * 3) * 4, -16, 5, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    return;
  }
  if (card.kind === 'building') {
    // 岩石壁垒
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(-16, 14); ctx.lineTo(-13, -10); ctx.lineTo(-4, -16); ctx.lineTo(6, -12); ctx.lineTo(14, -4); ctx.lineTo(16, 14);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.beginPath(); ctx.moveTo(-13, -10); ctx.lineTo(-4, -16); ctx.lineTo(6, -12); ctx.closePath(); ctx.fill();
    ctx.restore();
    return;
  }

  // 身体
  ctx.fillStyle = color;
  rr(ctx, -11, 0, 22, 16, 7); ctx.fill();
  // 腿（骑兵画马）
  if (card.kind === 'cavalry') {
    ctx.fillStyle = '#8A5A38';
    rr(ctx, -16, 10, 32, 10, 5); ctx.fill();
    ctx.fillStyle = '#6A4028';
    ctx.beginPath(); ctx.arc(-12, 20, 4, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(12, 20, 4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = color;
    rr(ctx, -11, -6, 22, 16, 7); ctx.fill();
  }
  // 头 + 头盔
  ctx.fillStyle = '#F5E0C0';
  ctx.beginPath(); ctx.arc(0, -12, 11, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = tint;
  ctx.beginPath(); ctx.arc(0, -15, 12, Math.PI, 0); ctx.fill();
  if (card.kind === 'general') {
    ctx.fillStyle = '#FFD84E';
    ctx.beginPath(); ctx.moveTo(0, -27); ctx.lineTo(-4, -16); ctx.lineTo(4, -16); ctx.closePath(); ctx.fill();
  }
  // 眼睛
  ctx.fillStyle = '#2A1A0C';
  ctx.beginPath(); ctx.arc(4, -12, 1.8, 0, Math.PI * 2); ctx.fill();

  // 武器
  if (card.kind === 'ranged') {
    ctx.strokeStyle = '#C96A2E';
    ctx.lineWidth = 2.5;
    ctx.beginPath(); ctx.arc(2, -6, 10, -1.3, 1.3); ctx.stroke();
    ctx.strokeStyle = '#F5E6D0';
    ctx.beginPath(); ctx.moveTo(2, -16); ctx.lineTo(2, 4); ctx.stroke();
  } else if (card.kind === 'general' || card.kind === 'cavalry') {
    ctx.strokeStyle = '#E8E8E8';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(12, 0); ctx.lineTo(22, -16); ctx.stroke();
    ctx.fillStyle = '#8A5A38';
    rr(ctx, 8, -2, 5, 14, 2); ctx.fill();
  } else {
    // 刀盾
    ctx.fillStyle = '#B0603A';
    ctx.beginPath(); ctx.arc(11, -4, 7, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#F5E6D0';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(11, -4, 7, 0, Math.PI * 2); ctx.stroke();
  }

  // 队伍色底环
  ctx.strokeStyle = tint;
  ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.ellipse(0, 17, 16, 5, 0, 0, Math.PI * 2); ctx.stroke();
  ctx.restore();
}

function drawKeep(ctx, x, y, side, hp, maxHp) {
  const tint = side === 'player' ? PLAYER_TINT : ENEMY_TINT;
  ctx.save();
  ctx.translate(x, y);
  const dir = side === 'player' ? 1 : -1;
  ctx.scale(dir, 1);
  // 城体
  ctx.fillStyle = '#8A7A6A';
  rr(ctx, -30, -46, 60, 92, 8); ctx.fill();
  ctx.fillStyle = '#6E5E50';
  rr(ctx, -24, -40, 48, 80, 6); ctx.fill();
  // 城垛
  ctx.fillStyle = '#9A8A78';
  for (let i = 0; i < 4; i += 1) {
    rr(ctx, -28 + i * 16, -54, 10, 14, 2); ctx.fill();
  }
  // 门
  ctx.fillStyle = '#3A2E22';
  ctx.beginPath(); ctx.arc(0, 24, 12, Math.PI, 0); ctx.fill();
  // 旗帜
  ctx.strokeStyle = '#5A4A3A';
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(0, -54); ctx.lineTo(0, -76); ctx.stroke();
  ctx.fillStyle = tint;
  ctx.beginPath(); ctx.moveTo(0, -76); ctx.lineTo(24, -69); ctx.lineTo(0, -62); ctx.closePath(); ctx.fill();
  ctx.restore();
  drawBar(ctx, x, y - 86, 64, hp, maxHp, tint);
}

function drawTower(ctx, x, y, side, hp, maxHp) {
  const tint = side === 'player' ? PLAYER_TINT : ENEMY_TINT;
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = '#7A6E5E';
  ctx.beginPath();
  ctx.moveTo(-14, 30); ctx.lineTo(-12, -18); ctx.lineTo(12, -18); ctx.lineTo(14, 30);
  ctx.closePath(); ctx.fill();
  ctx.fillStyle = tint;
  for (let i = 0; i < 3; i += 1) {
    rr(ctx, -10 + i * 8, -24, 6, 9, 2); ctx.fill();
  }
  // 队伍色旗帜（敌我剪影区分）
  ctx.strokeStyle = '#5A4A3A';
  ctx.lineWidth = 2.5;
  ctx.beginPath(); ctx.moveTo(0, -24); ctx.lineTo(0, -40); ctx.stroke();
  ctx.fillStyle = tint;
  ctx.beginPath(); ctx.moveTo(0, -40); ctx.lineTo(15, -35); ctx.lineTo(0, -30); ctx.closePath(); ctx.fill();
  // 箭口
  ctx.fillStyle = '#2A2218';
  ctx.beginPath(); ctx.arc(0, 4, 5, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
  drawBar(ctx, x, y - 34, 44, hp, maxHp, tint);
}

function drawBar(ctx, x, y, w, hp, maxHp, tint) {
  const ratio = Math.max(0, Math.min(1, maxHp > 0 ? hp / maxHp : 0));
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  rr(ctx, x - w / 2 - 1, y - 1, w + 2, 7, 3); ctx.fill();
  ctx.fillStyle = ratio > 0.4 ? '#7FD86A' : ratio > 0.2 ? '#FFD84E' : '#E0535A';
  if (ratio > 0) { rr(ctx, x - w / 2, y, w * ratio, 5, 2.5); ctx.fill(); }
  ctx.strokeStyle = tint;
  ctx.lineWidth = 1;
  rr(ctx, x - w / 2 - 1, y - 1, w + 2, 7, 3); ctx.stroke();
}

function drawUnit(ctx, e, clock) {
  const y = laneY(e.lane);
  drawTot(ctx, e.x, y, e, clock);
  drawBar(ctx, e.x, y - 26, 30, e.hp, e.maxHp, e.side === 'player' ? PLAYER_TINT : ENEMY_TINT);
}

function drawFx(ctx, fx) {
  const a = Math.max(0, fx.ttl / 0.5);
  const y = fx.lane != null ? laneY(fx.lane) : 380;
  if (fx.type === 'fire') {
    const r = (1 - a) * 60 + 30;
    ctx.fillStyle = `rgba(240,96,48,${0.5 * a})`;
    ctx.beginPath(); ctx.arc(fx.x, y, r, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = `rgba(255,216,78,${0.7 * a})`;
    ctx.beginPath(); ctx.arc(fx.x, y, r * 0.5, 0, Math.PI * 2); ctx.fill();
  } else if (fx.type === 'frost') {
    const r = (1 - a) * 60 + 26;
    ctx.strokeStyle = `rgba(120,210,240,${0.8 * a})`;
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.arc(fx.x, y, r, 0, Math.PI * 2); ctx.stroke();
  } else if (fx.type === 'heal') {
    const r = (1 - a) * 40 + 20;
    ctx.strokeStyle = `rgba(120,230,150,${0.8 * a})`;
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(fx.x, y, r, 0, Math.PI * 2); ctx.stroke();
  } else if (fx.type === 'spawn') {
    ctx.strokeStyle = `rgba(255,255,255,${0.8 * a})`;
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(fx.x, y, 26, 0, Math.PI * 2); ctx.stroke();
  } else if (fx.type === 'rock') {
    ctx.fillStyle = `rgba(120,132,150,${0.5 * a})`;
    rr(ctx, fx.x - 18, y - 18, 36, 36, 6); ctx.fill();
  }
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  canvas.width = WORLD.WIDTH;
  canvas.height = WORLD.HEIGHT;

  let clock = 0;
  let lastState = null;

  function resize(w, h) {
    return { w, h, world: { width: WORLD.WIDTH, height: WORLD.HEIGHT } };
  }

  function debugLayout() {
    return {
      field: { x: 0, y: LAYOUT.FIELD_TOP, w: WORLD.WIDTH, h: LAYOUT.FIELD_BOT - LAYOUT.FIELD_TOP },
      hand: { x: 0, y: LAYOUT.FIELD_BOT, w: WORLD.WIDTH, h: WORLD.HEIGHT - LAYOUT.FIELD_BOT },
      hud: { x: 0, y: 0, w: WORLD.WIDTH, h: LAYOUT.HUD_H },
      playerKeep: { x: LAYOUT.KEEP_PLAYER_X - 40, y: 340, w: 90, h: 120 },
      enemyKeep: { x: LAYOUT.KEEP_ENEMY_X - 40, y: 340, w: 90, h: 120 },
    };
  }

  function drawTitleScene() {
    ctx.clearRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
    ctx.drawImage(getBackground('dawn'), 0, 0);
    // 标题背景：一场对战的缩影——我方主城（左）vs 敌方主城（右，目标）
    drawKeep(ctx, 90, 300, 'player', 1, 1);
    drawKeep(ctx, 1190, 300, 'enemy', 1, 1);
    drawTot(ctx, 470, 340, { side: 'player', cardId: 'general', lane: 0, hp: 1, maxHp: 1 }, clock, { scale: 2.2 });
    drawTot(ctx, 700, 340, { side: 'player', cardId: 'cavalry', lane: 1, hp: 1, maxHp: 1 }, clock, { scale: 2.0 });
    drawTot(ctx, 850, 340, { side: 'enemy', cardId: 'general', lane: 0, hp: 1, maxHp: 1 }, clock, { scale: 2.2 });
    drawTot(ctx, 620, 340, { side: 'enemy', cardId: 'archer', lane: 1, hp: 1, maxHp: 1 }, clock, { scale: 2.0 });
  }

  function draw(state, dt, view) {
    if (!state || !state.player) { drawTitleScene(); return; }
    const v = view || {};
    clock += dt || 0;
    lastState = state;
    const sceneKey = (state.level === 3 ? 'night' : state.level === 2 ? 'dusk' : 'dawn');

    ctx.clearRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
    ctx.save();
    if (v.shake && v.shake > 0) {
      ctx.translate((Math.random() * 2 - 1) * v.shake, (Math.random() * 2 - 1) * v.shake);
    }
    ctx.drawImage(getBackground(sceneKey), 0, 0);

    // 主城
    const pk = state.player.keep;
    const ek = state.enemy.keep;
    drawKeep(ctx, pk.x, 380, 'player', pk.hp, pk.maxHp);
    drawKeep(ctx, ek.x, 380, 'enemy', ek.hp, ek.maxHp);

    // 箭塔
    for (const t of state.player.towers) if (t.hp > 0) drawTower(ctx, t.x, laneY(t.lane), 'player', t.hp, t.maxHp);
    for (const t of state.enemy.towers) if (t.hp > 0) drawTower(ctx, t.x, laneY(t.lane), 'enemy', t.hp, t.maxHp);

    // 单位（敌方先画，我方后画更醒目）
    for (const u of state.enemy.units) if (u.hp > 0) drawUnit(ctx, u, clock);
    for (const u of state.player.units) if (u.hp > 0) drawUnit(ctx, u, clock);

    // 法术特效
    if (v.fxQueue) {
      for (const fx of v.fxQueue) drawFx(ctx, fx);
    }

    // hover 出兵点
    if (v.hoverLane != null && state.phase === 'playing') {
      ctx.strokeStyle = 'rgba(255,216,120,0.9)';
      ctx.lineWidth = 3;
      const x = LAYOUT.PLAYER_SPAWN_X, y = laneY(v.hoverLane);
      ctx.beginPath(); ctx.arc(x, y, 26, 0, Math.PI * 2); ctx.stroke();
    }

    ctx.restore();
  }

  if (typeof window !== 'undefined') {
    window.__drawTitle = () => drawTitleScene();
  }

  return { draw, debugLayout, resize };
}
