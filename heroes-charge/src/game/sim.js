// src/game/sim.js — 纯逻辑（可无浏览器测试）：霓虹横版格斗
// 状态机：stand/move/jump/attack/dash/special/dead；敌人 patrol/chase/dead。
// 输入（逐帧边沿）：{ left, right, jump, attack, dash, special }
// 输出：run.events（drainEvents 消费）、run.getHud()、run.phase。
import { WORLD, STEP } from '../../config/game.config.js';
import { PLAYER, ENEMY, ORB, SCORE, LEVELS, TOTAL_LEVELS, PLAYER_SPAWN_X } from '../../config/gameplay.js';

const FRAME = STEP;

function makeEnemy(def, id) {
  return {
    id,
    x: def.x,
    baseX: def.x,
    hp: def.hp,
    maxHp: def.hp,
    range: def.range ?? 120,
    speed: def.speed ?? 60,
    boss: !!def.boss,
    state: 'patrol',   // patrol | chase | dead
    dir: -1,
    atkCd: 30,
    hurtT: 0,
    dead: false,
    deadT: 0,
    w: def.boss ? 76 : 56,
    h: def.boss ? 104 : 72,
  };
}

function makePlayer() {
  return {
    x: PLAYER_SPAWN_X,
    y: 0,               // 脚底离地高度（0 = 着地）
    vy: 0,
    facing: 1,
    hp: PLAYER.MAX_HP,
    maxHp: PLAYER.MAX_HP,
    onGround: true,
    jumpCount: 0,
    state: 'stand',     // stand | move | jump | attack | dash | special | dead
    stateT: 0,
    attackStep: 0,      // 二段连击交替 0/1
    dashMeter: 1,
    shield: false,
    hurtT: 0,
    combo: 0,
    comboT: 0,
    bestCombo: 0,
  };
}

export function createRun(opts = {}) {
  const levelDef = LEVELS[0];
  const run = {
    phase: 'playing',   // playing | victory | dead
    time: 0,
    level: 1,
    levelsReached: 1,
    score: 0,
    stars: 0,
    kills: 0,
    player: makePlayer(),
    enemies: levelDef.enemies.map((d, i) => makeEnemy(d, `e${i}`)),
    orbs: [],
    projectiles: [],
    events: [],
    levelDef,
    levelClearT: -1,
    levelIntroT: 40,
    pendingStars: 0,
  };

  run.step = (input = {}) => stepRun(run, input);
  run.getHud = () => getHud(run);
  run.drainEvents = () => {
    const ev = run.events;
    run.events = [];
    return ev;
  };
  run.jumpTo = (level) => jumpTo(run, level);
  return run;
}

function getHud(run) {
  const p = run.player;
  return {
    time: run.time,
    level: run.level,
    hp: p.hp,
    maxHp: p.maxHp,
    dash: p.dashMeter,
    combo: p.combo,
    bestCombo: p.bestCombo,
    enemiesLeft: run.enemies.filter((e) => !e.dead).length,
    score: run.score,
    stars: run.stars,
    shield: p.shield,
    phase: run.phase,
  };
}

function push(run, type, extra = {}) {
  run.events.push({ type, ...extra });
}

function clamp(v, a, b) {
  return v < a ? a : v > b ? b : v;
}

// ---- 战斗判定 ----

function inFrontOf(p, e) {
  return (p.facing === 1 && e.x >= p.x - 12) || (p.facing === -1 && e.x <= p.x + 12);
}

function addCombo(run) {
  const p = run.player;
  p.combo += 1;
  p.comboT = PLAYER.COMBO_WINDOW;
  if (p.combo > p.bestCombo) p.bestCombo = p.combo;
  if (p.combo % 5 === 0) push(run, 'combo', { combo: p.combo });
}

function hurtEnemy(run, e, dmg) {
  if (e.dead) return;
  e.hp -= dmg;
  e.hurtT = 12;
  if (e.state !== 'dead') e.state = 'chase';
  // 击退：把敌人从玩家身前推开，避免敌人叠在玩家身上
  const dir = e.x >= run.player.x ? 1 : -1;
  e.x = clamp(e.x + dir * 26, 24, (run.levelDef.width ?? WORLD.LEVEL_W) - 24);
  addCombo(run);
  push(run, 'hit', { enemy: e.id });
  if (e.hp <= 0) {
    e.dead = true;
    e.state = 'dead';
    e.deadT = 0;
    run.kills += 1;
    const bonus = Math.floor(run.player.combo / 5) * SCORE.KILL_PER_COMBO;
    run.score += SCORE.KILL + bonus;
    push(run, 'enemyDown', { enemy: e.id, boss: e.boss });
    dropLoot(run, e);
  }
}

function dropLoot(run, e) {
  // 每个敌人掉一颗能量球；每击杀 N 个额外掉一个护盾核心（确定性）。
  run.orbs.push({ x: e.x, y: e.h ? -e.h + 20 : -52, type: 'energy', t: 0 });
  if (run.kills % ORB.SHIELD_EVERY === 0) {
    run.orbs.push({ x: e.x + 18, y: -72, type: 'shield', t: 0 });
  }
}

function meleeHit(run, dmg) {
  const p = run.player;
  for (const e of run.enemies) {
    if (e.dead) continue;
    if (inFrontOf(p, e) && Math.abs(e.x - p.x) <= PLAYER.ATTACK_RANGE) {
      hurtEnemy(run, e, dmg);
    }
  }
}

function spinHit(run, dmg) {
  const p = run.player;
  for (const e of run.enemies) {
    if (e.dead) continue;
    if (Math.abs(e.x - p.x) <= PLAYER.SPIN_RANGE) {
      hurtEnemy(run, e, dmg);
    }
  }
}

function damagePlayer(run, fromX) {
  const p = run.player;
  if (p.hurtT > 0) return;
  if (p.shield) {
    p.shield = false;
    p.hurtT = PLAYER.INVULN_FRAMES;
    push(run, 'shield', { broken: true });
    return;
  }
  p.hp -= 1;
  p.hurtT = PLAYER.INVULN_FRAMES;
  p.x += (p.x >= fromX ? 1 : -1) * 34;
  push(run, 'playerHurt', { hp: p.hp });
  if (p.hp <= 0) {
    p.hp = 0;
    p.state = 'dead';
    run.phase = 'dead';
    push(run, 'lose', {});
  }
}

// ---- 敌人 AI ----

function updateEnemy(run, e, p) {
  if (e.dead) {
    e.deadT += 1;
    return;
  }
  if (e.hurtT > 0) e.hurtT -= 1;
  if (e.atkCd > 0) e.atkCd -= 1;

  const dx = p.x - e.x;
  const dist = Math.abs(dx);
  const W = run.levelDef.width ?? WORLD.LEVEL_W;

  if (e.state === 'patrol') {
    e.x += e.dir * e.speed * FRAME;
    if (e.x > e.baseX + e.range) { e.x = e.baseX + e.range; e.dir = -1; }
    else if (e.x < e.baseX - e.range) { e.x = e.baseX - e.range; e.dir = 1; }
    if (dist < ENEMY.CHASE_DIST) e.state = 'chase';
  } else if (e.state === 'chase') {
    if (dist > ENEMY.LOSE_DIST) {
      e.state = 'patrol';
    } else if (dist < ENEMY.ATTACK_DIST) {
      if (e.atkCd <= 0) {
        damagePlayer(run, e.x);
        e.atkCd = ENEMY.ATTACK_CD;
      }
    } else {
      e.x += (dx >= 0 ? 1 : -1) * e.speed * FRAME;
    }
  }

  // 世界边界
  e.x = clamp(e.x, 24, W - 24);
}

function updateProjectiles(run) {
  const p = run.player;
  const W = run.levelDef.width ?? WORLD.LEVEL_W;
  for (const b of run.projectiles) {
    b.x += b.vx * FRAME;
    b.t += FRAME;
    if (b.t > 1.5 || b.x < 0 || b.x > W) { b.hp = 0; }
    for (const e of run.enemies) {
      if (e.dead || b.hp <= 0) continue;
      if (Math.abs(e.x - b.x) <= 32) {
        b.hp -= 1;
        hurtEnemy(run, e, PLAYER.BOLT_DAMAGE);
        if (b.hp <= 0) break;
      }
    }
  }
  run.projectiles = run.projectiles.filter((b) => b.hp > 0);
}

function updateOrbs(run) {
  const p = run.player;
  const keep = [];
  for (const o of run.orbs) {
    o.t += 1;
    if (o.t > ORB.LIFETIME_FRAMES) continue;
    // 收集：水平 36px、垂直 70px 内
    const dy = Math.abs(o.y - (p.y - 40));
    if (Math.abs(o.x - p.x) <= 36 && dy <= 70) {
      if (o.type === 'energy') {
        p.dashMeter = clamp(p.dashMeter + ORB.ENERGY_REFILL, 0, 1);
        run.score += SCORE.ORB;
        push(run, 'orb', {});
      } else {
        p.shield = true;
        run.score += SCORE.SHIELD;
        push(run, 'shield', { broken: false });
      }
      continue;
    }
    keep.push(o);
  }
  run.orbs = keep;
}

function computeStars(run) {
  const p = run.player;
  const hpRatio = p.hp / p.maxHp;
  let stars = 1;
  if (hpRatio >= 0.5) stars += 1;
  if (p.bestCombo >= 8) stars += 1;
  return clamp(stars, 1, 3);
}

function advanceLevel(run) {
  const p = run.player;
  if (run.level >= TOTAL_LEVELS) {
    run.phase = 'victory';
    push(run, 'win', { stars: run.stars });
    return;
  }
  run.level += 1;
  run.levelsReached = run.level;
  run.levelDef = LEVELS[run.level - 1];
  run.enemies = run.levelDef.enemies.map((d, i) => makeEnemy(d, `e${i}`));
  run.orbs = [];
  run.projectiles = [];
  p.x = PLAYER_SPAWN_X;
  p.y = 0;
  p.vy = 0;
  p.onGround = true;
  p.state = 'stand';
  p.combo = 0;
  p.comboT = 0;
  run.levelClearT = -1;
  run.levelIntroT = 40;
  run.pendingStars = 0;
  push(run, 'levelStart', { level: run.level });
}

function checkLevelClear(run) {
  const p = run.player;
  if (run.levelClearT >= 0) {
    run.levelClearT -= 1;
    // 星级逐个揭示（奖励反馈，也避免过渡期无事件）
    if (run.pendingStars > 0 && (run.levelClearT === 50 || run.levelClearT === 38 || run.levelClearT === 26)) {
      run.pendingStars -= 1;
      push(run, 'star', { stars: run.stars - run.pendingStars });
    }
    if (run.levelClearT <= 0) advanceLevel(run);
    return;
  }
  const anyAlive = run.enemies.some((e) => !e.dead);
  if (!anyAlive) {
    const stars = computeStars(run);
    run.stars += stars;
    run.score += SCORE.LEVEL_CLEAR + stars * SCORE.PER_STAR;
    run.pendingStars = stars;
    push(run, 'levelClear', { level: run.level, stars });
    run.levelClearT = 60;
  }
}

// ---- 主步进 ----

function stepRun(run, input = {}) {
  if (run.phase !== 'playing') {
    run.time += FRAME;
    return run;
  }
  run.time += FRAME;
  const p = run.player;

  if (run.levelIntroT > 0) run.levelIntroT -= 1;

  let dir = 0;
  if (input.left) dir -= 1;
  if (input.right) dir += 1;

  // 跳跃（二段跳）
  if (input.jump && p.jumpCount < 2 && p.state !== 'dash') {
    p.vy = PLAYER.JUMP_V;
    p.jumpCount += 1;
    p.onGround = false;
    p.state = 'jump';
    push(run, 'jump', { count: p.jumpCount });
  }

  // 冲刺
  if (input.dash && p.dashMeter >= PLAYER.DASH_COST && p.state !== 'dash') {
    p.dashMeter = clamp(p.dashMeter - PLAYER.DASH_COST, 0, 1);
    p.state = 'dash';
    p.stateT = PLAYER.DASH_FRAMES;
    push(run, 'dash', {});
  }

  // 攻击（二段连击，出手即命中）
  if (input.attack && p.state !== 'attack' && p.state !== 'special') {
    p.state = 'attack';
    p.stateT = PLAYER.ATTACK_FRAMES;
    p.attackStep = p.attackStep ? 0 : 1;
    push(run, 'attack', { step: p.attackStep });
    meleeHit(run, PLAYER.ATTACK_DAMAGE);
  }

  // 技能：地面 → 光弹；二段跳 → 旋转斩
  if (input.special && p.state !== 'special') {
    if (!p.onGround && p.jumpCount === 2) {
      p.state = 'special';
      p.stateT = 20;
      push(run, 'special', { kind: 'spin' });
      spinHit(run, PLAYER.SPIN_DAMAGE);
    } else if (p.onGround) {
      p.state = 'special';
      p.stateT = 20;
      run.projectiles.push({ x: p.x + p.facing * 34, y: p.y - 40, vx: p.facing * PLAYER.BOLT_SPEED, hp: PLAYER.BOLT_HP, t: 0 });
      push(run, 'special', { kind: 'bolt' });
    }
  }

  // 水平移动
  if (p.state === 'dash') {
    p.x += p.facing * PLAYER.DASH_SPEED * FRAME;
  } else if (p.state !== 'attack' && p.state !== 'special') {
    if (dir !== 0) {
      p.facing = dir;
      p.state = p.onGround ? 'move' : p.state;
    } else if (p.onGround && p.state === 'move') {
      p.state = 'stand';
    }
    p.x += dir * PLAYER.SPEED * FRAME;
  }

  const W = run.levelDef.width ?? WORLD.LEVEL_W;
  p.x = clamp(p.x, 24, W - 24);

  // 垂直运动（冲刺时浮空，无重力）
  if (p.state !== 'dash') {
    if (!p.onGround) {
      p.vy -= PLAYER.GRAVITY * FRAME;
      p.y += p.vy * FRAME;
      if (p.y <= 0) {
        p.y = 0;
        p.vy = 0;
        p.onGround = true;
        p.jumpCount = 0;
        if (p.state === 'jump') p.state = 'stand';
      }
    } else {
      p.y = 0;
    }
  }

  // 动作计时
  if (p.stateT > 0) {
    p.stateT -= 1;
    if (p.stateT <= 0 && (p.state === 'attack' || p.state === 'special' || p.state === 'dash')) {
      p.state = p.onGround ? 'stand' : 'jump';
    }
  }

  // 连击窗口衰减
  if (p.comboT > 0) {
    p.comboT -= FRAME;
    if (p.comboT <= 0) p.combo = 0;
  }

  // 冲刺能量回复
  p.dashMeter = clamp(p.dashMeter + PLAYER.DASH_REGEN * FRAME, 0, 1);

  // 受击无敌衰减
  if (p.hurtT > 0) p.hurtT -= 1;

  // 实体更新
  updateProjectiles(run);
  for (const e of run.enemies) updateEnemy(run, e, p);

  if (run.phase !== 'playing') return run;

  updateOrbs(run);

  if (run.phase !== 'playing') return run;

  checkLevelClear(run);

  return run;
}

// 调试/截图用：跳转到指定关卡
function jumpTo(run, level) {
  const lvl = clamp(level, 1, TOTAL_LEVELS);
  run.level = lvl;
  run.levelsReached = lvl;
  run.levelDef = LEVELS[lvl - 1];
  run.enemies = run.levelDef.enemies.map((d, i) => makeEnemy(d, `e${i}`));
  run.orbs = [];
  run.projectiles = [];
  const p = run.player;
  p.x = PLAYER_SPAWN_X;
  p.y = 0;
  p.vy = 0;
  p.onGround = true;
  p.state = 'stand';
  p.combo = 0;
  p.comboT = 0;
  run.levelClearT = -1;
  run.levelIntroT = 40;
  run.pendingStars = 0;
  run.phase = 'playing';
  return run;
}
