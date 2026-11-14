// 渲染入口：createRenderer(canvas, assets)（README §2.4 契约）。
// 负责letterbox + DPR（封顶 2）、sim 事件 → 粒子/震屏/飘字、整屏绘制顺序与降级。
import { WORLD, PALETTE, ARENAS, WEAPONS, RULES } from '../../config/game.config.js';
import { createFx, roundRect } from './fx.js';
import { createArenaPainter } from './arena.js';
import { createKartPainter } from './karts.js';

const CRATE_ICON = {
  rapid: 'assets/icons/weapon-rapid.webp',
  shotgun: 'assets/icons/weapon-shotgun.webp',
  rocket: 'assets/icons/weapon-rocket.webp',
};

function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

export function createRenderer(canvas, assets) {
  const get = (p) => (assets && typeof assets.get === 'function' ? assets.get(p) : null);
  const ctx = canvas.getContext('2d');
  const fx = createFx();
  const arenaP = createArenaPainter(assets);
  const kartP = createKartPainter(assets);

  let view = { dpr: 1, cw: WORLD.WIDTH, ch: WORLD.HEIGHT, scale: 1, ox: 0, oy: 0 };
  let runRef = null;
  let baseReduced = false;
  try {
    baseReduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch { /* noop */ }

  function resize() {
    const dpr = Math.min(2, (typeof devicePixelRatio === 'number' && devicePixelRatio) || 1);
    const cw = canvas.clientWidth || WORLD.WIDTH;
    const ch = canvas.clientHeight || WORLD.HEIGHT;
    canvas.width = Math.round(cw * dpr);
    canvas.height = Math.round(ch * dpr);
    const scale = Math.min(cw / WORLD.WIDTH, ch / WORLD.HEIGHT);
    view = {
      dpr, cw, ch, scale,
      ox: (cw - WORLD.WIDTH * scale) / 2,
      oy: (ch - WORLD.HEIGHT * scale) / 2,
    };
  }

  function kartById(id) {
    const ks = runRef && runRef.karts;
    if (!ks) return null;
    for (const k of ks) if (k.id === id) return k;
    return null;
  }

  // ---- sim 事件 → 表现 ------------------------------------------------------
  function event(ev) {
    if (!ev || !ev.type) return;
    switch (ev.type) {
      case 'shot': {
        fx.burst(ev.x, ev.y, {
          count: 4, shape: 'spark', color: PALETTE.gold,
          dir: ev.angle, spread: 0.5, speed0: 120, speed1: 300, life0: 0.08, life1: 0.16, size: 6,
        });
        const wp = WEAPONS[ev.weapon];
        fx.ring(ev.x, ev.y, 3, 15, 0.14, (wp && wp.color) || PALETTE.gold, 3);
        break;
      }
      case 'hit': {
        const victim = kartById(ev.victim);
        const toPlayer = !!(victim && victim.isPlayer);
        const color = toPlayer ? PALETTE.danger : '#ffffff';
        const size = (ev.damage || 0) >= 20 ? 26 : 18;
        fx.floater(ev.x, ev.y - 16, String(ev.damage), color, size);
        fx.burst(ev.x, ev.y, { count: 5, color: '#ffffff', speed0: 60, speed1: 180, life0: 0.15, life1: 0.3, size: 3.5 });
        break;
      }
      case 'ko': {
        fx.stars(ev.x, ev.y, 7);
        fx.burst(ev.x, ev.y, { count: 14, color: [PALETTE.gold, PALETTE.cherry, PALETTE.cream], speed0: 80, speed1: 320, life0: 0.4, life1: 0.8, size: 5 });
        fx.smoke(ev.x, ev.y, 5);
        fx.ring(ev.x, ev.y, 24, 92, 0.45, PALETTE.gold, 6);
        fx.floater(ev.x, ev.y - 34, 'KO!', PALETTE.gold, 34);
        fx.addShake(9, 0.26);
        fx.triggerSlowmo();
        break;
      }
      case 'respawn': {
        fx.ring(ev.x, ev.y, 8, 34, 0.35, PALETTE.cream, 4);
        fx.burst(ev.x, ev.y, { count: 8, color: PALETTE.gold, speed0: 50, speed1: 160, life0: 0.3, life1: 0.5, size: 4 });
        break;
      }
      case 'crate': {
        fx.ring(ev.x, ev.y, 6, 28, 0.45, PALETTE.gold, 3);
        break;
      }
      case 'crateOpen': {
        const wp = WEAPONS[ev.weapon];
        fx.burst(ev.x, ev.y, { count: 9, color: [PALETTE.gold, (wp && wp.color) || PALETTE.cream], speed0: 70, speed1: 220, life0: 0.3, life1: 0.55, size: 5 });
        fx.ring(ev.x, ev.y, 8, 32, 0.3, PALETTE.gold, 4);
        break;
      }
      case 'driftStart': {
        fx.dust(ev.x, ev.y, 3, 'rgba(255,246,229,0.8)');
        break;
      }
      case 'driftEnd': {
        const owner = kartById(ev.id);
        const charge = ev.charge || 0;
        const px = owner ? owner.x : ev.x;
        const py = owner ? owner.y : ev.y;
        if (charge >= 0.35) {
          fx.burst(px, py, {
            count: 12, shape: 'spark',
            color: charge >= 0.7 ? PALETTE.blu : PALETTE.gold,
            speed0: 90, speed1: 260, life0: 0.2, life1: 0.4, size: 7,
          });
        } else {
          fx.dust(px, py, 5, 'rgba(255,246,229,0.7)');
        }
        break;
      }
      case 'boost': {
        const owner = kartById(ev.id);
        const px = owner ? owner.x : ev.x;
        const py = owner ? owner.y : ev.y;
        const dir = owner ? owner.angle : 0;
        fx.speedLines(px, py, dir, 10);
        fx.burst(px - Math.cos(dir) * 26, py - Math.sin(dir) * 26, {
          count: 6, color: [PALETTE.boost, PALETTE.gold], dir, spread: 0.7,
          speed0: 60, speed1: 180, life0: 0.2, life1: 0.4, size: 5,
        });
        break;
      }
      case 'ram': {
        fx.stars(ev.x, ev.y, 5, PALETTE.cream);
        fx.ring(ev.x, ev.y, 8, 30, 0.22, PALETTE.cream, 4);
        fx.addShake(5, 0.15);
        break;
      }
      case 'wallBump': {
        fx.dust(ev.x, ev.y, 4, 'rgba(255,246,229,0.75)');
        const owner = kartById(ev.id);
        if (owner && owner.isPlayer) fx.addShake(3, 0.12);
        break;
      }
      case 'hazard': {
        fx.burst(ev.x, ev.y, { count: 4, color: '#ff9f43', speed0: 40, speed1: 140, life0: 0.25, life1: 0.5, size: 4, grav: -60 });
        fx.smoke(ev.x, ev.y, 2, 'rgba(255,159,67,0.5)');
        break;
      }
      case 'roundStart': {
        fx.ring(WORLD.WIDTH / 2, WORLD.HEIGHT / 2, 40, 210, 0.6, PALETTE.cream, 6);
        break;
      }
      case 'countdown': {
        fx.ring(WORLD.WIDTH / 2, WORLD.HEIGHT / 2, 20, 120, 0.4, PALETTE.gold, 5);
        break;
      }
      default:
        break;
    }
  }

  // ---- 实体绘制 -------------------------------------------------------------
  function drawTrail(ctx, tr) {
    const life = clamp(tr.life / 1.1, 0, 1);
    ctx.fillStyle = PALETTE.boost;
    ctx.globalAlpha = 0.45 * life;
    ctx.beginPath();
    ctx.arc(tr.x, tr.y, tr.r * (0.8 + 0.2 * life), 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = PALETTE.gold;
    ctx.globalAlpha = 0.55 * life;
    ctx.beginPath();
    ctx.arc(tr.x, tr.y, tr.r * 0.55 * life, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  function drawCrate(ctx, c, t) {
    const bob = Math.sin(t * 2.6 + (c.id || 0)) * 3;
    const crateArt = get('assets/sprites/pickup-crate.webp');
    if (crateArt) {
      const pop = clamp((c.t === undefined ? 1 : c.t) / 0.25, 0.15, 1);
      const size = 62 * pop;
      ctx.fillStyle = PALETTE.shadow;
      ctx.beginPath();
      ctx.ellipse(c.x, c.y + 14, 22 * pop, 9 * pop, 0, 0, Math.PI * 2);
      ctx.fill();
      // 呼吸光环：一眼看出「这是可以捡的东西」
      ctx.globalAlpha = 0.32 + 0.16 * Math.sin(t * 3 + (c.id || 0));
      ctx.strokeStyle = PALETTE.gold;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(c.x, c.y + bob * 0.4, 30, 0, Math.PI * 2);
      ctx.stroke();
      ctx.globalAlpha = 1;
      ctx.drawImage(crateArt, c.x - size / 2, c.y - size / 2 + bob, size, size);
      return;
    }
    const pop = clamp((c.t === undefined ? 1 : c.t) / 0.25, 0.05, 1);
    const s = pop * (1 + 0.06 * Math.sin(t * 4 + (c.id || 0)));
    const size = 46 * s;
    ctx.fillStyle = PALETTE.shadow;
    ctx.beginPath();
    ctx.ellipse(c.x, c.y + 12, 20 * pop, 8 * pop, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 0.35 + 0.15 * Math.sin(t * 3 + (c.id || 0));
    ctx.strokeStyle = PALETTE.gold;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(c.x, c.y + bob * 0.4, 26, 0, Math.PI * 2);
    ctx.stroke();
    ctx.globalAlpha = 1;
    const icon = c.weapon ? get(CRATE_ICON[c.weapon]) : null;
    if (icon) {
      ctx.drawImage(icon, c.x - size / 2, c.y - size / 2 + bob, size, size);
      ctx.strokeStyle = PALETTE.ink;
      ctx.lineWidth = 3;
      roundRect(ctx, c.x - size / 2, c.y - size / 2 + bob, size, size, 10);
      ctx.stroke();
    } else {
      // 礼物盒兜底：奶油底 + 樱桃丝带 + 金点
      const bx = c.x - size / 2;
      const by = c.y - size / 2 + bob;
      ctx.fillStyle = PALETTE.cream;
      roundRect(ctx, bx, by, size, size, 10);
      ctx.fill();
      ctx.fillStyle = PALETTE.cherry;
      ctx.fillRect(bx + size * 0.42, by + 2, size * 0.16, size - 4);
      ctx.fillRect(bx + 2, by + size * 0.42, size - 4, size * 0.16);
      ctx.fillStyle = PALETTE.gold;
      for (const [gx, gy] of [[-0.3, -0.3], [0.3, -0.3], [-0.3, 0.3], [0.3, 0.3]]) {
        ctx.beginPath();
        ctx.arc(bx + size * (0.5 + gx), by + size * (0.5 + gy), 3, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.strokeStyle = PALETTE.ink;
      ctx.lineWidth = 3.5;
      roundRect(ctx, bx, by, size, size, 10);
      ctx.stroke();
    }
  }

  function drawProjectile(ctx, p, t, frame) {
    const kind = p.kind || (p.rocket ? 'rocket' : 'bullet');
    if (kind === 'rocket') {
      const a = Math.atan2(p.vy, p.vx);
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(a);
      const flick = 0.5 + 0.5 * Math.sin(t * 40 + p.id);
      ctx.fillStyle = PALETTE.boost;
      ctx.beginPath();
      ctx.moveTo(-10, -3.5);
      ctx.quadraticCurveTo(-16 - flick * 6, 0, -10, 3.5);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = PALETTE.danger;
      roundRect(ctx, -9, -5, 17, 10, 5);
      ctx.fill();
      ctx.strokeStyle = PALETTE.ink;
      ctx.lineWidth = 2.5;
      ctx.stroke();
      ctx.fillStyle = PALETTE.cream;
      ctx.beginPath();
      ctx.moveTo(8, -5);
      ctx.quadraticCurveTo(15, 0, 8, 5);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.restore();
      if (frame % 2 === 0) {
        fx.smoke(p.x - Math.cos(a) * 12, p.y - Math.sin(a) * 12, 1, 'rgba(255,246,229,0.55)');
      }
      return;
    }
    const smear = 0.028;
    ctx.strokeStyle = p.color || PALETTE.sunny;
    ctx.globalAlpha = 0.4;
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(p.x - p.vx * smear, p.y - p.vy * smear);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.fillStyle = p.color || PALETTE.sunny;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = PALETTE.ink;
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.beginPath();
    ctx.arc(p.x - 1.5, p.y - 1.5, 1.8, 0, Math.PI * 2);
    ctx.fill();
  }

  // ---- 整屏 ----------------------------------------------------------------
  function draw(run, hud, t) {
    t = t || 0;
    hud = hud || {};
    fx.setReduced(baseReduced || hud.reducedMotion === true);
    runRef = run || null;

    const cw = canvas.clientWidth || WORLD.WIDTH;
    if (!view.cw || Math.abs(cw - view.cw) > 1 || canvas.width !== Math.round(view.cw * view.dpr)) {
      resize();
    }

    ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
    ctx.fillStyle = PALETTE.ink;
    ctx.fillRect(0, 0, view.cw, view.ch);
    ctx.save();
    ctx.translate(view.ox, view.oy);
    ctx.scale(view.scale, view.scale);
    ctx.beginPath();
    ctx.rect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
    ctx.clip();
    ctx.translate(fx.shakeOx(), fx.shakeOy());

    const arena = (run && run.arena) || ARENAS[(run && run.roundIndex) || 0] || ARENAS[0];

    arenaP.drawFloor(ctx, arena, t);
    fx.drawGround(ctx);
    for (const tr of (run && run.trails) || []) drawTrail(ctx, tr);
    for (const c of (run && run.crates) || []) drawCrate(ctx, c, t);

    const karts = (run && run.karts) || [];
    const frame = Math.floor(t * 60);
    for (const k of karts) {
      if (k.isPlayer) continue;
      kartP.drawKart(ctx, k, t, { lang: hud.lang });
      drawDriftFeedback(k, t);
    }
    const player = karts.find((k) => k.isPlayer);
    if (player) {
      kartP.drawKart(ctx, player, t, { lang: hud.lang });
      drawDriftFeedback(player, t);
    }

    arenaP.drawObstacles(ctx, arena, t);
    for (const p of (run && run.projectiles) || []) drawProjectile(ctx, p, t, frame);
    fx.drawAir(ctx);
    arenaP.drawVignette(ctx);
    fx.drawSlowmo(ctx);
    ctx.restore();
  }

  // 漂移持续火花 + 轮胎印（渲染层表现，不写逻辑值）
  function drawDriftFeedback(k) {
    if (k.dead || !k.drift || !k.drift.active) return;
    const sp = Math.abs(k.speed || 0);
    if (sp < 90) return;
    const charge = k.drift.charge || 0;
    const color = charge >= 0.7 ? PALETTE.blu : charge >= 0.35 ? PALETTE.gold : PALETTE.boost;
    const ca = Math.cos(k.angle);
    const sa = Math.sin(k.angle);
    for (const side of [-1, 1]) {
      if (Math.random() < 0.4) {
        const wx = k.x - ca * 16 - sa * 11 * side;
        const wy = k.y - sa * 16 + ca * 11 * side;
        fx.burst(wx, wy, {
          count: 1, shape: 'spark', color,
          dir: k.angle + Math.PI + (Math.random() - 0.5) * 1.2, spread: 0.6,
          speed0: 60, speed1: 190, life0: 0.12, life1: 0.3, size: 6,
        });
        if (Math.random() < 0.5) fx.mark(wx, wy, k.angle, 13);
      }
    }
  }

  function update(dt) {
    fx.update(dt);
  }

  function clearEffects() {
    fx.clear();
    kartP.clearState();
  }

  return {
    resize,
    event,
    update,
    draw,
    clearEffects,
    debug: {
      particles: () => fx.countParticles(),
      shake: () => Math.round(fx.shakeMag() * 10) / 10,
    },
  };
}
