// ai.js — Enemy FSM + Boss. All enemies use ragdoll body physics.
import { CONFIG, WORLD, STEP } from '../../config/game.config.js';
import { ENEMIES, ACT_SCALE } from '../../config/enemies.js';
import { ENEMY_SHOTS } from '../../config/weapons.js';
import {
  moveBody, stepPhysics, aimBody, getGunDir, isGrounded,
  applyImpulse, setBodyPos,
} from './ragdoll.js';

export function createAI(type, rngFn) {
  const def = ENEMIES[type];
  return {
    type, def,
    state: 'idle',
    timer: 0,
    fireCd: (def.fireCd || 1.5) * (0.8 + rngFn() * 0.4),
    chargeT: 0,
    telegraph: 0,
    wipeCd: def.wipeCd || 4.2,
    wipeTimer: 0,
    stuckT: 0,
    lastX: 0,
    bossPhase: 0,
    bossChargeDir: 0,
    bossStunT: 0,
    bossShootT: 3.5,
    bossWipeT: 7,
    bossRainT: 2.2,
    rng: rngFn,
  };
}

export function stepAI(ai, enemy, player, sim, dt) {
  const actions = [];
  if (enemy.dead || enemy.dying) return actions;
  const def = ai.def;
  const scale = ACT_SCALE[sim.actIndex] || ACT_SCALE[0];
  const px = player.body.pts[2].x;
  const py = player.body.pts[2].y;
  const ex = enemy.body.pts[2].x;
  const ey = enemy.body.pts[2].y;
  const dir = Math.sign(px - ex) || 1;
  enemy.facing = dir;
  const dist = Math.hypot(px - ex, py - ey);

  switch (def.behavior) {
    case 'chase': chaseAI(ai, enemy, player, dir, dist, dt, scale, actions); break;
    case 'kite': kiteAI(ai, enemy, player, dir, dist, dt, scale, actions); break;
    case 'snipe': snipeAI(ai, enemy, player, dir, dist, dt, scale, actions); break;
    case 'tank': tankAI(ai, enemy, player, dir, dist, dt, scale, actions); break;
    case 'eraser': eraserAI(ai, enemy, player, dir, dist, dt, scale, actions); break;
    case 'boss': bossAI(ai, enemy, player, sim, dir, dist, dt, scale, actions); break;
  }

  if (def.floating) {
    floatUpdate(enemy, ai, dt);
  } else {
    stepPhysics(enemy.body, sim.map, dt);
  }
  enemy.x = enemy.body.pts[2].x;
  enemy.y = enemy.body.pts[2].y;
  enemy.px = enemy.body.pts[2].px;
  enemy.py = enemy.body.pts[2].py;

  if (Math.abs(enemy.body.pts[2].x - ai.lastX) < 0.3 && isGrounded(enemy.body) && !def.floating) {
    ai.stuckT += dt;
    if (ai.stuckT > 1.5) {
      applyImpulse(enemy.body, -dir * 350, -550, 1);
      ai.stuckT = 0;
    }
  } else {
    ai.stuckT = 0;
  }
  ai.lastX = enemy.body.pts[2].x;

  if (enemy.invuln > 0) enemy.invuln -= dt;
  if (enemy.anim.spawn > 0) enemy.anim.spawn -= dt;
  if (enemy.hitFlash > 0) enemy.hitFlash = Math.max(0, enemy.hitFlash - dt * 4);
  enemy.anim.telegraph = ai.telegraph > 0 ? Math.min(1, ai.telegraph / 0.38) : 0;
  ai.timer += dt;
  return actions;
}

function chaseAI(ai, enemy, player, dir, dist, dt, scale, actions) {
  const wobble = Math.sin(ai.timer * 4) * (ai.def.wobble || 1);
  moveBody(enemy.body, dir + wobble * 0.2, dt);
  if (isGrounded(enemy.body) && dist < 150 && ai.rng() < 0.015) {
    applyImpulse(enemy.body, dir * 50, -450, 1);
  }
  if (dist < (enemy.r + 24) && !player.dead && player.invuln <= 0) {
    const cd = enemy._contactCd || 0;
    if (cd <= 0) {
      enemy._contactCd = ai.def.contactCd || 0.85;
      actions.push({ kind: 'contact', dmg: ai.def.contactDmg * scale.dmg, target: player });
    }
  }
  if (enemy._contactCd > 0) enemy._contactCd -= dt;
}

function kiteAI(ai, enemy, player, dir, dist, dt, scale, actions) {
  const [keepMin, keepMax] = ai.def.keep || [300, 430];
  let walkx = 0;
  if (dist < keepMin * 0.8) walkx = -dir;
  else if (dist > keepMax) walkx = dir;
  else walkx = -dir * 0.3;
  moveBody(enemy.body, walkx, dt);

  ai.fireCd -= dt;
  if (ai.state === 'idle' && ai.fireCd <= 0 && dist < keepMax + 120) {
    ai.state = 'aiming';
    ai.telegraph = ai.def.telegraph || 0.38;
  }
  if (ai.state === 'aiming') {
    aimBody(enemy.body, player.body.pts[0].x, player.body.pts[0].y, 0.4);
    ai.telegraph -= dt;
    if (ai.telegraph <= 0) {
      ai.state = 'idle';
      ai.fireCd = (ai.def.fireCd || 1.5) * (0.8 + ai.rng() * 0.4);
      ai.telegraph = 0;
      actions.push({ kind: 'shoot', shooter: enemy });
    }
  }
}

function snipeAI(ai, enemy, player, dir, dist, dt, scale, actions) {
  const [keepMin, keepMax] = ai.def.keep || [470, 650];
  let walkx = 0;
  if (dist < keepMin) walkx = -dir * 0.6;
  else if (dist > keepMax) walkx = dir * 0.6;
  moveBody(enemy.body, walkx, dt);

  ai.fireCd -= dt;
  if (ai.state === 'idle' && ai.fireCd <= 0) {
    ai.state = 'charging';
    ai.chargeT = ai.def.charge || 1.05;
    ai.telegraph = ai.chargeT;
  }
  if (ai.state === 'charging') {
    ai.telegraph -= dt;
    ai.chargeT -= dt;
    aimBody(enemy.body, player.body.pts[0].x, player.body.pts[0].y, 0.15);
    if (ai.chargeT <= 0) {
      ai.state = 'beam';
      ai.telegraph = 0;
      ai.wipeTimer = ai.def.beamTime || 0.2;
    }
  }
  if (ai.state === 'beam') {
    ai.wipeTimer -= dt;
    if (ai.wipeTimer <= 0) {
      ai.state = 'idle';
      ai.fireCd = (ai.def.fireCd || 2.9) * (0.8 + ai.rng() * 0.4);
      actions.push({ kind: 'beam', shooter: enemy });
    }
  }
}

function tankAI(ai, enemy, player, dir, dist, dt, scale, actions) {
  moveBody(enemy.body, dir * 0.5, dt);
  if (dist < (enemy.r + 24) && !player.dead && player.invuln <= 0) {
    const cd = enemy._contactCd || 0;
    if (cd <= 0) {
      enemy._contactCd = ai.def.contactCd || 0.7;
      actions.push({ kind: 'contact', dmg: ai.def.contactDmg * scale.dmg, target: player });
    }
  }
  if (enemy._contactCd > 0) enemy._contactCd -= dt;
}

function eraserAI(ai, enemy, player, dir, dist, dt, scale, actions) {
  const targetX = player.body.pts[2].x + player.body.pts[2].vx * 0.5;
  const dx = targetX - enemy.body.pts[2].x;
  const moveDir = Math.abs(dx) > 60 ? Math.sign(dx) : 0;
  moveBody(enemy.body, moveDir * 0.6, dt);

  ai.wipeCd -= dt;
  if (ai.state === 'idle' && ai.wipeCd <= 0) {
    ai.state = 'winding';
    ai.wipeTimer = 0.4;
  }
  if (ai.state === 'winding') {
    ai.wipeTimer -= dt;
    ai.telegraph = 1 - ai.wipeTimer / 0.4;
    if (ai.wipeTimer <= 0) {
      ai.state = 'wiping';
      ai.wipeTimer = ai.def.wipeTime || 0.55;
      ai.telegraph = 0;
    }
  }
  if (dist < (enemy.r + 24) && !player.dead && player.invuln <= 0) {
    const cd = enemy._contactCd || 0;
    if (cd <= 0) {
      enemy._contactCd = ai.def.contactCd || 0.6;
      actions.push({ kind: 'contact', dmg: ai.def.contactDmg * scale.dmg, target: player });
    }
  }
  if (enemy._contactCd > 0) enemy._contactCd -= dt;
}

function bossAI(ai, enemy, player, sim, dir, dist, dt, scale, actions) {
  const def = ai.def;
  const hpRatio = enemy.hp / enemy.maxHp;
  let phase = 1;
  if (hpRatio <= 0.33) phase = 3;
  else if (hpRatio <= 0.66) phase = 2;

  if (phase !== ai.bossPhase) {
    ai.bossPhase = phase;
    ai.state = 'idle';
    ai.bossStunT = 0;
    actions.push({ kind: 'bossPhase', phase, nameKey: def.phases[phase - 1]?.nameKey });
  }

  if (ai.bossStunT > 0) {
    ai.bossStunT -= dt;
    for (const p of enemy.body.pts) {
      p.x += (ai.rng() - 0.5) * 2;
      p.y += (ai.rng() - 0.5) * 2;
    }
    return;
  }

  if (phase === 1) bossP1(ai, enemy, player, sim, dir, dist, dt, scale, actions);
  else if (phase === 2) bossP2(ai, enemy, player, sim, dir, dist, dt, scale, actions);
  else bossP3(ai, enemy, player, sim, dir, dist, dt, scale, actions);

  if (dist < (enemy.r + 24) && !player.dead && player.invuln <= 0) {
    const cd = enemy._contactCd || 0;
    if (cd <= 0) {
      enemy._contactCd = def.contactCd || 0.9;
      actions.push({ kind: 'contact', dmg: def.contactDmg * scale.dmg, target: player });
    }
  }
  if (enemy._contactCd > 0) enemy._contactCd -= dt;
}

function bossP1(ai, enemy, player, sim, dir, dist, dt, scale, actions) {
  const drift = Math.sin(ai.timer * 0.8) * 80;
  enemy.body.pts[2].vx += drift * dt;
  enemy.body.pts[2].vy = Math.sin(ai.timer * 1.2) * 20;

  ai.bossShootT -= dt;
  if (ai.bossShootT <= 0) {
    ai.bossShootT = 3.5;
    actions.push({ kind: 'bossShoot', pattern: 'triple', shooter: enemy });
  }
  ai.bossWipeT -= dt;
  if (ai.bossWipeT <= 0) {
    ai.bossWipeT = 7;
    actions.push({ kind: 'bossShoot', pattern: 'ground_wipe', shooter: enemy });
  }
}

function bossP2(ai, enemy, player, sim, dir, dist, dt, scale, actions) {
  if (ai.state === 'idle') {
    ai.state = 'charging';
    ai.chargeT = 1.2;
    ai.bossChargeDir = dir;
  }
  if (ai.state === 'charging') {
    for (const p of enemy.body.pts) {
      p.x += (ai.rng() - 0.5) * 4;
      p.y += (ai.rng() - 0.5) * 4;
    }
    ai.chargeT -= dt;
    if (ai.chargeT <= 0) {
      ai.state = 'rush';
    }
  }
  if (ai.state === 'rush') {
    enemy.body.pts[2].vx = ai.bossChargeDir * 900;
    const ex = enemy.body.pts[2].x;
    if (ex < 80 || ex > WORLD.w - 80) {
      ai.state = 'stunned';
      ai.bossStunT = 2.5;
      enemy.body.pts[2].vx = 0;
      actions.push({ kind: 'bossCharge', dir: ai.bossChargeDir, shooter: enemy });
    }
  }
}

function bossP3(ai, enemy, player, sim, dir, dist, dt, scale, actions) {
  const drift = Math.sin(ai.timer * 0.5) * 50;
  enemy.body.pts[2].vx += drift * dt;
  enemy.body.pts[2].vy = Math.sin(ai.timer * 0.7) * 15;

  ai.bossRainT -= dt;
  if (ai.bossRainT <= 0) {
    ai.bossRainT = 2.2;
    actions.push({ kind: 'bossShoot', pattern: 'rain', shooter: enemy });
  }
}

function floatUpdate(enemy, ai, dt) {
  const pts = enemy.body.pts;
  for (let i = 0; i < 11; i++) {
    pts[i].vy *= 0.9;
    pts[i].vy += Math.sin(ai.timer * 2 + i * 0.3) * 5;
  }
  const targetY = enemy._floatY || 300;
  const cy = pts[2].y;
  const dy = (targetY - cy) * 0.03;
  for (const p of pts) p.y += dy;
}

export function getEnemyShot(ai, enemy, player) {
  const shotType = ai.def.shot || ai.type;
  const shotDef = ENEMY_SHOTS[shotType];
  if (!shotDef) return null;
  const hand = enemy.body.pts[6];
  const head = player.body.pts[0];
  const dx = head.x - hand.x;
  const dy = head.y - hand.y;
  const d = Math.hypot(dx, dy) || 1;
  const spread = (ai.rng() - 0.5) * 0.08;
  const cos = Math.cos(spread), sin = Math.sin(spread);
  const ldx = (dx / d) * cos - (dy / d) * sin;
  const ldy = (dx / d) * sin + (dy / d) * cos;
  return {
    x: hand.x + ldx * 8,
    y: hand.y + ldy * 8,
    dx: ldx,
    dy: ldy,
    speed: shotDef.speed,
    dmg: shotDef.dmg,
    r: shotDef.radius,
    life: shotDef.life,
    color: shotDef.color,
    owner: 'enemy',
    beam: shotDef.beam || false,
    pierce: 1,
    splash: 0,
  };
}

export function getBeam(ai, enemy, player) {
  const hand = enemy.body.pts[6];
  const head = player.body.pts[0];
  const dx = head.x - hand.x;
  const dy = head.y - hand.y;
  const d = Math.hypot(dx, dy) || 1;
  return {
    x: hand.x, y: hand.y,
    dx: dx / d, dy: dy / d,
    length: 800,
    dmg: (ENEMY_SHOTS.compass?.dmg || 26),
    width: 18,
    owner: 'enemy',
  };
}
