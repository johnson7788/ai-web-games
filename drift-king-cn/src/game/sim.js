// DRIFT KING CN · 纯逻辑（无 DOM / 无渲染）
// 无限霓虹漂移：自动前进 + 左右转向漂移，吃星充能、主动狂暴撞翻对手，连击刷分。
// 导出 createRun()（main 用）与 mulberry32（selfplay / 测试用）。
// 注意：事件 payload 一律不用 `type` 字段（会覆盖事件名）。
import { GAME, CAR_LV, STAGE_MIX } from '../../config/game.config.js';

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const deg2rad = (d) => (d * Math.PI) / 180;
const rad2deg = (r) => (r * 180) / Math.PI;
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const dist = (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay);
const angleTo = (ax, ay, bx, by) => rad2deg(Math.atan2(by - ay, bx - ax));

// 最短有符号角度差：从 from 到 to（-180..180）
function angDelta(from, to) {
  let d = (to - from) % 360;
  if (d > 180) d -= 360;
  if (d < -180) d += 360;
  return d;
}

let _id = 1;
const nid = () => _id++;

function makeEnemy(x, y, lv, rng) {
  const c = CAR_LV[lv - 1];
  return {
    id: nid(), kind: 'enemy', lv,
    x, y, heading: 0, velAng: 0,
    speed: GAME.PLAYER_SPEED * c.speed * (1 + (rng() * 2 - 1) * 0.2),
    rotate: GAME.PLAYER_ROTATE * c.rotate,
    r: c.r, color: c.color, score: c.score,
    cooldown: 0, speedVarDt: 0, speedVar: 2 + rng() * 3,
    alive: true,
  };
}

function makeProp(x, y, propKind, rng) {
  const p = { id: nid(), kind: 'prop', propKind, x, y, alive: true, age: 0 };
  if (propKind === 'star') p.points = GAME.STAR_MIN + Math.floor(rng() * (GAME.STAR_MAX - GAME.STAR_MIN + 1));
  return p;
}

function makePylon(x, y) {
  return { id: nid(), kind: 'pylon', x, y, r: GAME.PYLON_R, alive: true };
}

export function createRun(opts = {}) {
  const rng = mulberry32(opts.seed == null ? 1 : opts.seed);
  const events = [];
  const emit = (type, payload = {}) => events.push({ type, ...payload });

  const player = {
    x: 0, y: 0,
    heading: -90, velAng: -90, // -90 = 朝上
    speed: GAME.PLAYER_SPEED,
    rotate: GAME.PLAYER_ROTATE,
    r: GAME.PLAYER_R,
    invuln: 0, shield: 0, range: 0,
  };

  const enemies = [];
  const props = [];
  const pylons = [];

  const state = {
    phase: 'playing',      // playing | dead
    stage: 1,
    time: 0,
    score: 0,
    hp: GAME.PLAYER_MAX_HP,
    maxHp: GAME.PLAYER_MAX_HP,
    boost: 0,
    boostMax: GAME.BOOST_MAX,
    mode: 'idle',          // idle | hit | hot
    modeTime: 0,
    hitKills: 0,
    combo: 0,
    comboTime: 0,
    kills: 0,
    stars: 0,
    bestCombo: 0,
    player,
    enemies,
    props,
    pylons,
  };

  const timers = {
    enemy: 0.6,
    prop: 2.0,
    pylon: 4.0,
    scoreTick: 1.0,
  };

  const input = { steer: 0, boostQueued: false };

  function stageMix(stage) {
    return STAGE_MIX[clamp(stage - 1, 0, STAGE_MIX.length - 1)];
  }
  function enemyCap(stage) {
    return Math.min(12, 3 + Math.floor((stage - 1) * 0.8));
  }
  function spawnInterval(stage) {
    return Math.max(0.7, 1.6 - (stage - 1) * 0.07);
  }

  function pickLv(stage) {
    const mix = stageMix(stage);
    const roll = rng();
    let acc = 0;
    for (let i = 0; i < mix.length; i += 1) {
      acc += mix[i];
      if (roll < acc) return i + 1;
    }
    return 4;
  }

  function spawnAhead(jitterDeg) {
    const ang = player.velAng + (rng() * 2 - 1) * jitterDeg;
    const rad = deg2rad(ang);
    const d = GAME.SPAWN_DIST + rng() * 200;
    return { x: player.x + Math.cos(rad) * d, y: player.y + Math.sin(rad) * d, ang };
  }

  function spawnEnemy() {
    const p = spawnAhead(GAME.SPAWN_ANGLE_JITTER);
    const e = makeEnemy(p.x, p.y, pickLv(state.stage), rng);
    e.heading = angleTo(e.x, e.y, player.x, player.y);
    e.velAng = e.heading;
    enemies.push(e);
    emit('spawn', { kind: 'enemy', lv: e.lv });
  }

  function spawnProp() {
    const p = spawnAhead(30);
    const roll = rng();
    const propKind = roll < 0.45 ? 'star' : roll < 0.65 ? 'bomb' : roll < 0.85 ? 'shield' : 'range';
    const pr = makeProp(p.x, p.y, propKind, rng);
    props.push(pr);
    emit('spawn', { kind: 'prop', propKind });
  }

  function spawnPylon() {
    const p = spawnAhead(20);
    const side = rng() < 0.5 ? -1 : 1;
    const off = 60 + rng() * 120;
    const rad = deg2rad(p.ang + 90);
    p.x += Math.cos(rad) * off * side;
    p.y += Math.sin(rad) * off * side;
    pylons.push(makePylon(p.x, p.y));
    emit('spawn', { kind: 'pylon' });
  }

  function killEnemy(e, via) {
    e.alive = false;
    state.kills += 1;
    state.combo = state.comboTime > 0 ? Math.min(GAME.COMBO_MAX, state.combo + 1) : 1;
    state.comboTime = GAME.COMBO_WINDOW;
    state.bestCombo = Math.max(state.bestCombo, state.combo);
    const pts = e.score * state.combo;
    state.score += pts;
    emit('kill', { lv: e.lv, points: pts, combo: state.combo, via });
    if (state.combo >= 2) emit('combo', { combo: state.combo });
    if (state.mode === 'hit') {
      state.hitKills += 1;
      if (state.hitKills >= GAME.HIT_KILLS_TO_HOT) {
        state.mode = 'hot';
        state.modeTime = GAME.HOT_TIME;
        state.hitKills = 0;
        emit('hot', {});
      }
    }
  }

  function hurtPlayer() {
    if (player.invuln > 0 || state.mode !== 'idle') return;
    state.hp -= 1;
    player.invuln = GAME.PLAYER_INVULN;
    state.combo = 0;
    state.comboTime = 0;
    emit('hurt', { hp: state.hp });
    if (state.hp <= 0) {
      state.phase = 'dead';
      emit('death', { score: state.score });
    }
  }

  function collectProp(p) {
    p.alive = false;
    if (p.propKind === 'star') {
      state.stars += 1;
      state.boost = Math.min(state.boostMax, state.boost + 1);
      state.score += p.points;
      emit('star', { points: p.points, stars: state.stars, boost: state.boost });
    } else if (p.propKind === 'bomb') {
      let n = 0;
      for (const e of enemies) if (e.alive) { e.alive = false; state.score += 30; n += 1; }
      emit('bomb', { kills: n });
    } else if (p.propKind === 'shield') {
      player.shield = Math.max(player.shield, 10);
      player.invuln = Math.max(player.invuln, 10);
      emit('shield', {});
    } else if (p.propKind === 'range') {
      player.range = 10;
      emit('range', {});
    }
  }

  function smashPylon(p) {
    p.alive = false;
    if (state.mode !== 'idle') {
      state.combo = state.comboTime > 0 ? Math.min(GAME.COMBO_MAX, state.combo + 1) : 1;
      state.comboTime = GAME.COMBO_WINDOW;
      state.bestCombo = Math.max(state.bestCombo, state.combo);
      const pts = 30 * state.combo;
      state.score += pts;
      emit('pylon', { points: pts, combo: state.combo });
    } else {
      hurtPlayer();
    }
  }

  function updatePlayer(dt) {
    player.heading += input.steer * player.rotate * dt;
    // 漂移：速度方向追车头（上限 0.8×转向速度），最多落后 MAX_DRIFT_LAG
    const d = angDelta(player.velAng, player.heading);
    const chase = player.rotate * 0.8 * dt;
    if (Math.abs(d) <= chase) player.velAng = player.heading;
    else player.velAng += Math.sign(d) * chase;
    const lag = angDelta(player.velAng, player.heading);
    if (lag > GAME.MAX_DRIFT_LAG) player.velAng = player.heading - GAME.MAX_DRIFT_LAG;
    else if (lag < -GAME.MAX_DRIFT_LAG) player.velAng = player.heading + GAME.MAX_DRIFT_LAG;

    player.speed = state.mode === 'idle' ? GAME.PLAYER_SPEED : GAME.PLAYER_SPEED * 1.5;
    const rad = deg2rad(player.velAng);
    player.x += Math.cos(rad) * player.speed * dt;
    player.y += Math.sin(rad) * player.speed * dt;

    // 漂移充能（狂暴/超狂暴期不充）
    if (state.mode === 'idle' && Math.abs(angDelta(player.velAng, player.heading)) > 20) {
      state.boost = Math.min(state.boostMax, state.boost + GAME.DRIFT_FILL * dt);
    }

    if (player.invuln > 0) player.invuln -= dt;
    if (player.shield > 0) player.shield -= dt;
    if (player.range > 0) player.range -= dt;

    if (state.mode !== 'idle') {
      state.modeTime -= dt;
      if (state.modeTime <= 0) {
        state.mode = 'idle';
        state.hitKills = 0;
        player.invuln = Math.max(player.invuln, GAME.SHIELD_TIME);
        player.shield = Math.max(player.shield, GAME.SHIELD_TIME);
        emit('shield', {});
      }
    }

    if (state.comboTime > 0) {
      state.comboTime -= dt;
      if (state.comboTime <= 0) state.combo = 0;
    }
  }

  function updateEnemy(e, dt) {
    e.cooldown -= dt;
    e.speedVarDt += dt;
    if (e.speedVarDt >= e.speedVar) {
      e.speedVarDt = 0;
      e.speedVar = 2 + rng() * 3;
      const c = CAR_LV[e.lv - 1];
      e.speed = GAME.PLAYER_SPEED * c.speed * (1 + (rng() * 2 - 1) * 0.2);
    }
    const target = angleTo(e.x, e.y, player.x, player.y);
    const turn = angDelta(e.heading, target);
    e.heading += clamp(turn, -e.rotate * dt, e.rotate * dt);
    const d = angDelta(e.velAng, e.heading);
    const chase = e.rotate * 0.8 * dt;
    if (Math.abs(d) <= chase) e.velAng = e.heading;
    else e.velAng += Math.sign(d) * chase;
    const lag = angDelta(e.velAng, e.heading);
    if (lag > GAME.MAX_DRIFT_LAG) e.velAng = e.heading - GAME.MAX_DRIFT_LAG;
    else if (lag < -GAME.MAX_DRIFT_LAG) e.velAng = e.heading + GAME.MAX_DRIFT_LAG;
    const rad = deg2rad(e.velAng);
    e.x += Math.cos(rad) * e.speed * dt;
    e.y += Math.sin(rad) * e.speed * dt;
  }

  function step(dt) {
    if (state.phase !== 'playing') return;
    dt = Math.min(0.1, Math.max(0, dt));

    if (input.boostQueued) {
      input.boostQueued = false;
      if (state.mode === 'idle' && state.boost >= state.boostMax) {
        state.mode = 'hit';
        state.modeTime = GAME.HIT_TIME;
        state.boost = 0;
        state.hitKills = 0;
        emit('hit', {});
      }
    }

    updatePlayer(dt);
    for (const e of enemies) if (e.alive) updateEnemy(e, dt);

    // 碰撞：敌车
    const eatR = player.range > 0 ? GAME.EAT_RANGE * GAME.RANGE_MULT : GAME.EAT_RANGE;
    for (const e of enemies) {
      if (!e.alive) continue;
      if (dist(player.x, player.y, e.x, e.y) < player.r + e.r) {
        if (state.mode !== 'idle') {
          killEnemy(e, state.mode);
        } else if (e.cooldown <= 0) {
          e.cooldown = GAME.ENEMY_COOLDOWN;
          const away = deg2rad(angleTo(e.x, e.y, player.x, player.y));
          e.x += Math.cos(away) * 30;
          e.y += Math.sin(away) * 30;
          hurtPlayer();
        }
      }
    }
    // 碰撞：道具
    for (const p of props) {
      if (!p.alive) continue;
      p.age += dt;
      if (p.age > 20) { p.alive = false; continue; }
      if (dist(player.x, player.y, p.x, p.y) < eatR) collectProp(p);
    }
    // 碰撞：霓虹柱
    for (const p of pylons) {
      if (!p.alive) continue;
      if (dist(player.x, player.y, p.x, p.y) < player.r + p.r) smashPylon(p);
    }

    // 刷怪 / 刷道具 / 刷柱
    timers.enemy -= dt;
    if (timers.enemy <= 0 && enemies.length < enemyCap(state.stage)) {
      timers.enemy = spawnInterval(state.stage);
      spawnEnemy();
    }
    timers.prop -= dt;
    if (timers.prop <= 0) {
      timers.prop = 3 + rng() * 5;
      spawnProp();
    }
    timers.pylon -= dt;
    if (timers.pylon <= 0) {
      timers.pylon = 5 + rng() * 5;
      if (state.stage >= 2) spawnPylon();
    }

    // 被动得分（每秒一次，保证事件密度）
    timers.scoreTick -= dt;
    if (timers.scoreTick <= 0) {
      timers.scoreTick += 1;
      state.score += GAME.SCORE_TICK;
      emit('score', { score: state.score });
    }

    // 阶段推进
    state.time += dt;
    const newStage = Math.min(GAME.STAGE_MAX, 1 + Math.floor(state.time / GAME.STAGE_SECONDS));
    if (newStage !== state.stage) {
      state.stage = newStage;
      emit('stage', { stage: newStage });
    }

    // 清理
    for (let i = enemies.length - 1; i >= 0; i -= 1) if (!enemies[i].alive) enemies.splice(i, 1);
    for (let i = props.length - 1; i >= 0; i -= 1) if (!props[i].alive) props.splice(i, 1);
    for (let i = pylons.length - 1; i >= 0; i -= 1) if (!pylons[i].alive) pylons.splice(i, 1);
  }

  return {
    state,
    player,
    enemies,
    props,
    pylons,
    input,
    setSteer(v) { input.steer = clamp(Math.round(v), -1, 1); },
    pressBoost() { input.boostQueued = true; },
    step,
    drainEvents() { return events.splice(0); },
    // 验收辅助：在玩家周围布置一批道具/敌车/霓虹柱（截图目标可见）
    stageDemo() {
      const p = player;
      props.length = 0;
      props.push(makeProp(p.x - 120, p.y - 260, 'star', rng));
      props.push(makeProp(p.x + 150, p.y - 330, 'star', rng));
      props.push(makeProp(p.x + 280, p.y - 150, 'bomb', rng));
      props.push(makeProp(p.x - 280, p.y - 170, 'shield', rng));
      enemies.length = 0;
      const e1 = makeEnemy(p.x + 190, p.y - 220, 1, rng);
      e1.heading = angleTo(e1.x, e1.y, p.x, p.y);
      e1.velAng = e1.heading;
      const e2 = makeEnemy(p.x - 210, p.y - 300, 2, rng);
      e2.heading = angleTo(e2.x, e2.y, p.x, p.y);
      e2.velAng = e2.heading;
      enemies.push(e1, e2);
      pylons.length = 0;
      pylons.push(makePylon(p.x - 320, p.y + 120));
      pylons.push(makePylon(p.x + 330, p.y + 70));
      return true;
    },
    getHud() {
      return {
        score: state.score,
        hp: state.hp,
        maxHp: state.maxHp,
        boost: state.boost,
        boostMax: state.boostMax,
        mode: state.mode,
        modeTime: state.modeTime,
        combo: state.combo,
        comboTime: state.comboTime,
        stage: state.stage,
        time: state.time,
        kills: state.kills,
        stars: state.stars,
      };
    },
  };
}
