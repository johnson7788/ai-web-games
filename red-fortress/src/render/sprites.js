import { SHARED } from '../../config/palette.js';

const TAU = Math.PI * 2;

function box(ctx, color, x, y, w, h) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

function line(ctx, color, width, x1, y1, x2, y2) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.beginPath();
  ctx.moveTo(Math.round(x1), Math.round(y1));
  ctx.lineTo(Math.round(x2), Math.round(y2));
  ctx.stroke();
}

function polygon(ctx, color, points) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(points[0][0], points[0][1]);
  for (let i = 1; i < points.length; i += 1) ctx.lineTo(points[i][0], points[i][1]);
  ctx.closePath();
  ctx.fill();
}

function shadow(ctx, rx, ry) {
  ctx.save();
  ctx.globalAlpha = 0.32;
  ctx.fillStyle = SHARED.black;
  ctx.beginPath();
  ctx.ellipse(3, 8, rx, ry, 0, 0, TAU);
  ctx.fill();
  ctx.restore();
}

function health(ctx, entity, width = 34) {
  if (!entity.maxHp || entity.hp >= entity.maxHp || entity.hp <= 0) return;
  const ratio = Math.max(0, entity.hp / entity.maxHp);
  box(ctx, SHARED.enemyDark, -width / 2 - 2, -34, width + 4, 6);
  box(ctx, ratio > 0.35 ? SHARED.hp : SHARED.hpLow, -width / 2, -32, width * ratio, 2);
}

function muzzle(ctx, color, x, y, scale = 1) {
  polygon(ctx, color, [[x, y], [x + 18 * scale, y - 7 * scale], [x + 13 * scale, y], [x + 19 * scale, y + 6 * scale]]);
  box(ctx, SHARED.bulletCore, x + 2, y - 2 * scale, 8 * scale, 4 * scale);
}

function drawWheels(ctx, speed, t, scale = 1) {
  const tread = Math.floor(t * Math.min(18, Math.abs(speed) * 0.08)) % 3;
  for (const x of [-17, 15]) {
    for (const y of [-18, 18]) {
      box(ctx, SHARED.playerDark, (x - 9) * scale, (y - 5) * scale, 18 * scale, 10 * scale);
      box(ctx, SHARED.playerBody2, (x - 6 + tread * 4) * scale, (y - 5) * scale, 3 * scale, 10 * scale);
    }
  }
}

export function drawPlayer(ctx, p, t) {
  if (p.invuln > 0 && Math.floor(t * 18) % 2 === 0) return;
  const speed = Math.hypot(p.vx || 0, p.vy || 0);
  ctx.save();
  ctx.translate(Math.round(p.x), Math.round(p.y));

  ctx.save();
  ctx.rotate(p.hullAngle ?? p.angle ?? -Math.PI / 2);
  shadow(ctx, 31, 23);
  ctx.save();
  ctx.globalAlpha = 0.09;
  polygon(ctx, SHARED.glass, [[20, -11], [118, -43], [118, 43], [20, 11]]);
  ctx.restore();
  drawWheels(ctx, speed, t);
  polygon(ctx, SHARED.playerBody2, [[30, 0], [18, -15], [-20, -18], [-29, -10], [-29, 10], [-20, 18], [18, 15]]);
  polygon(ctx, SHARED.playerBody, [[27, 0], [15, -11], [-18, -13], [-24, -7], [-24, 7], [-18, 13], [15, 11]]);
  box(ctx, SHARED.playerDark, -18, -9, 13, 18);
  box(ctx, SHARED.glass, 1, -10, 12, 20);
  box(ctx, SHARED.playerBody2, 4, -7, 3, 14);
  box(ctx, SHARED.playerDark, -23, -4, 7, 8);
  box(ctx, SHARED.playerAccent, -14, -16, 16, 3);
  box(ctx, SHARED.glass, 20, -11, 7, 6);
  box(ctx, SHARED.glass, 20, 5, 7, 6);
  box(ctx, SHARED.playerDark, -29, -14, 4, 28);
  ctx.restore();

  ctx.save();
  ctx.rotate(p.angle ?? -Math.PI / 2);
  const recoil = p.fireCd > 0.075 ? 4 : 0;
  box(ctx, SHARED.playerDark, 3 - recoil, -4, 40, 8);
  box(ctx, SHARED.playerBody2, 8 - recoil, -2, 33, 4);
  box(ctx, SHARED.playerDark, 37 - recoil, -6, 9, 12);
  ctx.fillStyle = SHARED.playerAccent;
  ctx.beginPath();
  ctx.arc(0, 0, 14, 0, TAU);
  ctx.fill();
  ctx.fillStyle = SHARED.playerTurret;
  ctx.beginPath();
  ctx.arc(0, 0, 10, 0, TAU);
  ctx.fill();
  box(ctx, SHARED.playerBody, -3, -7, 7, 6);
  if (p.fireCd > 0.075) muzzle(ctx, SHARED.playerAccent, 45 - recoil, 0, 0.8);
  ctx.restore();

  if (p.hp <= Math.max(1, p.maxHp * 0.34)) {
    ctx.save();
    ctx.globalAlpha = 0.48;
    const rise = (t * 24) % 28;
    box(ctx, SHARED.smoke, -18 - rise * 0.3, -24 - rise, 13 + rise * 0.25, 13 + rise * 0.25);
    box(ctx, SHARED.smoke, -8, -36 - rise * 0.6, 10, 10);
    ctx.restore();
  }
  ctx.restore();
}

function drawRifle(ctx, e, t, rocket = false) {
  const step = Math.sin(t * 9 + (e.id || 0)) * 3;
  shadow(ctx, 13, 8);
  line(ctx, SHARED.enemyDark, 5, -6, 5, -9 + step, 15);
  line(ctx, SHARED.enemyDark, 5, 6, 5, 9 - step, 15);
  box(ctx, SHARED.enemy2, -8, -10, 17, 20);
  box(ctx, SHARED.enemy, -5, -13, 13, 20);
  box(ctx, SHARED.enemyAccent, -7, -12, 4, 17);
  ctx.fillStyle = SHARED.enemyDark;
  ctx.beginPath();
  ctx.arc(1, 0, 9, Math.PI, TAU);
  ctx.fill();
  box(ctx, SHARED.enemy, -8, -3, 18, 5);
  if (rocket) {
    box(ctx, SHARED.enemyDark, -11, -15, 37, 9);
    box(ctx, SHARED.enemy2, -5, -13, 24, 3);
    polygon(ctx, SHARED.enemyAccent, [[26, -15], [35, -10], [26, -6]]);
    if (e.state === 'fire') muzzle(ctx, SHARED.enemyAccent, 29, -10, 0.7);
  } else {
    line(ctx, SHARED.enemyDark, 4, 1, -2, 27, 0);
    line(ctx, SHARED.enemyAccent, 2, 8, 0, 23, 0);
    if (e.state === 'fire') muzzle(ctx, SHARED.enemyAccent, 27, 0, 0.55);
  }
  health(ctx, e);
}

function drawTank(ctx, e, t, pal, boss = false) {
  const s = boss ? 1.45 : 1;
  ctx.scale(s, s);
  shadow(ctx, 30, 25);
  const tread = Math.floor(t * 8 + (e.id || 0)) % 3;
  for (const y of [-23, 15]) {
    box(ctx, SHARED.enemyDark, -27, y, 51, 9);
    for (let x = -23; x < 22; x += 9) box(ctx, pal.rockAlt, x + tread * 2, y + 2, 4, 5);
  }
  polygon(ctx, SHARED.enemy2, [[26, 0], [15, -16], [-23, -16], [-29, -9], [-29, 9], [-23, 16], [15, 16]]);
  box(ctx, SHARED.enemy, -17, -12, 32, 24);
  box(ctx, SHARED.enemyAccent, -20, -12, 5, 24);
  if (boss) {
    box(ctx, pal.rockAlt, -8, -17, 14, 4);
    box(ctx, pal.accent, -25, -19, 8, 5);
    box(ctx, pal.accent, -25, 14, 8, 5);
  }
  const recoil = e.state === 'fire' ? 5 : 0;
  box(ctx, SHARED.enemyDark, 3 - recoil, -4, boss ? 43 : 35, 8);
  box(ctx, pal.rockAlt, 8 - recoil, -2, boss ? 35 : 27, 3);
  ctx.fillStyle = SHARED.enemyDark;
  ctx.beginPath();
  ctx.arc(0, 0, boss ? 13 : 11, 0, TAU);
  ctx.fill();
  ctx.fillStyle = SHARED.enemy;
  ctx.beginPath();
  ctx.arc(0, 0, boss ? 9 : 7, 0, TAU);
  ctx.fill();
  if (e.state === 'fire') muzzle(ctx, SHARED.enemyAccent, boss ? 46 : 38, 0, 1);
  health(ctx, e, boss ? 44 : 34);
}

function drawTurret(ctx, e, pal) {
  shadow(ctx, 24, 17);
  ctx.fillStyle = pal.sandbag;
  ctx.beginPath();
  ctx.arc(0, 0, 23, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = pal.sandbagAlt;
  ctx.lineWidth = 6;
  ctx.setLineDash([10, 5]);
  ctx.beginPath();
  ctx.arc(0, 0, 19, 0, TAU);
  ctx.stroke();
  ctx.setLineDash([]);
  box(ctx, SHARED.enemyDark, -11, -11, 22, 22);
  box(ctx, SHARED.enemy, -8, -8, 16, 16);
  box(ctx, SHARED.enemyDark, 2, -3, 32, 6);
  box(ctx, SHARED.enemyAccent, 25, -2, 9, 4);
  if (e.state === 'fire') muzzle(ctx, SHARED.enemyAccent, 34, 0, 0.65);
  health(ctx, e);
}

function drawMortar(ctx, e, pal) {
  shadow(ctx, 20, 15);
  box(ctx, SHARED.enemyDark, -18, -13, 30, 26);
  box(ctx, pal.rockAlt, -14, -9, 22, 18);
  line(ctx, SHARED.enemy2, 9, -13, 11, 13, -16);
  line(ctx, SHARED.enemyDark, 12, -2, 0, 24, -17);
  box(ctx, SHARED.enemyAccent, 20, -21, 9, 7);
  line(ctx, SHARED.enemyDark, 5, -10, 5, -20, 18);
  line(ctx, SHARED.enemyDark, 5, 3, 7, 15, 20);
  health(ctx, e);
}

function drawMine(ctx, e, t) {
  shadow(ctx, 13, 8);
  for (let i = 0; i < 3; i += 1) {
    const a = i * TAU / 3;
    line(ctx, SHARED.enemyDark, 3, Math.cos(a) * 6, Math.sin(a) * 6, Math.cos(a) * 17, Math.sin(a) * 17);
  }
  ctx.fillStyle = SHARED.enemyDark;
  ctx.beginPath();
  ctx.arc(0, 0, 12, 0, TAU);
  ctx.fill();
  ctx.fillStyle = SHARED.enemy2;
  ctx.beginPath();
  ctx.arc(0, 0, 8, 0, TAU);
  ctx.fill();
  if (Math.floor(t * 5 + (e.id || 0)) % 2 === 0 || e.state === 'fuse') box(ctx, SHARED.enemyAccent, -3, -3, 6, 6);
}

function drawPow(ctx, e, t) {
  const wave = Math.sin(t * 7 + (e.t || 0) + (e.id || 0)) * 5;
  const follow = e.state === 'follow' || e.state === 'deliver';
  shadow(ctx, 8, 5);
  if (follow) {
    ctx.save();
    ctx.globalAlpha = 0.35;
    box(ctx, SHARED.powder, -12, 9, 6, 3);
    box(ctx, SHARED.powder, 7, 11, 8, 3);
    ctx.restore();
  }
  line(ctx, SHARED.powDark, 4, -5, 5, -7, 15);
  line(ctx, SHARED.powDark, 4, 4, 5, 7, 15);
  box(ctx, SHARED.pow, -6, -7, 12, 17);
  box(ctx, SHARED.powder, -4, -15, 9, 9);
  line(ctx, SHARED.pow, 4, -2, -4, -13, -13 - wave);
  line(ctx, SHARED.pow, 4, 2, -4, 12, -9 + wave);
  if (!follow) {
    box(ctx, SHARED.pow, -2, -31, 4, 12);
    box(ctx, SHARED.pow, -2, -16, 4, 4);
  }
}

function drawBullet(ctx, e) {
  const angle = e.angle ?? Math.atan2(e.vy || 0, e.vx || 1);
  ctx.save();
  ctx.translate(Math.round(e.x), Math.round(e.y));
  ctx.rotate(angle);
  const player = e.owner === 'player';
  const core = player ? SHARED.bulletCore : SHARED.bulletEnemyCore;
  const color = player ? SHARED.bulletPlayer : SHARED.bulletEnemy;
  if (e.weapon === 'rocket') {
    ctx.save();
    ctx.globalAlpha = 0.45;
    box(ctx, SHARED.smoke, -30, -6, 21, 12);
    ctx.restore();
    box(ctx, SHARED.enemyDark, -12, -5, 22, 10);
    polygon(ctx, color, [[16, 0], [8, -6], [8, 6]]);
    box(ctx, SHARED.enemyAccent, -17, -3, 8, 6);
  } else if (e.weapon === 'cannon' || e.weapon === 'tank') {
    ctx.save();
    ctx.globalAlpha = 0.25;
    box(ctx, color, -25, -7, 28, 14);
    ctx.restore();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(0, 0, 7, 0, TAU);
    ctx.fill();
    box(ctx, core, -2, -3, 7, 6);
  } else if (e.weapon === 'mortar') {
    ctx.fillStyle = SHARED.enemyDark;
    ctx.beginPath();
    ctx.arc(0, -((e.z || 0) * 70), 8, 0, TAU);
    ctx.fill();
  } else {
    const length = player ? 28 : 19;
    ctx.save();
    ctx.globalAlpha = 0.28;
    box(ctx, color, -length, -4, length, 8);
    ctx.restore();
    box(ctx, color, -length, -2, length, 4);
    box(ctx, core, -5, -1, 12, 2);
  }
  ctx.restore();

  if (e.weapon === 'mortar' && e.landX != null) {
    ctx.save();
    ctx.strokeStyle = SHARED.enemyAccent;
    ctx.globalAlpha = 0.65;
    ctx.lineWidth = 3;
    ctx.setLineDash([8, 7]);
    ctx.beginPath();
    ctx.arc(e.landX, e.landY, 28 + (e.life || 0) * 12, 0, TAU);
    ctx.stroke();
    ctx.restore();
  }
}

function drawGrenade(ctx, e, t) {
  const lift = Math.max(0, e.z || 0) * 82;
  ctx.save();
  ctx.globalAlpha = 0.3;
  ctx.fillStyle = SHARED.black;
  ctx.beginPath();
  ctx.ellipse(e.x, e.y, 10 - lift * 0.04, 6 - lift * 0.02, 0, 0, TAU);
  ctx.fill();
  ctx.restore();
  if (e.landX != null) {
    ctx.save();
    ctx.strokeStyle = SHARED.playerAccent;
    ctx.globalAlpha = 0.65;
    ctx.lineWidth = 2;
    ctx.setLineDash([7, 7]);
    ctx.beginPath();
    ctx.arc(e.landX, e.landY, 22 + Math.sin(t * 8) * 3, 0, TAU);
    ctx.stroke();
    ctx.restore();
  }
  ctx.save();
  ctx.translate(e.x, e.y - lift);
  ctx.rotate(t * 11 + (e.id || 0));
  box(ctx, SHARED.playerDark, -7, -7, 14, 14);
  box(ctx, SHARED.playerBody2, -4, -5, 8, 9);
  box(ctx, SHARED.playerAccent, 1, -11, 7, 4);
  ctx.restore();
}

function drawPickup(ctx, e, t) {
  ctx.save();
  ctx.translate(e.x, e.y - 4 - Math.sin(t * 4 + (e.id || 0)) * 3);
  shadow(ctx, 12, 7);
  box(ctx, SHARED.playerDark, -13, -11, 26, 22);
  box(ctx, SHARED.playerAccent, -10, -8, 20, 16);
  box(ctx, SHARED.playerBody, -3, -6, 6, 12);
  box(ctx, SHARED.playerBody, -7, -2, 14, 5);
  ctx.restore();
}

export function drawEntity(ctx, e, t, pal) {
  if (e.dead) return;
  if (e.kind === 'bullet') {
    drawBullet(ctx, e);
    return;
  }
  if (e.kind === 'grenade') {
    drawGrenade(ctx, e, t);
    return;
  }
  ctx.save();
  ctx.translate(Math.round(e.x), Math.round(e.y));
  if (e.kind === 'pow') drawPow(ctx, e, t);
  else if (e.kind === 'pickup') drawPickup(ctx, e, t);
  else {
    ctx.rotate(e.angle || 0);
    if (e.type === 'rifle') drawRifle(ctx, e, t, false);
    else if (e.type === 'rocket') drawRifle(ctx, e, t, true);
    else if (e.type === 'tank') drawTank(ctx, e, t, pal, false);
    else if (e.type === 'tankboss') drawTank(ctx, e, t, pal, true);
    else if (e.type === 'turret') drawTurret(ctx, e, pal);
    else if (e.type === 'mortar') drawMortar(ctx, e, pal);
    else if (e.type === 'mine') drawMine(ctx, e, t);
    else drawRifle(ctx, e, t, false);
  }
  ctx.restore();
}

export function drawBoss(ctx, boss, pal, t) {
  if (!boss) return;
  const x = boss.x;
  const y = boss.y;
  const w = boss.w || 520;
  const h = boss.h || 300;
  ctx.save();
  shadow(ctx, w * 0.45, 35);
  box(ctx, pal.deep, x - w / 2 - 12, y - h / 2 - 8, w + 24, h + 22);
  box(ctx, pal.rock, x - w / 2, y - h / 2, w, h);
  box(ctx, pal.rockAlt, x - w / 2 + 8, y - h / 2 + 8, w - 16, 18);
  for (let bx = x - w / 2 + 20; bx < x + w / 2 - 20; bx += 54) {
    box(ctx, pal.deep, bx, y - h / 2 + 42, 5, h - 58);
    box(ctx, pal.ground2, bx + 9, y + h / 2 - 45, 30, 6);
  }
  box(ctx, pal.accent, x - w / 2, y - h / 2 + 30, w, 5);

  for (const node of boss.nodes || []) {
    ctx.save();
    ctx.translate(node.x, node.y);
    ctx.rotate(node.angle || 0);
    ctx.fillStyle = node.alive === false || node.hp <= 0 ? pal.deep : SHARED.enemyDark;
    ctx.beginPath();
    ctx.arc(0, 0, 31, 0, TAU);
    ctx.fill();
    ctx.fillStyle = node.alive === false || node.hp <= 0 ? pal.rock : SHARED.enemy;
    ctx.beginPath();
    ctx.arc(0, 0, 22, 0, TAU);
    ctx.fill();
    if (node.alive !== false && node.hp > 0) {
      box(ctx, SHARED.enemyDark, 4, -6, 43, 12);
      box(ctx, SHARED.enemyAccent, 35, -3, 14, 6);
      health(ctx, node, 38);
    } else {
      box(ctx, SHARED.smoke, -8, -9, 16, 17);
    }
    ctx.restore();
  }

  const core = boss.core || { x, y, r: 54, hp: boss.hp, maxHp: boss.maxHp };
  ctx.save();
  ctx.translate(core.x, core.y);
  ctx.fillStyle = pal.deep;
  ctx.beginPath();
  ctx.arc(0, 0, core.r + 16, 0, TAU);
  ctx.fill();
  const overloading = boss.shield <= 0 || boss.phase > 1;
  ctx.fillStyle = overloading && Math.floor(t * 8) % 2 === 0 ? pal.accent : SHARED.enemy2;
  ctx.beginPath();
  ctx.arc(0, 0, core.r, 0, TAU);
  ctx.fill();
  ctx.fillStyle = overloading ? SHARED.enemyAccent : pal.glow;
  ctx.beginPath();
  ctx.arc(0, 0, core.r * 0.48, 0, TAU);
  ctx.fill();
  box(ctx, SHARED.bulletCore, -8, -20, 16, 40);
  box(ctx, SHARED.bulletCore, -20, -8, 40, 16);
  if (boss.shield > 0) {
    ctx.strokeStyle = pal.accent;
    ctx.globalAlpha = 0.45 + Math.sin(t * 3) * 0.12;
    ctx.lineWidth = 5;
    for (let i = 0; i < 2; i += 1) {
      const radius = core.r + 26 + i * 15 + Math.sin(t * 2 + i) * 4;
      ctx.beginPath();
      for (let j = 0; j <= 6; j += 1) {
        const a = j * TAU / 6 + t * 0.15;
        const px = Math.cos(a) * radius;
        const py = Math.sin(a) * radius;
        if (j === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
    }
  }
  ctx.restore();
  ctx.restore();
}

export function drawHelicopter(ctx, heli, t) {
  ctx.save();
  ctx.translate(heli.x, heli.y - (heli.z || 90));
  ctx.rotate(heli.angle || 0);
  ctx.save();
  ctx.globalAlpha = 0.22;
  ctx.fillStyle = SHARED.black;
  ctx.beginPath();
  ctx.ellipse(10, 95, 66, 20, 0, 0, TAU);
  ctx.fill();
  ctx.restore();
  box(ctx, SHARED.heliDark, -65, -6, 85, 12);
  polygon(ctx, SHARED.heliDark, [[-93, -4], [-64, -14], [-58, 14], [-93, 5]]);
  polygon(ctx, SHARED.heli, [[-24, -21], [26, -19], [51, -5], [42, 18], [-21, 22], [-40, 8]]);
  polygon(ctx, SHARED.glass, [[23, -14], [43, -4], [34, 5], [17, 3]]);
  box(ctx, SHARED.heliDark, -12, -14, 23, 30);
  box(ctx, SHARED.pow, -9, -10, 4, 22);
  line(ctx, SHARED.heliDark, 5, -20, 16, -39, 29);
  line(ctx, SHARED.heliDark, 5, 17, 18, 38, 29);
  ctx.save();
  ctx.globalAlpha = 0.38;
  ctx.fillStyle = SHARED.heli;
  ctx.beginPath();
  ctx.ellipse(0, -22, 90, 9, Math.sin(t * 30) * 0.08, 0, TAU);
  ctx.fill();
  ctx.restore();
  line(ctx, SHARED.heli, 3, -89, -22, 89, -22);
  line(ctx, SHARED.heliDark, 4, -70, 0, -82, 0);
  if (heli.doorOpen) box(ctx, SHARED.gold, -17, 18, 30, 4);
  ctx.restore();
}
