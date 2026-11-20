// src/game/sim.js — Q ADVENTURE · 纯逻辑模拟（零 DOM/零依赖，可 node 直测）。
// 契约：createRun({seed, level}) → run；run.step(input) / run.getHud() / run.drainEvents()。
// input = { left, right, jump }（jump 为「本 tick 按下」的边沿信号，由 main/selfplay 提供）。
// 事件名（供渲染/音频/HUD 各自消费，见 docs/analysis.md）：jump / doubleJump / wallJump / land /
//   coinGet / starGet / stomp / enemyDefeat / hurt / death / respawn / checkpoint / goalReached /
//   levelClear / gameComplete / spring / beatJump / nearMiss / milestone。
import { WORLD, STEP } from '../../config/game.config.js';
import { P, ENEMY, COLLECT, CAM, clamp } from '../../config/gameplay.js';
import { LEVELS, GROUND_Y } from '../../config/levels.js';
import { mulberry32 } from './rng.js';

const beatPhaseAt = (time) => ((time * P.BEAT_BPM) / 60) % 1;
const onBeatAt = (time) => {
  const b = beatPhaseAt(time);
  return b < P.BEAT_WINDOW || b > 1 - P.BEAT_WINDOW;
};

function overlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

// ---------------------------------------------------------------------------
// createRun
// ---------------------------------------------------------------------------
export function createRun({ seed = 0, level = 1 } = {}) {
  const rng = mulberry32(seed);
  const run = {
    rng,
    seed: seed >>> 0,
    phase: 'playing',   // playing | dead | won
    time: 0,
    levelIndex: clamp(Math.floor(level) || 1, 1, LEVELS.length),
    lives: P.LIVES,
    level: null,
    player: null,
    enemies: [],
    coins: [],
    stars: [],
    cameraX: 0,
    stats: {
      levelReached: clamp(Math.floor(level) || 1, 1, LEVELS.length),
      stars: 0,        // 累计星星
      coins: 0,        // 累计金币
      deaths: 0,
      noDamage: true,
    },
    levelStars: 0,
    levelCoins: 0,
    events: [],
    _milestoneX: 0,
    _checkpointSet: false,
    _lastNearMiss: -Infinity,
  };
  loadLevel(run, run.levelIndex);
  run.step = (input) => step(run, input);
  run.getHud = () => getHud(run);
  run.drainEvents = () => { const e = run.events; run.events = []; return e; };
  return run;
}

function loadLevel(run, index) {
  run.levelIndex = index;
  run.level = JSON.parse(JSON.stringify(LEVELS[index - 1]));
  const s = run.level.spawn;
  run.player = {
    x: s.x, y: s.y, w: P.W, h: P.H, vx: 0, vy: 0,
    onGround: true, facing: 1, coyote: 0, jumpBuffer: 0,
    wallCling: false, wallDir: 0, jumps: 0, hp: P.HP, invulnUntil: 0, squash: 0,
  };
  // 出生/过关切换的 2 秒无敌：避免教程期或刚进新关就被敌人扑死
  run.player.invulnUntil = run.time + 2.0;
  run.enemies = run.level.enemies;
  run.coins = run.level.coins;
  run.stars = run.level.stars;
  run.levelStars = 0;
  run.levelCoins = 0;
  run.cameraX = 0;
  run._milestoneX = s.x;
  run._checkpointSet = false;
}

// ---------------------------------------------------------------------------
// step
// ---------------------------------------------------------------------------
function step(run, input = {}) {
  if (run.phase !== 'playing') return;
  const dt = STEP;
  run.time += dt;
  const p = run.player;
  const inL = !!input.left;
  const inR = !!input.right;
  const jump = !!input.jump;

  if (inR) p.facing = 1;
  else if (inL) p.facing = -1;

  const prevOnGround = p.onGround;
  const prevBottom = p.y + p.h;
  const prevTop = p.y;

  // 水平加速
  const accel = p.onGround ? P.ACCEL : P.AIR_ACCEL;
  if (inR) p.vx += accel * dt;
  else if (inL) p.vx -= accel * dt;
  else p.vx *= (p.onGround ? P.FRICTION : 0.985);
  p.vx = clamp(p.vx, -P.RUN, P.RUN);

  // 风向
  const wind = run.level.wind;
  if (wind && p.x + p.w / 2 > wind.x0 && p.x + p.w / 2 < wind.x1) {
    p.vx += wind.dir * P.WIND_FORCE * dt;
  }

  // 土狼时间 / 跳跃缓冲
  if (jump) p.jumpBuffer = P.BUFFER_S;
  else p.jumpBuffer = Math.max(0, p.jumpBuffer - dt);
  if (p.onGround) p.coyote = P.COYOTE_S;
  else p.coyote = Math.max(0, p.coyote - dt);

  // 移动平台更新（碰撞前，玩家若站其上会一起被带）
  updateMovingPlatforms(run, dt);
  carryPlayer(run, dt);

  // 实体分类：fullSolid（可蹬墙） vs topOnly（只从上方落脚）
  const fullSolids = run.level.ground.concat(run.level.platforms.filter((pl) => pl.type === 'solid'));
  const topOnly = run.level.platforms.filter((pl) => pl.type === 'oneway' || pl.type === 'moving' || pl.type === 'spring');

  // 水平移动 + 碰撞（仅 fullSolid 挡墙）
  p.x += p.vx * dt;
  let wallHit = false;
  let wallDir = 0;
  for (const s of fullSolids) {
    if (!overlap(p, s)) continue;
    // 站在该实体顶部（脚底≈顶面）时不作为水平墙处理，只做垂直落脚
    if (p.y + p.h <= s.y + 8) continue;
    if (p.vx > 0) { p.x = s.x - p.w; wallDir = 1; }
    else if (p.vx < 0) { p.x = s.x + s.w; wallDir = -1; }
    else if (p.x + p.w / 2 < s.x + s.w / 2) { p.x = s.x - p.w; wallDir = 1; }
    else { p.x = s.x + s.w; wallDir = -1; }
    p.vx = 0;
    wallHit = true;
  }

  // 贴墙吸附：空中碰到实体墙
  p.wallCling = !p.onGround && wallHit;
  p.wallDir = wallDir;

  // 跳跃
  if (p.jumpBuffer > 0) {
    if (p.onGround || p.coyote > 0) {
      launch(run, P.JUMP_VY, 'jump');
      p.jumpBuffer = 0; p.coyote = 0; p.jumps = 1;
    } else if (p.wallCling) {
      const dir = p.wallDir === 1 ? -1 : 1;
      p.vy = P.WALL_JUMP_VY;
      p.vx = P.WALL_JUMP_VX * dir;
      p.wallCling = false;
      p.jumps = 1;
      p.squash = 1;
      emit(run, 'wallJump', { x: p.x, y: p.y });
      p.jumpBuffer = 0;
    } else if (p.jumps < 2) {
      launch(run, P.DOUBLE_VY, 'doubleJump');
      p.jumpBuffer = 0; p.jumps = 2;
    }
  }

  // 重力 / 贴墙下滑（falling 用于踩敌判定：保留落地前的下落状态）
  const falling = p.vy > 0;
  if (p.wallCling) p.vy = Math.min(p.vy + P.GRAVITY * dt, P.WALL_SLIDE_MAX);
  else p.vy = Math.min(p.vy + P.GRAVITY * dt, P.MAX_FALL);

  p.y += p.vy * dt;
  let landed = false;

  // fullSolid 垂直碰撞（落地 / 撞头）
  for (const s of fullSolids) {
    if (!overlap(p, s)) continue;
    if (p.vy >= 0 && prevBottom <= s.y + 10) { p.y = s.y - p.h; p.vy = 0; landed = true; }
    else if (p.vy < 0 && prevTop >= s.y + s.h - 10) { p.y = s.y + s.h; p.vy = 0; }
  }
  // topOnly 只从上方落脚
  for (const s of topOnly) {
    if (!overlap(p, s)) continue;
    if (p.vy >= 0 && prevBottom <= s.y + 12) {
      p.y = s.y - p.h; p.vy = 0; landed = true;
      if (s.type === 'spring') { p.vy = P.SPRING_VY; p.onGround = false; p.squash = 1; emit(run, 'spring', { x: s.x, y: s.y }); }
    }
  }

  if (landed) {
    p.onGround = true;
    if (!prevOnGround) emit(run, 'land', { x: p.x, y: p.y });
  } else {
    p.onGround = false;
  }
  if (p.onGround) p.jumps = 0;

  // 世界边界
  p.x = clamp(p.x, 0, Math.max(WORLD.WIDTH, run.level.width) - p.w);

  // 尖刺
  for (const s of run.level.platforms) {
    if (s.type !== 'spike') continue;
    if (overlap(p, { x: s.x + 4, y: s.y, w: s.w - 8, h: s.h })) hurt(run);
  }

  // 敌人行为树 + 碰撞
  updateEnemies(run, dt);
  handleEnemyCollisions(run, prevBottom, falling);

  // 收集
  handleCollectibles(run);

  // 检查点（每关中途一次，死亡后由此重生）
  if (!run._checkpointSet && p.x > Math.min(1600, run.level.width - 800)) {
    run._checkpointSet = true;
    run.level.respawn = { x: Math.max(p.x, run.level.spawn.x), y: p.y };
    emit(run, 'checkpoint', { x: run.level.respawn.x });
  }

  // 目标 / 过关
  checkGoal(run);

  // 掉落深渊
  if (p.y > WORLD.HEIGHT + 80) die(run);

  // 相机
  run.cameraX = clamp(p.x + p.w / 2 - WORLD.WIDTH * 0.45, 0, Math.max(0, run.level.width - WORLD.WIDTH));

  // 细粒度里程碑（保证事件密度 / maxEventGap ≤3s）
  if (p.x - run._milestoneX >= CAM.MILESTONE_PX) {
    run._milestoneX = p.x;
    emit(run, 'milestone', { x: p.x });
  }

  // 近身擦肩（nearMiss 钩子）
  maybeNearMiss(run);

  p.squash = Math.max(0, p.squash - dt * 7);
  run.stats.levelReached = Math.max(run.stats.levelReached, run.levelIndex);
}

function launch(run, vy, type) {
  const p = run.player;
  const onBeat = onBeatAt(run.time);
  p.vy = onBeat ? vy * P.BEAT_BONUS : vy;
  p.onGround = false;
  p.wallCling = false;
  p.squash = 1;
  emit(run, type, { x: p.x, y: p.y });
  if (onBeat) emit(run, 'beatJump', { x: p.x, y: p.y });
}

function updateMovingPlatforms(run, dt) {
  for (const s of run.level.platforms) {
    if (s.type !== 'moving') continue;
    s.x += (s.vx || 0) * dt;
    if (s.x < s.minX) { s.x = s.minX; s.vx = Math.abs(s.vx); }
    else if (s.x > s.maxX) { s.x = s.maxX; s.vx = -Math.abs(s.vx); }
  }
}

function carryPlayer(run, dt) {
  const p = run.player;
  for (const s of run.level.platforms) {
    if (s.type !== 'moving') continue;
    const standing = p.onGround && Math.abs((p.y + p.h) - s.y) < 6 && p.x + p.w > s.x && p.x < s.x + s.w;
    if (standing) p.x += (s.vx || 0) * dt;
  }
}

// 行为树：Look（玩家在视野内）→ Chase；否则 Patrol（还原原作 BehaviorTree.js Priority[Look→Attack, Patrol]）
function updateEnemies(run, dt) {
  const p = run.player;
  for (const e of run.enemies) {
    const dx = p.x - e.x;
    const dist = Math.abs(dx);
    if (dist < ENEMY.SIGHT && Math.abs(p.y - e.y) < 170) e.state = 'chase';
    else e.state = 'patrol';

    let vx;
    if (e.state === 'chase') {
      vx = (dx >= 0 ? 1 : -1) * ENEMY.CHASE_SPEED;
    } else {
      vx = e.dir * e.speed;
      if (e.x <= e.lo) { e.x = e.lo; e.dir = 1; }
      else if (e.x >= e.hi) { e.x = e.hi; e.dir = -1; }
    }
    e.vx = vx;
    e.x += vx * dt;
    e.squash = Math.max(0, e.squash - dt * 6);
  }
}

function handleEnemyCollisions(run, prevBottom, falling) {
  const p = run.player;
  for (const e of run.enemies) {
    if (e.hp <= 0) continue;
    if (!overlap(p, e)) continue;
    const stomping = falling && prevBottom <= e.y + 14;
    if (stomping) {
      e.hp = 0;
      e.squash = 1;
      p.vy = P.STOMP_VY;
      p.squash = 1;
      emit(run, 'stomp', { x: e.x, y: e.y });
      emit(run, 'enemyDefeat', { x: e.x, y: e.y });
    } else {
      const beforeHp = p.hp;
      hurt(run);
      if (run.phase === 'playing' && p.hp < beforeHp) {
        p.vx = (p.x + p.w / 2 < e.x + e.w / 2 ? -1 : 1) * 280;
      }
    }
  }
  run.enemies = run.enemies.filter((e) => e.hp > 0);
}

function handleCollectibles(run) {
  const p = run.player;
  const pcx = p.x + p.w / 2;
  const pcy = p.y + p.h / 2;
  run.coins = run.coins.filter((c) => {
    if (Math.hypot(pcx - c.x, pcy - c.y) <= COLLECT.PICKUP) {
      run.stats.coins += 1;
      run.levelCoins += 1;
      emit(run, 'coinGet', { x: c.x, y: c.y });
      return false;
    }
    return true;
  });
  run.stars = run.stars.filter((s) => {
    if (Math.hypot(pcx - s.x, pcy - s.y) <= COLLECT.PICKUP) {
      run.stats.stars += 1;
      run.levelStars += 1;
      emit(run, 'starGet', { x: s.x, y: s.y });
      return false;
    }
    return true;
  });
}

function checkGoal(run) {
  const g = run.level.goal;
  if (!g || run.player.x + run.player.w < g.x) return;
  emit(run, 'goalReached', { level: run.levelIndex, x: g.x });
  if (run.levelIndex >= LEVELS.length) {
    run.phase = 'won';
    emit(run, 'gameComplete', {});
    return;
  }
  emit(run, 'levelClear', { level: run.levelIndex, stars: run.levelStars, coins: run.levelCoins });
  run.stats.levelReached = Math.max(run.stats.levelReached, run.levelIndex + 1);
  loadLevel(run, run.levelIndex + 1);
}

function hurt(run) {
  const p = run.player;
  if (run.time < p.invulnUntil) return;
  p.hp -= 1;
  p.invulnUntil = run.time + P.INVULN_S;
  run.stats.noDamage = false;
  emit(run, 'hurt', { hp: p.hp, x: p.x, y: p.y });
  if (p.hp <= 0) die(run);
}

function die(run) {
  if (run.phase !== 'playing') return;
  run.stats.deaths += 1;
  emit(run, 'death', {});
  run.lives -= 1;
  if (run.lives <= 0) {
    run.phase = 'dead';
    return;
  }
  respawn(run);
}

function respawn(run) {
  const s = run.level.respawn || run.level.spawn;
  const p = run.player;
  p.x = s.x; p.y = s.y; p.vx = 0; p.vy = 0;
  p.onGround = false; p.wallCling = false; p.jumps = 0;
  p.hp = P.HP;
  p.invulnUntil = run.time + P.INVULN_S;
  emit(run, 'respawn', { x: s.x, y: s.y });
}

function maybeNearMiss(run) {
  const p = run.player;
  if (run.time - run._lastNearMiss < 1) return;
  for (const e of run.enemies) {
    if (Math.abs(e.x - p.x) < 90 && Math.abs(e.y - p.y) < 80 && !overlap(p, e)) {
      run._lastNearMiss = run.time;
      emit(run, 'nearMiss', { x: p.x, y: p.y });
      return;
    }
  }
}

// ---------------------------------------------------------------------------
// HUD / 事件
// ---------------------------------------------------------------------------
function getHud(run) {
  const p = run.player;
  return {
    phase: run.phase,
    time: run.time,
    level: run.levelIndex,
    levelName: run.level.nameKey,
    pack: run.level.pack,
    stars: run.levelStars,
    starsTotal: run.stats.stars,
    coins: run.stats.coins,
    hp: Math.max(0, p.hp),
    maxHp: P.HP,
    lives: Math.max(0, run.lives),
    beat: onBeatAt(run.time),
    beatPhase: beatPhaseAt(run.time),
    goalX: run.level.goal ? run.level.goal.x : run.level.width,
    cameraX: run.cameraX,
    playerX: p.x,
    playerY: p.y,
    onGround: p.onGround,
    wallCling: p.wallCling,
    width: run.level.width,
  };
}

function emit(run, type, fields = {}) {
  run.events.push({ type, ...fields });
}
