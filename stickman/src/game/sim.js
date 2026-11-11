// sim.js — Full game simulation. createRun / step / combat / drops.
// Pure logic, no DOM. All values from config.
import { CONFIG, WORLD, STEP } from '../../config/game.config.js';
import { MAPS, MAP_ORDER } from '../../config/maps.js';
import { WEAPONS, WEAPON_ORDER, ENEMY_SHOTS } from '../../config/weapons.js';
import { ENEMIES, ACT_SCALE } from '../../config/enemies.js';
import { UPGRADES, UPGRADE_BY_ID } from '../../config/upgrades.js';
import {
  createBody, stepPhysics, moveBody, setJumpPose, aimBody,
  getGunDir, getGunTip, applyRecoil, applyImpulse, setBodyPos,
  ragdollDeath, stepRagdoll, updateSink, isGrounded, getBodyCenter,
  PELVIS,
} from './ragdoll.js';
import { stepAI, getEnemyShot, getBeam, createAI } from './ai.js';
import {
  createWaves, startWave, stepWaves, isWaveClear, nextWave,
  spawnBoss, createPickup, generateWaveDrops,
} from './waves.js';

export const POINT_ORDER = [
  'head', 'neck', 'pelvis',
  'elbowL', 'elbowR', 'handL', 'handR',
  'kneeL', 'kneeR', 'footL', 'footR',
];

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
let _nextId = 1;

export function createRun({ actIndex = 0, seed = 1, difficulty = 'normal' } = {}) {
  const rng = mulberry32(seed);
  const diff = CONFIG.difficulty[difficulty] || CONFIG.difficulty.normal;
  const act = CONFIG.acts[actIndex] || CONFIG.acts[0];
  const map = MAPS[act.id];
  const player = createPlayer(map.playerSpawn.x, map.playerSpawn.y);
  const waves = createWaves(actIndex, seed, rng, diff);

  const run = {
    actIndex, waveIndex: 0, actId: act.id, map, rng, difficulty: diff, waves,
    sim: {
      t: 0,
      world: { w: WORLD.w, h: WORLD.h, groundY: WORLD.groundY },
      map, player,
      enemies: [], bullets: [], pickups: [],
      stats: { kills: 0, shots: 0, hits: 0, damage: 0, time: 0, score: 0, combo: 0, inkGained: 0, lore: [] },
      wave: { index: 1, total: act.waves.length, act: actIndex, actTotal: CONFIG.acts.length },
      boss: null,
    },
    events: [],
    state: 'idle',
    _shootCd: 0, _dashT: 0,
    _dashCharges: CONFIG.player.dashCharges,
    _dashRechargeT: 0, _meleeCd: 0, _comboT: 0,
    _regenDelay: 0, _jumpHeld: false,
    _jumpBufferT: 0, _coyoteT: 0,
    _upgradesTaken: [], _mods: {}, _weapons: new Set(['pencil']),
    _weaponDropCd: 0, _loreGiven: new Set(),
    _deadTimer: 0, _introT: CONFIG.wave.introDelay, _clearT: 0,
  };
  run.stats = run.sim.stats;
  // 契约要求 run 自带方法（main.js / 渲染 / 调试都用这套）
  run.step = (input) => step(run, input);
  run.getHud = () => getHud(run);
  run.drainEvents = () => drainEvents(run);
  run.startWave = () => startNextWave(run);
  run.getUpgradeChoices = (n = 3) => getUpgradeChoices(run, n);
  run.applyUpgrade = (id) => applyUpgrade(run, id);
  run.nextAct = () => nextAct(run);
  return run;
}

function createPlayer(x, y) {
  const body = createBody(x, y, 1);
  return {
    id: 'player', kind: 'player', type: 'player',
    x, y, px: x, py: y, vx: 0, vy: 0,
    hp: CONFIG.player.maxInk, maxHp: CONFIG.player.maxInk, r: 26,
    facing: 1, dead: false, dying: false, invuln: 0,
    body,
    gun: { x, y, dx: 1, dy: 0 },
    aim: { x: x + 100, y },
    anim: { walk: 0, hurt: 0, dead: 0, flash: 0, dash: 0, melee: 0, reload: 0, spawn: 0, telegraph: 0 },
    weapon: 'pencil', mag: WEAPONS.pencil.mag, magMax: WEAPONS.pencil.mag,
    mags: { pencil: WEAPONS.pencil.mag, brush: WEAPONS.brush.mag, nib: WEAPONS.nib.mag },
    reloading: false, reloadT: 0, hitFlash: 0,
    walkx: 0, scale: 1, sink: 0, _revives: 0, _dashInvuln: 0,
  };
}

export function step(run, input = {}) {
  const dt = STEP;
  if (run.state === 'dead' || run.state === 'won') return;
  run.sim.t += dt;
  run.stats.time = run.sim.t;

  if (run.state === 'idle') {
    run._introT -= dt;
    if (run._introT <= 0) { run.state = 'fighting'; beginWave(run); }
    stepPlayerPhysics(run, dt);
    return;
  }
  if (run.state === 'clear') {
    run._clearT -= dt;
    stepPlayerPhysics(run, dt);
    stepPickups(run, dt);
    return;
  }

  updateTimers(run, dt);
  stepPlayer(run, input, dt);
  if (!run.sim.player.dead && run.sim.player.hp <= 0) killPlayer(run);
  const spawned = stepWaves(run.waves, run.sim.enemies, dt);
  for (const e of spawned) run.sim.enemies.push(e);
  stepEnemies(run, dt);
  stepBullets(run, dt);
  stepPickups(run, dt);
  checkWaveClear(run);
  cleanupDead(run);
}

function updateTimers(run, dt) {
  if (run._shootCd > 0) run._shootCd -= dt;
  if (run._dashT > 0) run._dashT -= dt;
  if (run._meleeCd > 0) run._meleeCd -= dt;
  if (run._comboT > 0) { run._comboT -= dt; if (run._comboT <= 0) run.stats.combo = 0; }
  if (run._regenDelay > 0) run._regenDelay -= dt;
  if (run._weaponDropCd > 0) run._weaponDropCd -= dt;
  const p = run.sim.player;
  if (p.invuln > 0) p.invuln -= dt;
  if (p._dashInvuln > 0) p._dashInvuln -= dt;
  if (p.hitFlash > 0) p.hitFlash = Math.max(0, p.hitFlash - dt * 5);
  if (p.reloading) {
    p.reloadT -= dt;
    if (p.reloadT <= 0) {
      p.reloading = false;
      p.mag = modMag(run, p.weapon);
      if (p.mags) p.mags[p.weapon] = p.mag;
      run.events.push({ type: 'reload', weapon: p.weapon });
    }
  }
  if (run._dashRechargeT > 0) {
    run._dashRechargeT -= dt;
    if (run._dashRechargeT <= 0 && run._dashCharges < modDashCharges(run)) {
      run._dashCharges++;
      if (run._dashCharges < modDashCharges(run)) run._dashRechargeT = CONFIG.player.dashRecharge;
    }
  }
  if (run._regenDelay <= 0 && p.hp < p.maxHp && !p.dead) {
    p.hp = Math.min(p.maxHp, p.hp + modInkRegen(run) * dt);
  }
}

function stepPlayer(run, input, dt) {
  const p = run.sim.player;
  if (p.dead) { stepRagdoll(p.body, p.sink, run.map, dt); updateSink(p, dt); return; }

  const mx = input.mx || 0;
  if (mx !== 0) { p.walkx = mx; p.facing = mx > 0 ? 1 : -1; }

  const grounded = isGrounded(p.body);
  if (grounded) run._coyoteT = CONFIG.player.coyote; else run._coyoteT -= dt;

  if (input.jumpPressed) { run._jumpBufferT = CONFIG.player.jumpBuffer; run._jumpHeld = true; }
  if (!input.jump) {
    if (run._jumpHeld && p.body.pts[PELVIS].vy < 0) p.body.pts[PELVIS].vy *= CONFIG.player.jumpCut;
    run._jumpHeld = false;
  }
  if (run._jumpBufferT > 0) {
    run._jumpBufferT -= dt;
    if (run._coyoteT > 0) {
      for (const pt of p.body.pts) pt.vy = CONFIG.player.jump;
      run._coyoteT = 0; run._jumpBufferT = 0; setJumpPose(p.body);
    }
  }

  if (mx !== 0 && grounded) moveBody(p.body, mx, dt);
  else if (mx !== 0) {
    p.body.pts[PELVIS].vx += mx * CONFIG.player.airAccel * dt;
    p.body.pts[PELVIS].vx = clamp(p.body.pts[PELVIS].vx, -CONFIG.player.walkSpeed, CONFIG.player.walkSpeed);
  } else if (grounded) p.body.pts[PELVIS].vx *= CONFIG.player.friction;

  if (input.dashPressed && run._dashCharges > 0 && run._dashT <= 0) {
    const cost = modDashCost(run);
    if (p.hp > cost) performDash(run, cost);
  }
  if (input.meleePressed && run._meleeCd <= 0) performMelee(run);

  if (input.aim) {
    p.aim.x = input.aim.x; p.aim.y = input.aim.y;
    aimBody(p.body, input.aim.x, input.aim.y, 0.5);
    const dir = getGunDir(p.body);
    p.gun.dx = dir.x; p.gun.dy = dir.y;
    const tip = getGunTip(p.body, WEAPONS[p.weapon].length);
    p.gun.x = tip.x; p.gun.y = tip.y;
  }
  if (input.fire && !p.reloading && p.mag > 0 && run._shootCd <= 0) playerShoot(run);
  if (input.reloadPressed && !p.reloading && p.mag < modMag(run, p.weapon)) {
    const rt = modReloadTime(run, p.weapon);
    if (rt <= 0) { p.mag = modMag(run, p.weapon); if (p.mags) p.mags[p.weapon] = p.mag; run.events.push({ type: 'reload', weapon: p.weapon }); }
    else { p.reloading = true; p.reloadT = rt; }
  }
  if (input.weapon != null) {
    const wId = WEAPON_ORDER[input.weapon];
    if (wId && run._weapons?.has(wId) && wId !== p.weapon) {
      if (!p.mags) p.mags = {};
      p.mags[p.weapon] = p.mag;                 // 记住旧枪剩余，避免切枪白嫖换弹
      p.weapon = wId;
      p.magMax = modMag(run, wId);
      p.mag = p.mags[wId] ?? p.magMax;
      p.reloading = false;
    }
  }

  stepPhysics(p.body, run.map, dt);
  p.x = p.body.pts[PELVIS].x; p.y = p.body.pts[PELVIS].y;
  p.px = p.body.pts[PELVIS].px; p.py = p.body.pts[PELVIS].py;
}

function stepPlayerPhysics(run, dt) {
  const p = run.sim.player;
  stepPhysics(p.body, run.map, dt);
  p.x = p.body.pts[PELVIS].x; p.y = p.body.pts[PELVIS].y;
}

function performDash(run, cost) {
  const p = run.sim.player;
  const dir = p.facing;
  p.hp -= cost;
  run._dashCharges--;
  run._dashT = CONFIG.player.dashTime;
  run._dashRechargeT = CONFIG.player.dashRecharge;
  p._dashInvuln = CONFIG.player.dashInvuln;
  p.invuln = Math.max(p.invuln, CONFIG.player.dashInvuln);
  applyImpulse(p.body, dir * CONFIG.player.dashSpeed, 0, 1);
  run.events.push({ type: 'dash', x: p.x, y: p.y, dir });
  for (const e of run.sim.enemies) {
    if (e.dead) continue;
    if (Math.hypot(e.x - p.x, e.y - p.y) < e.r + 30) {
      damageEnemy(run, e, CONFIG.player.dashDamage, p.x, p.y);
      applyImpulse(e.body, dir * 400, -200, 1);
    }
  }
}

function performMelee(run) {
  const p = run.sim.player;
  run._meleeCd = CONFIG.player.meleeCd;
  const range = modMeleeRange(run);
  const dmg = modMeleeDmg(run);
  const dir = p.facing;
  p.anim.melee = 0.2;
  run.events.push({ type: 'melee', x: p.x, y: p.y, dir, hit: false });
  let hitSomething = false;
  for (const e of run.sim.enemies) {
    if (e.dead) continue;
    const dx = e.x - p.x, dy = e.y - p.y;
    const dist = Math.hypot(dx, dy);
    if (dist < range + e.r) {
      const angle = Math.atan2(dy, dx);
      const facingAngle = dir > 0 ? 0 : Math.PI;
      let diff = Math.abs(angle - facingAngle);
      if (diff > Math.PI) diff = 2 * Math.PI - diff;
      if (diff < CONFIG.player.meleeArc / 2) {
        damageEnemy(run, e, dmg, p.x, p.y);
        applyImpulse(e.body, dir * CONFIG.player.meleeLunge, -200, 1);
        hitSomething = true;
      }
    }
  }
  for (let i = run.sim.bullets.length - 1; i >= 0; i--) {
    const b = run.sim.bullets[i];
    if (b.owner !== 'enemy') continue;
    if (Math.hypot(b.x - p.x, b.y - p.y) < range) {
      b.life = 0; hitSomething = true;
      run.events.push({ type: 'splash', x: b.x, y: b.y, r: 12, color: '#ffffff' });
    }
  }
  if (hitSomething) run.events[run.events.length - 1].hit = true;
}

function playerShoot(run) {
  const p = run.sim.player;
  const wDef = WEAPONS[p.weapon];
  run._shootCd = 60 / modFireRate(run, p.weapon) * STEP;
  const pellets = modPellets(run);
  const spread = modSpread(run, p.weapon);
  const dir = getGunDir(p.body);
  const baseAngle = Math.atan2(dir.y, dir.x);
  const tip = getGunTip(p.body, wDef.length);
  for (let i = 0; i < pellets; i++) {
    const angle = baseAngle + (run.rng() - 0.5) * spread * 2;
    const bdx = Math.cos(angle), bdy = Math.sin(angle);
    run.sim.bullets.push({
      x: tip.x + bdx * 4, y: tip.y + bdy * 4, px: tip.x, py: tip.y,
      dx: bdx, dy: bdy, speed: modBulletSpeed(run, p.weapon),
      owner: 'player', dmg: modDmg(run, p.weapon),
      r: wDef.radius, life: CONFIG.combat.bulletLife, color: wDef.trail,
      pierce: modPierce(run), splash: modSplash(run), hit: new Set(),
    });
  }
  p.mag--; run.stats.shots++;
  if (p.mags) p.mags[p.weapon] = p.mag;
  run.events.push({ type: 'shot', x: tip.x, y: tip.y, dx: dir.x, dy: dir.y, weapon: p.weapon, owner: 'player' });
  applyRecoil(p.body, dir.x, dir.y, wDef.kick * modKickMul(run), CONFIG.player.mass);
  if (p.mag <= 0) {
    const rt = modReloadTime(run, p.weapon);
    if (rt <= 0) { p.mag = modMag(run, p.weapon); if (p.mags) p.mags[p.weapon] = p.mag; }
    else { p.reloading = true; p.reloadT = rt; }
  }
}

function stepEnemies(run, dt) {
  for (const e of run.sim.enemies) {
    // 兜底：任何来源把 hp 打到 <=0（调试/场景伤害）都要走统一死亡流程
    if (!e.dead && e.hp <= 0) killEnemy(run, e, e.x, e.y);
    if (e.dead) {
      if (e.dying) {
        stepRagdoll(e.body, e.sink, run.map, dt);
        updateSink(e, dt);
        e.anim.dead += dt;
        if (e.anim.dead > 6) e.dying = false;
      }
      continue;
    }
    if (e === run.sim.boss) continue;   // Boss 的 AI 由下方单独驱动，避免一帧跑两次
    if (e.invuln > 0) e.invuln -= dt;
    const actions = stepAI(e.ai, e, run.sim.player, run.sim, dt);
    for (const act of actions) processEnemyAction(run, e, act);
    const gd = getGunDir(e.body);
    e.gun.dx = gd.x; e.gun.dy = gd.y;
    const tip = getGunTip(e.body, 8);
    e.gun.x = tip.x; e.gun.y = tip.y;
  }
  if (run.sim.boss && !run.sim.boss.dead) {
    const boss = run.sim.boss;
    if (boss.invuln > 0) boss.invuln -= dt;
    const actions = stepAI(boss.ai, boss, run.sim.player, run.sim, dt);
    for (const act of actions) processEnemyAction(run, boss, act);
  }
}

function processEnemyAction(run, enemy, action) {
  if (action.kind === 'shoot') {
    const shot = getEnemyShot(enemy.ai, enemy, run.sim.player);
    if (shot) {
      shot.hit = new Set();
      run.sim.bullets.push(shot);
      run.events.push({ type: 'shot', x: shot.x, y: shot.y, dx: shot.dx, dy: shot.dy, weapon: enemy.type, owner: 'enemy' });
    }
  } else if (action.kind === 'beam') {
    const beam = getBeam(enemy.ai, enemy, run.sim.player);
    checkBeamHit(run, beam);
    run.events.push({ type: 'shot', x: beam.x, y: beam.y, dx: beam.dx, dy: beam.dy, weapon: 'compass_beam', owner: 'enemy' });
  } else if (action.kind === 'contact') {
    hurtPlayer(run, action.dmg, enemy.x, enemy.y);
  } else if (action.kind === 'wipe') {
    performEraserWipe(run, enemy);
  } else if (action.kind === 'bossPhase') {
    run.events.push({ type: 'bossPhase', phase: action.phase, nameKey: action.nameKey });
  } else if (action.kind === 'bossShoot') {
    performBossAttack(run, enemy, action);
  } else if (action.kind === 'bossCharge') {
    run.events.push({ type: 'splash', x: enemy.x, y: enemy.y, r: 120, color: '#ffffff' });
  }
}

function performEraserWipe(run, enemy) {
  const ex = enemy.body.pts[2].x, ey = enemy.body.pts[2].y;
  for (const b of run.sim.bullets) {
    if (b.owner === 'enemy') continue;
    if (Math.abs(b.x - ex) < 150 && Math.abs(b.y - ey) < 40) b.life = 0;
  }
  const p = run.sim.player;
  if (!p.dead && p.invuln <= 0 && Math.abs(p.x - ex) < 150 && Math.abs(p.y - ey) < 50) {
    hurtPlayer(run, ENEMIES.eraser.wipeDrain, ex, ey);
  }
  run.events.push({ type: 'splash', x: ex, y: ey, r: 150, color: '#ffffff' });
}

function performBossAttack(run, boss, action) {
  const p = run.sim.player;
  if (action.pattern === 'triple') {
    for (let i = -1; i <= 1; i++) {
      const angle = Math.atan2(p.y - boss.y, p.x - boss.x) + i * 0.2;
      const sd = ENEMY_SHOTS.blank;
      run.sim.bullets.push({
        x: boss.x, y: boss.y, px: boss.x, py: boss.y,
        dx: Math.cos(angle), dy: Math.sin(angle), speed: sd.speed,
        owner: 'enemy', dmg: sd.dmg, r: sd.radius, life: sd.life,
        color: sd.color, pierce: 1, splash: 0, hit: new Set(),
      });
    }
  } else if (action.pattern === 'ground_wipe') {
    run.events.push({ type: 'splash', x: boss.x, y: WORLD.groundY, r: 120, color: '#ffffff' });
    const p2 = run.sim.player;
    if (!p2.dead && Math.abs(p2.y - WORLD.groundY) < 30 && Math.abs(p2.x - boss.x) < 120) {
      hurtPlayer(run, 10, boss.x, WORLD.groundY);
    }
  } else if (action.pattern === 'rain') {
    for (let i = 0; i < 8; i++) {
      const rx = run.rng() * WORLD.w;
      const sd = ENEMY_SHOTS.blank;
      run.sim.bullets.push({
        x: rx, y: -20, px: rx, py: -20, dx: 0, dy: 1, speed: sd.speed,
        owner: 'enemy', dmg: sd.dmg, r: sd.radius, life: sd.life,
        color: sd.color, pierce: 1, splash: 0, hit: new Set(),
      });
    }
  }
}

function checkBeamHit(run, beam) {
  const p = run.sim.player;
  if (p.dead || p.invuln > 0) return;
  const px = p.body.pts[PELVIS].x, py = p.body.pts[PELVIS].y;
  const dx = px - beam.x, dy = py - beam.y;
  const proj = dx * beam.dx + dy * beam.dy;
  if (proj < 0 || proj > beam.length) return;
  const perpDist = Math.hypot(dx - proj * beam.dx, dy - proj * beam.dy);
  if (perpDist < beam.width / 2 + p.r) hurtPlayer(run, beam.dmg, beam.x, beam.y);
}

function stepBullets(run, dt) {
  for (let i = run.sim.bullets.length - 1; i >= 0; i--) {
    const b = run.sim.bullets[i];
    b.px = b.x; b.py = b.y;
    b.x += b.dx * b.speed * dt; b.y += b.dy * b.speed * dt;
    b.life -= dt;
    if (b.life <= 0 || b.x < -20 || b.x > WORLD.w + 20 || b.y < -40 || b.y > WORLD.groundY + 20) {
      run.sim.bullets.splice(i, 1); continue;
    }
    if (b.owner === 'player') checkPlayerBulletHit(run, b, i);
    else checkEnemyBulletHit(run, b, i);
  }
}

function checkPlayerBulletHit(run, bullet, idx) {
  const targets = [...run.sim.enemies];
  if (run.sim.boss && !run.sim.boss.dead) targets.push(run.sim.boss);
  for (const e of targets) {
    if (e.dead || e.invuln > 0) continue;
    if (bullet.hit.has(e.id)) continue;
    if (checkBulletVsEntity(bullet, e)) {
      bullet.hit.add(e.id);
      let dmg = bullet.dmg;
      if (e.type === 'eraser') dmg *= (ENEMIES.eraser.bulletProof || 0.35);
      damageEnemy(run, e, dmg, bullet.x, bullet.y);
      run.stats.hits++;
      run.events.push({ type: 'shotHit', x: bullet.x, y: bullet.y, dmg, owner: 'player' });
      run.events.push({ type: 'hit', x: bullet.x, y: bullet.y, dmg, target: 'enemy', heavy: dmg > 30 });
      if (bullet.splash > 0) {
        for (const e2 of targets) {
          if (e2 === e || e2.dead) continue;
          if (Math.hypot(e2.x - bullet.x, e2.y - bullet.y) < bullet.splash) {
            damageEnemy(run, e2, dmg * 0.5, bullet.x, bullet.y);
          }
        }
        run.events.push({ type: 'splash', x: bullet.x, y: bullet.y, r: bullet.splash, color: bullet.color });
      }
      bullet.pierce--;
      if (bullet.pierce <= 0) { run.sim.bullets.splice(idx, 1); return; }
    }
  }
}

function checkEnemyBulletHit(run, bullet, idx) {
  const p = run.sim.player;
  if (p.dead || p.invuln > 0) return;
  if (checkBulletVsEntity(bullet, p)) {
    hurtPlayer(run, bullet.dmg, bullet.x, bullet.y);
    run.events.push({ type: 'hit', x: bullet.x, y: bullet.y, dmg: bullet.dmg, target: 'player', heavy: bullet.dmg > 20 });
    run.sim.bullets.splice(idx, 1);
  }
}

function checkBulletVsEntity(bullet, entity) {
  const headR = CONFIG.combat.headTargetRing;
  const bodyR = CONFIG.combat.bodyRadius;
  const limbR = CONFIG.combat.limbRadius;
  const head = entity.body.pts[0];
  if (Math.hypot(bullet.x - head.x, bullet.y - head.y) < headR) return true;
  for (const pt of entity.body.pts) {
    if (Math.hypot(bullet.x - pt.x, bullet.y - pt.y) < limbR) return true;
  }
  const cx = entity.body.pts[2].x, cy = entity.body.pts[2].y;
  if (Math.hypot(bullet.x - cx, bullet.y - cy) < bodyR) return true;
  // For boss-sized entities (r > 100 after scaling), use radius-based collision from body center
  if (entity.r && entity.r > 100) {
    const bodyCenterX = entity.body.pts[2].x;
    const bodyCenterY = entity.body.pts[2].y;
    if (Math.hypot(bullet.x - bodyCenterX, bullet.y - bodyCenterY) < entity.r * 0.7) return true;
  }
  return false;
}

function damageEnemy(run, enemy, dmg, fx, fy) {
  if (enemy.dead) return;
  enemy.hp -= dmg;
  enemy.hitFlash = 1;
  run.stats.damage += dmg;
  run._regenDelay = CONFIG.player.regenDelay;
  if (enemy.hp <= 0) killEnemy(run, enemy, fx, fy);
}

function killEnemy(run, enemy, fx, fy) {
  enemy.dead = true; enemy.dying = true; enemy.anim.dead = 0; enemy.sink = 0;
  ragdollDeath(enemy.body, run.rng);
  const def = ENEMIES[enemy.type];
  run.stats.kills++;
  run._comboT = CONFIG.combat.comboWindow;
  run.stats.combo = Math.min(CONFIG.combat.comboMax, run.stats.combo + 1);
  run.stats.score += Math.round(def.score * (1 + run.stats.combo * 0.1));
  const inkGain = CONFIG.player.inkPerKill * modComboInkMul(run);
  const p = run.sim.player;
  p.hp = Math.min(p.maxHp, p.hp + inkGain);
  run.stats.inkGained += inkGain;
  run.events.push({ type: 'kill', x: fx || enemy.x, y: fy || enemy.y, enemyType: enemy.type, ragdoll: true, boss: enemy.type === 'blank' });

  if (def.split && def.split.count > 0) {
    for (let i = 0; i < def.split.count; i++) {
      const st = def.split.type;
      const sd = ENEMIES[st];
      const sx = enemy.x + (run.rng() - 0.5) * 40;
      const sy = enemy.y - 10;
      const body = createBody(sx, sy, CONFIG.enemyScale[st] || 1);
      const se = {
        id: `e-${_nextId++}`, kind: 'enemy', type: st,
        x: sx, y: sy, px: sx, py: sy, vx: 0, vy: 0,
        hp: def.split.hp, maxHp: def.split.hp,
        r: sd.r * (CONFIG.enemyScale[st] || 1),
        facing: run.rng() > 0.5 ? 1 : -1,
        dead: false, dying: false, invuln: 0.5, body,
        gun: { x: sx, y: sy, dx: 1, dy: 0 },
        aim: { x: sx, y: sy },
        anim: { walk: 0, hurt: 0, dead: 0, flash: 0, dash: 0, melee: 0, reload: 0, spawn: 0.5, telegraph: 0 },
        weapon: null, mag: 0, magMax: 0, reloading: false, reloadT: 0,
        hitFlash: 0, walkx: 0, scale: CONFIG.enemyScale[st] || 1,
        sink: 0, _contactCd: 0,
      };
      se.ai = createAI(st, run.rng);
      run.sim.enemies.push(se);
    }
  }

  const drops = generateWaveDrops(run.waves, enemy.x, enemy.y);
  for (const d of drops) run.sim.pickups.push(d);
  // 前两把副武器保底掉落一次，之后再随机
  const missingWeapon = !run._weapons?.has('brush') ? 'brush' : (!run._weapons?.has('nib') ? 'nib' : null);
  if (run._weaponDropCd <= 0 && (missingWeapon || run.rng() < 0.3)) {
    run._weaponDropCd = 5;
    const pk = createPickup('weapon', enemy.x, enemy.y - 20, run.rng);
    pk.weapon = missingWeapon || (run.rng() > 0.5 ? 'brush' : 'nib');
    run.sim.pickups.push(pk);
  }
  if (!run._loreGiven.has(run.actId) && run.rng() < 0.2) {
    run._loreGiven.add(run.actId);
    run.sim.pickups.push(createPickup('lore', enemy.x + 20, enemy.y - 30, run.rng));
  }
  if (enemy.type === 'blank') {
    run.state = 'won';
    run.events.push({ type: 'bossDown' });
  }
}

function hurtPlayer(run, dmg, fx, fy) {
  const p = run.sim.player;
  if (p.dead || p.invuln > 0 || p._dashInvuln > 0) return;
  const lowMul = (p.hp / p.maxHp < 0.3) ? modLowInkDmgMul(run) : 1;
  p.hp -= dmg * lowMul;
  p.invuln = CONFIG.player.invulnOnHurt;
  p.hitFlash = 1; p.anim.hurt = 0.3;
  run._regenDelay = CONFIG.player.regenDelay;
  run.events.push({ type: 'hurt', x: fx || p.x, y: fy || p.y, amount: dmg });
  if (p.hp <= 0) killPlayer(run);
}

// 统一的玩家死亡入口：任何来源把墨打到 0 都走这里（调试/场景伤害/子弹）
function killPlayer(run) {
  const p = run.sim.player;
  if (p.dead) return;
  if (p._revives > 0) {
    p._revives--; p.hp = 40; p.invuln = 1.5;
    run.events.push({ type: 'splash', x: p.x, y: p.y, r: 80, color: '#ffffff' });
    for (const b of run.sim.bullets) { if (b.owner === 'enemy') b.life = 0; }
    return;
  }
  p.dead = true; p.dying = true; p.sink = 0;
  ragdollDeath(p.body, run.rng);
  run.state = 'dead';
  run.events.push({ type: 'dead' });
}

function stepPickups(run, dt) {
  const p = run.sim.player;
  if (p.dead) return;
  const magnetR = modMagnet(run);
  for (let i = run.sim.pickups.length - 1; i >= 0; i--) {
    const pk = run.sim.pickups[i];
    pk.t += dt; pk.vy += 800 * dt;
    pk.x += pk.vx * dt; pk.y += pk.vy * dt;
    if (pk.y > WORLD.groundY) { pk.y = WORLD.groundY; pk.vy *= -0.3; pk.vx *= 0.8; }
    pk.vx *= 0.98;
    const dx = p.x - pk.x, dy = p.y - pk.y;
    const dist = Math.hypot(dx, dy);
    if (dist < magnetR && CONFIG.wave.pickupVacuum && dist > 1) {
      const pull = (1 - dist / magnetR) * 600;
      pk.vx += (dx / dist) * pull * dt; pk.vy += (dy / dist) * pull * dt;
    }
    if (dist < CONFIG.player.pickupRadius) {
      applyPickup(run, pk); run.sim.pickups.splice(i, 1);
    } else if (pk.t > 15) run.sim.pickups.splice(i, 1);
  }
}

function applyPickup(run, pk) {
  const p = run.sim.player;
  if (pk.kind === 'ink') {
    const gain = (pk.value || CONFIG.player.pickupInk) * modInkPickupMul(run);
    p.hp = Math.min(p.maxHp, p.hp + gain);
    run.stats.inkGained += gain;
    run.events.push({ type: 'pickup', kind: 'ink', x: pk.x, y: pk.y });
  } else if (pk.kind === 'weapon') {
    const wId = pk.weapon || 'brush';
    run._weapons?.add(wId);
    if (!p.mags) p.mags = {};
    p.mags[p.weapon] = p.mag;
    p.weapon = wId; p.magMax = modMag(run, wId); p.mag = p.magMax;
    p.mags[wId] = p.mag;
    p.reloading = false;
    run.events.push({ type: 'pickup', kind: 'weapon', weapon: wId, x: pk.x, y: pk.y });
  } else if (pk.kind === 'lore') {
    const idx = pk.lore || 1;
    if (!run.stats.lore.includes(idx)) run.stats.lore.push(idx);
    run.events.push({ type: 'lore', index: idx });
  }
}

function beginWave(run) {
  const groups = startWave(run.waves);
  run.sim.wave.index = run.waves.waveIndex + 1;
  run.events.push({ type: 'waveStart', index: run.waves.waveIndex, act: run.actIndex, groups });
  if (run.waves.act.boss) {
    run.sim.boss = spawnBoss(run.waves);
    run.sim.enemies.push(run.sim.boss);
  }
}

function checkWaveClear(run) {
  if (run.state !== 'fighting') return;
  if (isWaveClear(run.waves, run.sim.enemies)) {
    const isLast = run.waves.waveIndex >= run.waves.act.waves.length - 1;
    run.events.push({ type: 'waveClear', index: run.waves.waveIndex, act: run.actIndex });
    if (isLast) {
      if (run.actIndex >= CONFIG.acts.length - 1) { run.state = 'won'; }
      else {
        run.state = 'clear'; run._clearT = CONFIG.wave.nextWaveDelay;
        run.sim.player.hp = Math.min(run.sim.player.maxHp, run.sim.player.hp + CONFIG.wave.clearBonusInk);
      }
    } else {
      run.state = 'clear'; run._clearT = CONFIG.wave.nextWaveDelay;
    }
  }
}

function cleanupDead(run) {
  run.sim.enemies = run.sim.enemies.filter(e => !(e.dying && e.anim.dead > 6));
}

export function startNextWave(run) {
  if (run.state !== 'clear') return;
  const hasMore = nextWave(run.waves);
  if (!hasMore) { nextAct(run); return; }
  run.waveIndex = run.waves.waveIndex;
  run.sim.wave.index = run.waves.waveIndex + 1;
  run.state = 'fighting';
  beginWave(run);
}

export function nextAct(run) {
  run.actIndex++;
  if (run.actIndex >= CONFIG.acts.length) { run.state = 'won'; return false; }
  const act = CONFIG.acts[run.actIndex];
  const map = MAPS[act.id];
  run.actId = act.id; run.map = map; run.sim.map = map;
  run.waves = createWaves(run.actIndex, run.rng(), run.rng, run.difficulty);
  run.waveIndex = 0; run.sim.wave.act = run.actIndex;
  run.sim.wave.total = act.waves.length; run.sim.wave.index = 1;
  const p = run.sim.player;
  p.hp = p.maxHp;
  setBodyPos(p.body, map.playerSpawn.x, map.playerSpawn.y);
  p.x = map.playerSpawn.x; p.y = map.playerSpawn.y;
  p.dead = false; p.dying = false; p.invuln = 1; p.sink = 0;
  run.sim.enemies = []; run.sim.bullets = []; run.sim.pickups = []; run.sim.boss = null;
  run.state = 'idle'; run._introT = CONFIG.wave.introDelay;
  run.events.push({ type: 'actStart', act: run.actIndex, id: act.id });
  return true;
}

export function getUpgradeChoices(run, n = 3) {
  const avail = UPGRADES.filter(u => !run._upgradesTaken.includes(u.id));
  if (avail.length === 0) { run._upgradesTaken = []; return UPGRADES.slice(0, n); }
  const shuffled = [...avail].sort(() => run.rng() - 0.5);
  return shuffled.slice(0, Math.min(n, shuffled.length));
}

export function applyUpgrade(run, upgradeId) {
  const up = UPGRADE_BY_ID[upgradeId];
  if (!up) return;
  run._upgradesTaken.push(upgradeId);
  for (const [key, val] of Object.entries(up.mods)) {
    if (key.endsWith('Mul')) run._mods[key] = (run._mods[key] || 1) * val;
    else if (key.endsWith('Add')) run._mods[key] = (run._mods[key] || 0) + val;
    else run._mods[key] = val;
  }
  if (up.mods.refill) run.sim.player.hp = run.sim.player.maxHp;
  if (up.mods.reviveAdd) run.sim.player._revives += up.mods.reviveAdd;
  if (up.mods.maxInkAdd) { run.sim.player.maxHp += up.mods.maxInkAdd; run.sim.player.hp += up.mods.maxInkAdd; }
}

export function drainEvents(run) { const e = run.events; run.events = []; return e; }

export function getHud(run) {
  const p = run.sim.player;
  return {
    ink: Math.round(p.hp), inkMax: p.maxHp,
    weapon: p.weapon, mag: p.mag, magMax: p.magMax,
    reloading: p.reloading, reloadT: p.reloadT,
    wave: run.waves.waveIndex + 1, waveTotal: run.waves.act.waves.length,
    act: run.actIndex, actTotal: CONFIG.acts.length,
    score: run.stats.score, combo: run.stats.combo,
    dash: run._dashCharges, dashMax: modDashCharges(run),
    bossHp: run.sim.boss ? run.sim.boss.hp : 0,
    bossMax: run.sim.boss ? run.sim.boss.maxHp : 0,
  };
}

function modFireRate(run, w) { return WEAPONS[w].rpm * (run._mods.fireRateMul || 1); }
function modDmg(run, w) { return WEAPONS[w].dmg * (run._mods.dmgMul || 1); }
function modKickMul(run) { return run._mods.kickMul || 1; }
function modBulletSpeed(run, w) { return WEAPONS[w].speed * (run._mods.bulletSpeedMul || 1); }
function modSpread(run, w) { return WEAPONS[w].spread * (run._mods.spreadMul || 1); }
function modPellets(run) { return WEAPONS[run.sim.player.weapon].pellets + (run._mods.pelletsAdd || 0); }
function modPierce(run) { return WEAPONS[run.sim.player.weapon].pierce + (run._mods.pierceAdd || 0); }
function modSplash(run) { return run._mods.splashAdd || 0; }
function modMag(run, w) { return WEAPONS[w].mag + (run._mods.magAdd || 0); }
function modReloadTime(run, w) { return WEAPONS[w].reload * (run._mods.reloadMul || 1); }
function modDashCharges(run) { return CONFIG.player.dashCharges + (run._mods.dashChargesAdd || 0); }
function modDashCost(run) { return CONFIG.player.dashCost * (run._mods.dashCostMul || 1); }
function modMeleeDmg(run) { return CONFIG.player.meleeDmg * (run._mods.meleeDmgMul || 1); }
function modMeleeRange(run) { return CONFIG.player.meleeRange + (run._mods.meleeRangeAdd || 0); }
function modMagnet(run) { return CONFIG.player.magnetRadius + (run._mods.magnetAdd || 0); }
function modInkRegen(run) { return CONFIG.player.inkRegen * (run._mods.inkRegenMul || 1); }
function modInkPickupMul(run) { return run._mods.inkPickupMul || 1; }
function modComboInkMul(run) { return run._mods.comboInkMul || 1; }
function modLowInkDmgMul(run) { return run._mods.lowInkDmgMul || 1; }

export { mulberry32 };
export default createRun;
