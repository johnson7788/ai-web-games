// Canvas 2D 渲染：台面（木纹框 + 绒布 + 库边 + 袋口 + 石标）离线预渲染一次，
// 球体分层精灵（底色 / 花带 / 号码 / 高光）缓存复用；每帧只画球、瞄准线与特效。
import {
  AIM,
  BALL,
  BALL_COLORS,
  COLORS,
  FX,
  MID_X,
  MID_Y,
  PLAY,
  POCKETS,
  TABLE,
  WORLD,
} from '../../config/game.config.js';
import { CUE, kindOf } from '../game/balls.js';

const R = BALL.R;
const S = 3; // 精灵超采样倍率
const PAD = 3;
const SPRITE = (R + PAD) * 2 * S;

function rr(ctx, x, y, w, h, r) {
  const rad = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.lineTo(x + w - rad, y);
  ctx.arcTo(x + w, y, x + w, y + rad, rad);
  ctx.lineTo(x + w, y + h - rad);
  ctx.arcTo(x + w, y + h, x + w - rad, y + h, rad);
  ctx.lineTo(x + rad, y + h);
  ctx.arcTo(x, y + h, x, y + h - rad, rad);
  ctx.lineTo(x, y + rad);
  ctx.arcTo(x, y, x + rad, y, rad);
  ctx.closePath();
}

function make(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function lighten(hex, amt) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, ((n >> 16) & 255) + amt);
  const g = Math.min(255, ((n >> 8) & 255) + amt);
  const b = Math.min(255, (n & 255) + amt);
  return `rgb(${r},${g},${b})`;
}

function darken(hex, amt) {
  return lighten(hex, -amt);
}

const OUTER = {
  x: PLAY.left - TABLE.RIBBER - TABLE.WOOD,
  y: PLAY.top - TABLE.RIBBER - TABLE.WOOD,
  w: PLAY.right - PLAY.left + (TABLE.RIBBER + TABLE.WOOD) * 2,
  h: PLAY.bottom - PLAY.top + (TABLE.RIBBER + TABLE.WOOD) * 2,
};

function drawTable() {
  const cv = make(WORLD.WIDTH, WORLD.HEIGHT);
  const ctx = cv.getContext('2d');

  // 房间与灯光
  const room = ctx.createRadialGradient(MID_X, PLAY.top - 60, 120, MID_X, MID_Y, WORLD.WIDTH * 0.8);
  room.addColorStop(0, COLORS.room0);
  room.addColorStop(1, COLORS.room1);
  ctx.fillStyle = room;
  ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
  ctx.save();
  ctx.globalAlpha = 1;
  const lamp = ctx.createRadialGradient(MID_X, MID_Y - 40, 40, MID_X, MID_Y, TABLE.RIBBER + 640);
  lamp.addColorStop(0, COLORS.lamp);
  lamp.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = lamp;
  ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
  ctx.restore();

  // 木框投影
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.65)';
  ctx.shadowBlur = 34;
  ctx.shadowOffsetY = 12;
  const wood = ctx.createLinearGradient(OUTER.x, OUTER.y, OUTER.x, OUTER.y + OUTER.h);
  wood.addColorStop(0, COLORS.wood0);
  wood.addColorStop(0.45, COLORS.wood1);
  wood.addColorStop(1, COLORS.wood2);
  ctx.fillStyle = wood;
  rr(ctx, OUTER.x, OUTER.y, OUTER.w, OUTER.h, TABLE.RADIUS);
  ctx.fill();
  ctx.restore();

  // 木框上沿高光
  ctx.strokeStyle = COLORS.woodEdge;
  ctx.lineWidth = 1.6;
  rr(ctx, OUTER.x + 1.2, OUTER.y + 1.2, OUTER.w - 2.4, OUTER.h - 2.4, TABLE.RADIUS - 1);
  ctx.stroke();
  ctx.strokeStyle = 'rgba(0,0,0,0.5)';
  ctx.lineWidth = 2;
  rr(
    ctx,
    PLAY.left - TABLE.RIBBER - 1,
    PLAY.top - TABLE.RIBBER - 1,
    PLAY.right - PLAY.left + TABLE.RIBBER * 2 + 2,
    PLAY.bottom - PLAY.top + TABLE.RIBBER * 2 + 2,
    12,
  );
  ctx.stroke();

  // 库边（橡胶 + 绒布包边）
  const rib = ctx.createLinearGradient(0, PLAY.top - TABLE.RIBBER, 0, PLAY.bottom + TABLE.RIBBER);
  rib.addColorStop(0, COLORS.ribber0);
  rib.addColorStop(1, COLORS.ribber1);
  ctx.fillStyle = rib;
  rr(
    ctx,
    PLAY.left - TABLE.RIBBER,
    PLAY.top - TABLE.RIBBER,
    PLAY.right - PLAY.left + TABLE.RIBBER * 2,
    PLAY.bottom - PLAY.top + TABLE.RIBBER * 2,
    10,
  );
  ctx.fill();

  // 台面绒布
  const felt = ctx.createRadialGradient(MID_X, MID_Y - 60, 60, MID_X, MID_Y, PLAY.right - PLAY.left);
  felt.addColorStop(0, COLORS.felt0);
  felt.addColorStop(0.62, COLORS.felt1);
  felt.addColorStop(1, darken('#0d4a31', 20));
  ctx.fillStyle = felt;
  ctx.fillRect(PLAY.left, PLAY.top, PLAY.right - PLAY.left, PLAY.bottom - PLAY.top);

  // 库边鼻线高光
  ctx.strokeStyle = COLORS.ribberEdge;
  ctx.lineWidth = 1.2;
  ctx.strokeRect(PLAY.left + 0.5, PLAY.top + 0.5, PLAY.right - PLAY.left - 1, PLAY.bottom - PLAY.top - 1);

  // 开球线 + 置球点
  ctx.strokeStyle = COLORS.feltLine;
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(TABLE.HEAD_X, PLAY.top + 2);
  ctx.lineTo(TABLE.HEAD_X, PLAY.bottom - 2);
  ctx.stroke();
  ctx.fillStyle = COLORS.spot;
  for (const sx of [TABLE.HEAD_X, TABLE.FOOT_X]) {
    ctx.beginPath();
    ctx.arc(sx, MID_Y, TABLE.SPOT_R, 0, Math.PI * 2);
    ctx.fill();
  }

  // 袋口
  for (const p of POCKETS) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(p.x, p.y, TABLE.POCKET_R + 5, 0, Math.PI * 2);
    ctx.fillStyle = COLORS.pocketRim;
    ctx.fill();
    const hole = ctx.createRadialGradient(p.x, p.y - 4, 2, p.x, p.y, TABLE.POCKET_R);
    hole.addColorStop(0, '#000');
    hole.addColorStop(0.7, COLORS.pocket);
    hole.addColorStop(1, '#1b1f26');
    ctx.beginPath();
    ctx.arc(p.x, p.y, TABLE.POCKET_R, 0, Math.PI * 2);
    ctx.fillStyle = hole;
    ctx.fill();
    ctx.strokeStyle = COLORS.pocketSheen;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(p.x, p.y, TABLE.POCKET_R - 1.2, Math.PI * 1.05, Math.PI * 1.85);
    ctx.stroke();
    ctx.restore();
  }

  // 库边钻石头标
  ctx.fillStyle = COLORS.sight;
  const half = (PLAY.right - PLAY.left) / 2 / 4;
  for (const k of TABLE.SIGHT.long) {
    for (const baseX of [PLAY.left + half * k, PLAY.right - half * k]) {
      for (const baseY of [OUTER.y + TABLE.WOOD / 2 + 4, OUTER.y + OUTER.h - TABLE.WOOD / 2 - 4]) {
        diamond(ctx, baseX, baseY, 3.4);
      }
    }
  }
  for (const k of TABLE.SIGHT.short) {
    const off = ((PLAY.bottom - PLAY.top) / 2) * (k / 2);
    for (const baseY of [MID_Y - off, MID_Y + off]) {
      for (const baseX of [OUTER.x + TABLE.WOOD / 2 + 4, OUTER.x + OUTER.w - TABLE.WOOD / 2 - 4]) {
        diamond(ctx, baseX, baseY, 3.4);
      }
    }
  }
  return cv;
}

function diamond(ctx, x, y, r) {
  ctx.beginPath();
  ctx.moveTo(x, y - r);
  ctx.lineTo(x + r * 0.72, y);
  ctx.lineTo(x, y + r);
  ctx.lineTo(x - r * 0.72, y);
  ctx.closePath();
  ctx.fill();
}

function ballBase(id) {
  const cv = make(SPRITE, SPRITE);
  const ctx = cv.getContext('2d');
  const c = SPRITE / 2;
  const r = R * S;
  const kind = id === CUE ? 'cue' : kindOf(id);
  const color = id === CUE ? '#f7f4ea' : BALL_COLORS[id] || '#cccccc';
  const grad = ctx.createRadialGradient(c - r * 0.38, c - r * 0.44, r * 0.12, c, c, r * 1.06);
  const body = kind === 'stripe' ? '#f3efe2' : color;
  grad.addColorStop(0, lighten2(body, 54));
  grad.addColorStop(0.46, body);
  grad.addColorStop(1, darken2(body, 74));
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(c, c, r, 0, Math.PI * 2);
  ctx.fill();
  return cv;
}

function ballBand(id) {
  const cv = make(SPRITE, SPRITE);
  const ctx = cv.getContext('2d');
  const c = SPRITE / 2;
  const r = R * S;
  const color = BALL_COLORS[id] || '#cccccc';
  ctx.save();
  ctx.beginPath();
  ctx.arc(c, c, r, 0, Math.PI * 2);
  ctx.clip();
  const band = ctx.createLinearGradient(0, c - r * 0.62, 0, c + r * 0.62);
  band.addColorStop(0, darken2(color, 16));
  band.addColorStop(0.4, lighten2(color, 26));
  band.addColorStop(1, darken2(color, 26));
  ctx.fillStyle = band;
  ctx.fillRect(0, c - r * 0.62, SPRITE, r * 1.24);
  ctx.restore();
  return cv;
}

function ballBadge(id) {
  const cv = make(SPRITE, SPRITE);
  const ctx = cv.getContext('2d');
  const c = SPRITE / 2;
  const r = R * S;
  ctx.beginPath();
  ctx.arc(c, c, r * 0.46, 0, Math.PI * 2);
  ctx.fillStyle = '#f8f6f0';
  ctx.fill();
  ctx.fillStyle = COLORS.ballText;
  ctx.font = `700 ${Math.round(r * 0.62)}px "Helvetica Neue", Arial, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(String(id), c, c + r * 0.03);
  return cv;
}

function ballGloss() {
  const cv = make(SPRITE, SPRITE);
  const ctx = cv.getContext('2d');
  const c = SPRITE / 2;
  const r = R * S;
  const g = ctx.createRadialGradient(c - r * 0.34, c - r * 0.42, 0, c - r * 0.34, c - r * 0.42, r * 0.62);
  g.addColorStop(0, 'rgba(255,255,255,0.82)');
  g.addColorStop(0.45, 'rgba(255,255,255,0.16)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(c, c, r, 0, Math.PI * 2);
  ctx.fill();
  const rim = ctx.createRadialGradient(c, c, r * 0.72, c, c, r);
  rim.addColorStop(0, 'rgba(0,0,0,0)');
  rim.addColorStop(1, 'rgba(0,0,0,0.4)');
  ctx.fillStyle = rim;
  ctx.beginPath();
  ctx.arc(c, c, r, 0, Math.PI * 2);
  ctx.fill();
  return cv;
}

function lighten2(color, amt) {
  if (color.startsWith('#')) return lighten(color, amt);
  return color;
}

function darken2(color, amt) {
  if (color.startsWith('#')) return darken(color, amt);
  return color;
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  canvas.width = WORLD.WIDTH;
  canvas.height = WORLD.HEIGHT;

  const table = drawTable();
  const gloss = ballGloss();
  const base = new Map();
  const band = new Map();
  const badge = new Map();

  const sprite = (cache, id, factory) => {
    let s = cache.get(id);
    if (!s) {
      s = factory(id);
      cache.set(id, s);
    }
    return s;
  };

  function drawBall(b, alpha = 1, scale = 1, rot = 0) {
    const size = (R + PAD) * 2 * scale;
    const left = b.x - size / 2;
    const top = b.y - size / 2;
    ctx.globalAlpha = alpha;
    ctx.drawImage(sprite(base, b.id, ballBase), left, top, size, size);
    if (b.kind === 'stripe') {
      const bd = sprite(band, b.id, ballBand);
      if (rot) {
        ctx.save();
        ctx.translate(b.x, b.y);
        ctx.rotate(rot);
        ctx.drawImage(bd, -size / 2, -size / 2, size, size);
        ctx.restore();
      } else {
        ctx.drawImage(bd, left, top, size, size);
      }
    }
    if (b.id !== CUE) ctx.drawImage(sprite(badge, b.id, ballBadge), left, top, size, size);
    ctx.drawImage(gloss, left, top, size, size);
    ctx.globalAlpha = 1;
  }

  function drawShadows(balls) {
    ctx.fillStyle = COLORS.shadow;
    for (const b of balls) {
      if (!b.alive) continue;
      ctx.save();
      ctx.translate(b.x + 2.6, b.y + 3.4);
      ctx.rotate(-0.5);
      ctx.beginPath();
      ctx.ellipse(0, 0, R * 1.02, R * 0.74, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  function drawAim(sim) {
    const preview = sim.aimPreview();
    if (!preview) return;
    const cue = sim.world.balls.find((b) => b.id === CUE);
    if (!cue || !cue.alive) return;
    const showLine = sim.showAimLine();
    if (!showLine) return;
    const rival = sim.match.turn === 'rival';
    ctx.save();
    ctx.lineWidth = rival ? 1.6 : 2;
    ctx.setLineDash(AIM.LINE_DASH);
    ctx.strokeStyle = rival ? COLORS.aimSoft : COLORS.aim;
    ctx.beginPath();
    ctx.moveTo(cue.x, cue.y);
    ctx.lineTo(preview.end.x, preview.end.y);
    ctx.stroke();
    ctx.setLineDash([]);

    if (preview.ghost) {
      ctx.strokeStyle = COLORS.ghost;
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.arc(preview.ghost.x, preview.ghost.y, R, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 0.75;
      ctx.strokeStyle = COLORS.aim;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(preview.object.x, preview.object.y);
      ctx.lineTo(preview.object.x + preview.object.dx * 78, preview.object.y + preview.object.dy * 78);
      ctx.stroke();
      ctx.globalAlpha = 1;
      const tx = -preview.object.dy;
      const ty = preview.object.dx;
      ctx.strokeStyle = COLORS.tangent;
      ctx.lineWidth = 1.2;
      ctx.setLineDash([5, 6]);
      ctx.beginPath();
      ctx.moveTo(preview.ghost.x, preview.ghost.y);
      ctx.lineTo(preview.ghost.x + tx * 54, preview.ghost.y + ty * 54);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.restore();
  }

  function drawStick(sim) {
    const cue = sim.world.balls.find((b) => b.id === CUE);
    if (!cue || !cue.alive) return;
    const st = sim.stick;
    let angle = st.angle;
    let power = st.power;
    let phase = 0;
    if (st.state === 'idle') {
      if (!sim.showAimLine()) return;
      const preview = sim.aimPreview();
      if (!preview) return;
      angle = preview.angle;
      power = sim.power();
    } else if (st.state === 'pull') {
      phase = -(st.t / FX.CUE_BACK_S) * 34;
    } else if (st.state === 'strike') {
      phase = -34 + (st.t / FX.CUE_STRIKE_S) * 42;
    } else {
      phase = 8;
    }
    const back = 20 + power * 52 + phase;
    const tipX = cue.x - Math.cos(angle) * back;
    const tipY = cue.y - Math.sin(angle) * back;
    const len = 330;
    const buttX = tipX - Math.cos(angle) * len;
    const buttY = tipY - Math.sin(angle) * len;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 7.5;
    ctx.beginPath();
    ctx.moveTo(tipX + 3, tipY + 5);
    ctx.lineTo(buttX + 3, buttY + 5);
    ctx.stroke();
    const wood = ctx.createLinearGradient(tipX, tipY, buttX, buttY);
    wood.addColorStop(0, COLORS.cueStick0);
    wood.addColorStop(0.62, COLORS.cueStick1);
    wood.addColorStop(1, COLORS.cueButt);
    ctx.strokeStyle = wood;
    ctx.lineWidth = 6.4;
    ctx.beginPath();
    ctx.moveTo(tipX, tipY);
    ctx.lineTo(buttX, buttY);
    ctx.stroke();
    ctx.strokeStyle = COLORS.cueTip;
    ctx.lineWidth = 6.4;
    ctx.beginPath();
    ctx.moveTo(tipX, tipY);
    ctx.lineTo(tipX - Math.cos(angle) * 9, tipY - Math.sin(angle) * 9);
    ctx.stroke();
    ctx.restore();
  }

  function drawPower(sim) {
    const power = sim.power();
    if (power <= 0.001) return;
    const w = 300;
    const h = 12;
    const x = MID_X - w / 2;
    const y = WORLD.HEIGHT - h - 8;
    ctx.save();
    ctx.fillStyle = 'rgba(6,8,12,0.72)';
    rr(ctx, x - 3, y - 3, w + 6, h + 6, 8);
    ctx.fill();
    const grad = ctx.createLinearGradient(x, y, x + w, y);
    grad.addColorStop(0, COLORS.power0);
    grad.addColorStop(1, COLORS.power1);
    ctx.fillStyle = grad;
    rr(ctx, x, y, Math.max(2, w * power), h, 5);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 1;
    rr(ctx, x, y, w, h, 5);
    ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.font = '600 12px "Helvetica Neue", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${Math.round(power * 100)}%`, x + w / 2, y + h / 2 + 0.5);
    ctx.restore();
  }

  function drawHand(sim) {
    const hud = sim.match.getHud();
    if (!hud.ballInHand || hud.turn !== 'player') return;
    const cue = sim.world.balls.find((b) => b.id === CUE);
    if (!cue) return;
    ctx.save();
    ctx.setLineDash([6, 6]);
    ctx.lineWidth = 2;
    ctx.strokeStyle = sim.place.active ? (sim.place.ok ? COLORS.handOk : COLORS.handBad) : COLORS.handOk;
    ctx.beginPath();
    ctx.arc(cue.x, cue.y, R + 9, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  function drawEffects(sim) {
    for (const p of sim.fx.pots) {
      const k = p.t / FX.POT_S;
      const e = k * k;
      const x = p.from.x + (p.to.x - p.from.x) * e;
      const y = p.from.y + (p.to.y - p.from.y) * e;
      const fake = { id: p.id, x, y, kind: p.kind };
      drawBall(fake, Math.max(0, 1 - k * 0.85), Math.max(0.12, 1 - k * 0.8), k * 7);
    }
    for (const f of sim.fx.flash) {
      const k = f.t / 0.5;
      ctx.save();
      ctx.globalAlpha = Math.max(0, 0.55 - k * 0.55);
      ctx.strokeStyle = '#ffe9b0';
      ctx.lineWidth = 3 - k * 2;
      ctx.beginPath();
      ctx.arc(f.x, f.y, TABLE.POCKET_R + k * 16, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }
    for (const q of sim.fx.particles) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, q.life * 1.6);
      ctx.fillStyle = q.color;
      ctx.beginPath();
      ctx.arc(q.x, q.y, 2.1, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  return {
    render(sim) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
      ctx.save();
      if (sim && sim.fx.shake > 0.05 && !sim.reduceMotion) {
        ctx.translate(
          (Math.random() - 0.5) * sim.fx.shake * 2,
          (Math.random() - 0.5) * sim.fx.shake * 2,
        );
      }
      ctx.drawImage(table, 0, 0);
      if (!sim) {
        ctx.restore();
        return;
      }
      const balls = sim.world.balls;
      drawShadows(balls);
      for (const b of balls) {
        if (!b.alive || b.id === CUE) continue;
        drawBall(b, 1, 1, (b.spin || 0) * 0.5);
      }
      const cue = balls.find((b) => b.id === CUE);
      if (cue && cue.alive) drawBall(cue, 1, 1, 0);
      drawAim(sim);
      drawHand(sim);
      drawStick(sim);
      drawEffects(sim);
      drawPower(sim);
      ctx.restore();
    },
    size: WORLD,
  };
}
