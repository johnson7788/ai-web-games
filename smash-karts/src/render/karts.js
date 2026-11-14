// 卡丁车绘制：车身贴图（缺失走配置色程序化车）+ 程序化脸（9 种表情）+ 朝向/侧倾/挤压 + 玩家标识。
// 脸盘锚点读 KARTS[kartId].face（归一化），脸在车身本地坐标里随车旋转。
import { PALETTE, KARTS, RULES } from '../../config/game.config.js';
import { roundRect, starPath } from './fx.js';

const SPRITE_H = 74;
const BODY_W_FALLBACK = 96;
const BODY_H_FALLBACK = 72;
const FONT = '"PingFang SC","Hiragino Sans GB","Microsoft YaHei","Segoe UI",system-ui,sans-serif';

// config 里 KARTS[kartId].body 指向的文件可能尚未生成；按 kartId 映射到仓库里实际存在的贴图。
const BODY_FALLBACK = {
  mint: 'assets/karts/mint.webp',
  cherry: 'assets/karts/rose.webp',
  blu: 'assets/karts/blue.webp',
  sunny: 'assets/karts/amber.webp',
  grape: 'assets/karts/violet.webp',
};

const BUBBLES = {
  hit: { en: 'Ow!', zh: '哎哟！' },
  surprise: { en: 'Huh?!', zh: '咦？！' },
};

function normAngle(a) {
  while (a > Math.PI) a -= 2 * Math.PI;
  while (a < -Math.PI) a += 2 * Math.PI;
  return a;
}
function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

export function createKartPainter(assets) {
  const stateById = new Map();
  const metaCache = new Map();
  const get = (p) => (assets && typeof assets.get === 'function' ? assets.get(p) : null);

  function stateFor(id) {
    let st = stateById.get(id);
    if (!st) {
      st = { lean: 0, lastA: 0, prevT: -1 };
      stateById.set(id, st);
    }
    return st;
  }

  function spriteMeta(path) {
    let m = metaCache.get(path);
    if (m === undefined) {
      const img = get(path);
      if (img && img.naturalWidth) {
        m = { img, aspect: img.naturalWidth / img.naturalHeight };
      } else {
        m = null;
      }
      metaCache.set(path, m);
    }
    return m;
  }

  function resolveSprite(k) {
    const cfg = KARTS[k.kartId] || KARTS.mint || {};
    if (cfg.body) {
      const m = spriteMeta(cfg.body);
      if (m) return m;
    }
    if (k.kartId && BODY_FALLBACK[k.kartId]) {
      const m = spriteMeta(BODY_FALLBACK[k.kartId]);
      if (m) return m;
    }
    return null;
  }

  // ---- 程序化车兜底 -------------------------------------------------------
  function drawFallbackBody(ctx, k, w, h) {
    ctx.fillStyle = PALETTE.ink;
    for (const [wx, wy] of [[-0.34, -0.56], [0.3, -0.56], [-0.34, 0.56], [0.3, 0.56]]) {
      roundRect(ctx, wx * w - w * 0.11, wy * h - h * 0.16, w * 0.22, h * 0.32, 5);
      ctx.fill();
    }
    ctx.fillStyle = k.color || PALETTE.mint;
    roundRect(ctx, -w / 2, -h / 2, w, h, 16);
    ctx.fill();
    ctx.strokeStyle = PALETTE.ink;
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    roundRect(ctx, w * 0.2, -h * 0.34, w * 0.26, h * 0.68, 9);
    ctx.fill();
    ctx.fillStyle = 'rgba(59,42,74,0.25)';
    roundRect(ctx, -w * 0.44, -h * 0.3, w * 0.2, h * 0.6, 8);
    ctx.fill();
  }

  function drawBoostFlame(ctx, w, t) {
    const flick = 0.5 + 0.5 * Math.sin(t * 31);
    const len = 18 + flick * 10;
    ctx.fillStyle = PALETTE.boost;
    ctx.beginPath();
    ctx.moveTo(-w * 0.42, -8);
    ctx.quadraticCurveTo(-w * 0.42 - len, -3, -w * 0.42 - len - 8, 0);
    ctx.quadraticCurveTo(-w * 0.42 - len, 3, -w * 0.42, 8);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = PALETTE.ink;
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.fillStyle = PALETTE.gold;
    ctx.beginPath();
    ctx.moveTo(-w * 0.42, -4);
    ctx.quadraticCurveTo(-w * 0.42 - len * 0.55, 0, -w * 0.42, 4);
    ctx.closePath();
    ctx.fill();
  }

  // ---- 程序化脸 ------------------------------------------------------------
  // 脸坐标系：原点 = 脸盘中心，+x = 车头（下巴方向），+y = 车身右侧。
  function drawFace(ctx, k, faceR, t) {
    const r = faceR;
    const expr = k.expression || 'idle';
    const blink = ((t * 0.9 + (k.id || 0) * 1.37) % 3.4) < 0.13 && expr === 'idle';
    const eyeX = 0.02 * r;
    const eyeY = 0.4 * r;

    // 脸盘
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.99, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,246,229,0.5)';
    ctx.fill();

    // 腮红
    ctx.fillStyle = PALETTE.cherry;
    ctx.globalAlpha = expr === 'win' ? 0.6 : 0.35;
    for (const sy of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(0.16 * r, sy * 0.6 * r, 0.2 * r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    const ink = PALETTE.ink;

    function openEye(sy, rxMul = 1, ryMul = 1, lookX = 0, pupilMul = 1) {
      const ex = eyeX;
      const ey = sy * eyeY;
      const rx = 0.27 * r * rxMul;
      const ry = 0.33 * r * ryMul;
      ctx.beginPath();
      ctx.ellipse(ex, ey, rx, ry, 0, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.strokeStyle = ink;
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(ex + lookX, ey, rx * 0.5 * pupilMul, 0, Math.PI * 2);
      ctx.fillStyle = ink;
      ctx.fill();
      ctx.beginPath();
      ctx.arc(ex + lookX - rx * 0.16, ey - rx * 0.18, rx * 0.16, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
    }
    function closedArc(sy) {
      ctx.beginPath();
      ctx.arc(eyeX, sy * eyeY + 0.08 * r, 0.26 * r, Math.PI, Math.PI * 2);
      ctx.strokeStyle = ink;
      ctx.lineWidth = 3.5;
      ctx.lineCap = 'round';
      ctx.stroke();
    }
    function smileOpen(bulge, halfW, fill = true) {
      ctx.beginPath();
      ctx.moveTo(0.28 * r, -halfW * r);
      ctx.quadraticCurveTo((0.28 + bulge) * r, 0, 0.28 * r, halfW * r);
      ctx.quadraticCurveTo((0.28 + bulge * 0.45) * r, 0, 0.28 * r, -halfW * r);
      ctx.closePath();
      if (fill) {
        ctx.fillStyle = '#9c3f5e';
        ctx.fill();
      }
      ctx.strokeStyle = ink;
      ctx.lineWidth = 3;
      ctx.stroke();
    }

    switch (expr) {
      case 'happy':
        closedArc(-1);
        closedArc(1);
        smileOpen(0.3, 0.22);
        break;
      case 'angry':
        ctx.strokeStyle = ink;
        ctx.lineWidth = 3.5;
        ctx.lineCap = 'round';
        for (const sy of [-1, 1]) {
          ctx.beginPath();
          ctx.moveTo(eyeX - 0.3 * r, sy * (eyeY + 0.18 * r));
          ctx.lineTo(eyeX - 0.02 * r, sy * (eyeY - 0.16 * r));
          ctx.stroke();
        }
        openEye(-1, 1, 0.55);
        openEye(1, 1, 0.55);
        ctx.beginPath();
        ctx.moveTo(0.3 * r, -0.24 * r);
        ctx.lineTo(0.44 * r, -0.08 * r);
        ctx.lineTo(0.3 * r, 0.08 * r);
        ctx.lineTo(0.44 * r, 0.24 * r);
        ctx.strokeStyle = ink;
        ctx.lineWidth = 3;
        ctx.stroke();
        break;
      case 'hit':
        ctx.strokeStyle = ink;
        ctx.lineWidth = 3.5;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(eyeX - 0.18 * r, -eyeY - 0.14 * r);
        ctx.lineTo(eyeX, -eyeY + 0.18 * r);
        ctx.lineTo(eyeX + 0.18 * r, -eyeY - 0.14 * r);
        ctx.moveTo(eyeX - 0.18 * r, eyeY + 0.14 * r);
        ctx.lineTo(eyeX, eyeY - 0.18 * r);
        ctx.lineTo(eyeX + 0.18 * r, eyeY + 0.14 * r);
        ctx.stroke();
        // 汗滴
        ctx.fillStyle = '#7fd0ff';
        ctx.strokeStyle = ink;
        ctx.lineWidth = 2;
        ctx.beginPath();
        const swx = -0.5 * r + Math.sin(t * 9) * 1.5;
        ctx.moveTo(swx, -0.78 * r);
        ctx.quadraticCurveTo(swx - 0.18 * r, -0.5 * r, swx, -0.42 * r);
        ctx.quadraticCurveTo(swx + 0.18 * r, -0.5 * r, swx, -0.78 * r);
        ctx.fill();
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(0.3 * r, -0.16 * r);
        ctx.quadraticCurveTo(0.42 * r, -0.04 * r, 0.32 * r, 0.06 * r);
        ctx.quadraticCurveTo(0.24 * r, 0.12 * r, 0.34 * r, 0.2 * r);
        ctx.strokeStyle = ink;
        ctx.lineWidth = 3;
        ctx.stroke();
        break;
      case 'ko':
        ctx.strokeStyle = ink;
        ctx.lineWidth = 4;
        ctx.lineCap = 'round';
        for (const sy of [-1, 1]) {
          const ey = sy * eyeY;
          ctx.beginPath();
          ctx.moveTo(eyeX - 0.18 * r, ey - 0.18 * r);
          ctx.lineTo(eyeX + 0.18 * r, ey + 0.18 * r);
          ctx.moveTo(eyeX + 0.18 * r, ey - 0.18 * r);
          ctx.lineTo(eyeX - 0.18 * r, ey + 0.18 * r);
          ctx.stroke();
        }
        ctx.beginPath();
        ctx.arc(0.34 * r, 0, 0.13 * r, 0, Math.PI * 2);
        ctx.fillStyle = '#9c3f5e';
        ctx.fill();
        ctx.lineWidth = 3;
        ctx.stroke();
        break;
      case 'boost':
        openEye(-1, 1.4, 0.6, 0.1 * r, 0.9);
        openEye(1, 1.4, 0.6, 0.1 * r, 0.9);
        smileOpen(0.34, 0.3);
        break;
      case 'win':
        for (const sy of [-1, 1]) {
          starPath(ctx, eyeX, sy * eyeY, 0.3 * r, -Math.PI / 2);
          ctx.fillStyle = PALETTE.gold;
          ctx.fill();
          ctx.strokeStyle = ink;
          ctx.lineWidth = 2.5;
          ctx.stroke();
        }
        smileOpen(0.36, 0.32);
        break;
      case 'sleepy':
        for (const sy of [-1, 1]) {
          const ex = eyeX;
          const ey = sy * eyeY;
          ctx.beginPath();
          ctx.ellipse(ex, ey + 0.08 * r, 0.27 * r, 0.18 * r, 0, 0, Math.PI * 2);
          ctx.fillStyle = '#ffffff';
          ctx.fill();
          ctx.strokeStyle = ink;
          ctx.lineWidth = 2.5;
          ctx.stroke();
          ctx.beginPath();
          ctx.arc(ex, ey + 0.14 * r, 0.12 * r, 0, Math.PI * 2);
          ctx.fillStyle = ink;
          ctx.fill();
          ctx.beginPath();
          ctx.moveTo(ex - 0.28 * r, ey - 0.06 * r);
          ctx.lineTo(ex + 0.28 * r, ey - 0.06 * r);
          ctx.strokeStyle = ink;
          ctx.lineWidth = 3.5;
          ctx.lineCap = 'round';
          ctx.stroke();
        }
        ctx.beginPath();
        ctx.arc(0.34 * r, 0, 0.09 * r, 0, Math.PI * 2);
        ctx.strokeStyle = ink;
        ctx.lineWidth = 2.5;
        ctx.stroke();
        break;
      case 'surprise':
        openEye(-1, 1, 1.15, 0, 0.7);
        openEye(1, 1, 1.15, 0, 0.7);
        ctx.strokeStyle = ink;
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        for (const sy of [-1, 1]) {
          ctx.beginPath();
          ctx.arc(eyeX - 0.24 * r, sy * eyeY, 0.16 * r, Math.PI * 0.7, Math.PI * 1.3);
          ctx.stroke();
        }
        ctx.beginPath();
        ctx.arc(0.36 * r, 0, 0.15 * r, 0, Math.PI * 2);
        ctx.fillStyle = '#9c3f5e';
        ctx.fill();
        ctx.lineWidth = 3;
        ctx.stroke();
        break;
      default: {
        // idle
        if (blink) {
          ctx.strokeStyle = ink;
          ctx.lineWidth = 3;
          ctx.lineCap = 'round';
          for (const sy of [-1, 1]) {
            ctx.beginPath();
            ctx.moveTo(eyeX - 0.24 * r, sy * eyeY);
            ctx.lineTo(eyeX + 0.24 * r, sy * eyeY);
            ctx.stroke();
          }
        } else {
          openEye(-1);
          openEye(1);
        }
        ctx.beginPath();
        ctx.moveTo(0.28 * r, -0.16 * r);
        ctx.quadraticCurveTo(0.42 * r, 0, 0.28 * r, 0.16 * r);
        ctx.strokeStyle = ink;
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.stroke();
        break;
      }
    }
  }

  // ---- 主绘制 --------------------------------------------------------------
  function drawKart(ctx, k, t, opts = {}) {
    if (!k) return;
    const st = stateFor(k.id);
    let dt = opts.bench ? 1 / 60 : t - st.prevT;
    if (!(dt > 0) || dt > 0.25) dt = 1 / 60;
    if (st.prevT >= 0 && !opts.bench) {
      const dA = normAngle((k.angle || 0) - st.lastA);
      const target = clamp((dA / dt) * 0.035, -0.12, 0.12);
      st.lean += (target - st.lean) * Math.min(1, dt * 12);
    }
    st.lastA = k.angle || 0;
    st.prevT = t;

    const cfg = KARTS[k.kartId] || KARTS.mint || KARTS[Object.keys(KARTS)[0]] || {};
    const face = cfg.face || { x: 0.6, y: 0.46, r: 0.3 };
    const expr = k.expression || 'idle';

    if (k.dead) {
      ctx.strokeStyle = 'rgba(255,246,229,0.5)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(k.x, k.y, 20, 0, Math.PI * 2);
      ctx.stroke();
      const prog = clamp(1 - (k.respawn || 0) / RULES.respawnSec, 0, 1);
      ctx.strokeStyle = PALETTE.gold;
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(k.x, k.y, 20, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * prog);
      ctx.stroke();
      return;
    }

    const sprite = resolveSprite(k);
    const h = sprite ? SPRITE_H : BODY_H_FALLBACK;
    const w = sprite ? SPRITE_H * sprite.aspect : BODY_W_FALLBACK;

    // 软阴影
    ctx.save();
    ctx.translate(k.x, k.y);
    ctx.rotate(k.angle || 0);
    ctx.fillStyle = PALETTE.shadow;
    ctx.beginPath();
    ctx.ellipse(2, 9, w * 0.46, h * 0.34, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    const boosting = !!k.boosting || (k.boostTime || 0) > 0;
    const sx = clamp(1 + (k.squash || 0) * 0.4 + (boosting ? 0.08 : 0), 0.82, 1.16);
    const sy = 2 - sx;

    ctx.save();
    ctx.translate(k.x, k.y);
    ctx.rotate((k.angle || 0) + st.lean);
    ctx.scale(sx, sy);
    if ((k.invuln || 0) > 0) ctx.globalAlpha = 0.55 + 0.3 * Math.sin(t * 22);
    if (boosting) drawBoostFlame(ctx, w, t);
    if (sprite) {
      ctx.drawImage(sprite.img, -w / 2, -h / 2, w, h);
    } else {
      drawFallbackBody(ctx, k, w, h);
    }
    // 脸（随车旋转）
    ctx.save();
    ctx.translate((face.x - 0.5) * w, (face.y - 0.5) * h);
    drawFace(ctx, k, face.r * h, t);
    ctx.restore();
    // 受击闪白
    const flash = clamp((k.hitFlash || 0) * 5.5, 0, 0.75);
    if (flash > 0.02) {
      ctx.fillStyle = `rgba(255,255,255,${flash})`;
      roundRect(ctx, -w / 2 - 3, -h / 2 - 3, w + 6, h + 6, 16);
      ctx.fill();
    }
    ctx.restore();

    // ---- 不随车旋转的覆盖层 ----
    if ((k.invuln || 0) > 0) {
      ctx.strokeStyle = 'rgba(255,246,229,0.85)';
      ctx.lineWidth = 2.5;
      ctx.setLineDash([7, 6]);
      ctx.lineDashOffset = -t * 40;
      ctx.beginPath();
      ctx.arc(k.x, k.y, 30, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    if ((k.shield || 0) > 0) {
      ctx.fillStyle = 'rgba(73,182,255,0.16)';
      ctx.strokeStyle = 'rgba(73,182,255,0.9)';
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.arc(k.x, k.y, 33 + Math.sin(t * 7) * 1.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    }
    if (expr === 'ko') {
      for (let i = 0; i < 3; i += 1) {
        const a = t * 2.6 + i * ((Math.PI * 2) / 3);
        const px = k.x + Math.cos(a) * 42;
        const py = k.y - 8 + Math.sin(a) * 16;
        starPath(ctx, px, py, 7, a);
        ctx.fillStyle = PALETTE.gold;
        ctx.fill();
        ctx.strokeStyle = PALETTE.ink;
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }
    if (expr === 'sleepy') {
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      for (let i = 0; i < 2; i += 1) {
        const ph = ((t * 0.7 + i * 0.5 + (k.id || 0) * 0.31) % 1);
        const px = k.x + 24 + ph * 12 + i * 9;
        const py = k.y - 40 - ph * 20 - i * 5;
        ctx.globalAlpha = (1 - ph) * 0.9;
        ctx.font = `italic 800 ${Math.round(11 + ph * 8)}px ${FONT}`;
        ctx.strokeStyle = PALETTE.ink;
        ctx.lineWidth = 3;
        ctx.strokeText('z', px, py);
        ctx.fillStyle = PALETTE.cream;
        ctx.fillText('z', px, py);
      }
      ctx.globalAlpha = 1;
    }
    const bubble = BUBBLES[expr];
    const bubbleReady = (t - (st.lastBubble === undefined ? -9 : st.lastBubble)) > 3.5;
    if (bubble && !opts.bench && bubbleReady && (k.expressionT || 0) > 0.4) {
      st.lastBubble = t;
      const lang = opts.lang === 'zh' ? 'zh' : 'en';
      const text = bubble[lang];
      const pop = Math.min(1, (k.expressionT || 0) / 0.12);
      ctx.save();
      ctx.translate(k.x, k.y - 66);
      ctx.scale(pop, pop);
      ctx.font = `700 13px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const tw = ctx.measureText(text).width + 22;
      ctx.fillStyle = PALETTE.cream;
      ctx.strokeStyle = PALETTE.ink;
      ctx.lineWidth = 3;
      roundRect(ctx, -tw / 2, -13, tw, 24, 10);
      ctx.fill();
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-4, 11);
      ctx.lineTo(2, 22);
      ctx.lineTo(8, 11);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = PALETTE.ink;
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.fillStyle = PALETTE.ink;
      ctx.fillText(text, 0, 0);
      ctx.restore();
    }
    if (k.isPlayer) {
      ctx.strokeStyle = PALETTE.gold;
      ctx.lineWidth = 3.5;
      ctx.setLineDash([9, 7]);
      ctx.lineDashOffset = -t * 30;
      ctx.beginPath();
      ctx.arc(k.x, k.y, 34, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
      const bob = Math.sin(t * 3.2) * 3;
      ctx.fillStyle = PALETTE.gold;
      ctx.strokeStyle = PALETTE.ink;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(k.x - 9, k.y - 50 + bob);
      ctx.lineTo(k.x + 9, k.y - 50 + bob);
      ctx.lineTo(k.x, k.y - 36 + bob);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    if (!opts.bench) {
      const maxHp = k.maxHp || RULES.hp;
      const frac = clamp((k.hp || 0) / maxHp, 0, 1);
      const bx = k.x - 23;
      const by = k.y - 60;
      ctx.fillStyle = 'rgba(59,42,74,0.4)';
      roundRect(ctx, bx, by, 46, 7, 3.5);
      ctx.fill();
      ctx.fillStyle = frac > 0.5 ? PALETTE.hpGood : frac > 0.25 ? PALETTE.hpMid : PALETTE.hpLow;
      if (frac > 0.01) {
        roundRect(ctx, bx, by, 46 * frac, 7, 3.5);
        ctx.fill();
      }
      const shFrac = clamp((k.shield || 0) / maxHp, 0, 0.35);
      if (shFrac > 0) {
        ctx.fillStyle = PALETTE.blu;
        roundRect(ctx, bx + 46 * frac, by, 46 * shFrac, 7, 3.5);
        ctx.fill();
      }
      ctx.strokeStyle = PALETTE.ink;
      ctx.lineWidth = 2.5;
      roundRect(ctx, bx, by, 46, 7, 3.5);
      ctx.stroke();
    }
  }

  function clearState() {
    stateById.clear();
  }

  return { drawKart, clearState };
}
