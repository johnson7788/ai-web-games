// 纯逻辑 sim：platform hop（左右移动 + 跳跃 + 顶箱子 + 踩敌 + 收集 + 关卡推进）。
// 无 DOM / 无随机（seed 由坐标派生），Node 可直接 import 跑测试与 selfplay。
// 输入：run.step({ left, right, jump })；事件：run.drainEvents()。
import { PHYS, SCORE, STEP, LAYOUT } from '../../config/game.config.js';
import { LEVELS } from '../../config/levels.js';

const TILE = LAYOUT.TILE;

function aabb(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function circleHit(cx, cy, r, a) {
  const nx = Math.max(a.x, Math.min(cx, a.x + a.w));
  const ny = Math.max(a.y, Math.min(cy, a.y + a.h));
  const dx = cx - nx;
  const dy = cy - ny;
  return dx * dx + dy * dy <= r * r;
}

export function createRun(levelIndex = 0, opts = {}) {
  const level = LEVELS[Math.max(0, Math.min(LEVELS.length - 1, levelIndex | 0))] || LEVELS[0];

  // 可变的实体（状态引用它们，render/selfplay 直读）
  const player = {
    x: level.playerStart.c * TILE + (TILE - 30) / 2,
    y: (level.playerStart.r + 1) * TILE - 40,
    w: 30,
    h: 40,
    vx: 0,
    vy: 0,
    onGround: true,
    coyote: 0,
    facing: 1,
    shield: false,
  };

  const boxMap = new Map();
  for (const b of level.boxes) boxMap.set(`${b.r},${b.c}`, { ...b, alive: true });

  const coins = level.coins.map((c) => ({ ...c, x: c.c * TILE + TILE / 2, y: c.r * TILE + TILE / 2, taken: false }));
  const stars = level.stars.map((s) => ({ ...s, x: s.c * TILE + TILE / 2, y: s.r * TILE + TILE / 2, taken: false }));
  const powerups = level.powerups.map((p) => ({
    ...p,
    x: p.c * TILE + TILE / 2,
    y: p.r * TILE + TILE / 2,
    taken: false,
  }));
  const monsters = level.monsters.map((m) => ({
    id: m.id,
    x: m.c * TILE,
    y: (m.r + 1) * TILE - 34,
    w: 40,
    h: 34,
    minX: m.c * TILE,
    maxX: (m.c + m.range) * TILE,
    dir: 1,
    speed: 60,
    alive: true,
  }));

  const flagRect = {
    x: level.flag.c * TILE,
    y: level.flag.r * TILE,
    w: TILE,
    h: (level.rows - level.flag.r) * TILE,
  };

  const state = {
    level: levelIndex + 1, // 1 基
    levelWidth: level.cols * TILE,
    levelSolidKeys: [...level.solid],
    levelSpikeKeys: [...level.spikes],
    levelRockKeys: [...level.rocks],
    phase: 'playing',      // playing | won | lost
    time: 0,
    score: 0,
    coinCount: 0,
    combo: 0,
    comboTimer: 0,
    starsCollected: 0,
    starsTotal: level.stars.length,
    starsEarned: 0,
    magnetUntil: 0,
    invulnUntil: 0,
    player,
    monsters,
    boxes: [...boxMap.values()],
    coins,
    stars,
    powerups,
    flagRect,
  };

  const events = [];
  let prevJump = false;
  let jumpBuffer = 0;

  function emit(type, payload = {}) {
    events.push({ type, ...payload });
  }

  function tileKind(cx, cy) {
    if (cx < 0 || cy < 0 || cx >= level.cols || cy >= level.rows) return null;
    if (level.solid.has(`${cy},${cx}`)) return 'solid';
    if (boxMap.has(`${cy},${cx}`)) return 'box';
    return null;
  }

  function hazardAt(cx, cy) {
    if (level.spikes.has(`${cy},${cx}`)) return 'spike';
    if (level.rocks.has(`${cy},${cx}`)) return 'rock';
    return null;
  }

  function addScore(n) {
    state.score += n;
  }

  function bumpCombo() {
    state.combo = Math.min(SCORE.COMBO_MAX, state.combo + 1);
    state.comboTimer = SCORE.COMBO_WINDOW;
    if (state.combo >= 2) emit('combo', { combo: state.combo });
  }

  function breakBox(cx, cy) {
    const key = `${cy},${cx}`;
    const box = boxMap.get(key);
    if (!box || !box.alive) return;
    box.alive = false;
    boxMap.delete(key);
    emit('box', { id: box.id, coins: box.coins });
    for (let i = 0; i < box.coins; i += 1) {
      bumpCombo();
      state.coinCount += 1;
      addScore(SCORE.COIN_BASE * state.combo);
      emit('coin', { fromBox: true });
    }
  }

  function collectCoin(c) {
    c.taken = true;
    bumpCombo();
    state.coinCount += 1;
    addScore(SCORE.COIN_BASE * state.combo);
    emit('coin', {});
  }

  function hurt(reason) {
    if (state.invulnUntil > 0) return;
    if (player.shield) {
      player.shield = false;
      state.invulnUntil = PHYS.INVULN;
      emit('hurt', { reason, shielded: true });
      return;
    }
    die(reason);
  }

  function die(reason) {
    if (state.phase !== 'playing') return;
    state.phase = 'lost';
    emit('lose', { reason });
  }

  function win() {
    if (state.phase !== 'playing') return;
    state.phase = 'won';
    state.starsEarned = Math.min(3, 1 + state.starsCollected);
    emit('win', { stars: state.starsEarned, starsCollected: state.starsCollected, score: state.score });
  }

  function resolveVertical(p, wasGround) {
    if (p.vy >= 0) {
      p.onGround = false;
      const bottom = p.y + p.h;
      const cy = Math.floor(bottom / TILE);
      const cx0 = Math.floor((p.x + 1) / TILE);
      const cx1 = Math.floor((p.x + p.w - 1) / TILE);
      for (let cx = cx0; cx <= cx1; cx += 1) {
        if (tileKind(cx, cy)) {
          p.y = cy * TILE - p.h;
          p.vy = 0;
          p.onGround = true;
          p.coyote = PHYS.COYOTE;
          if (!wasGround) emit('land', {});
          break;
        }
      }
    } else {
      const cy = Math.floor(p.y / TILE);
      const cx0 = Math.floor((p.x + 1) / TILE);
      const cx1 = Math.floor((p.x + p.w - 1) / TILE);
      for (let cx = cx0; cx <= cx1; cx += 1) {
        const kind = tileKind(cx, cy);
        if (kind === 'box') {
          breakBox(cx, cy);
          p.vy = 0;
          break;
        }
        if (kind === 'solid') {
          p.y = (cy + 1) * TILE;
          p.vy = 0;
          break;
        }
      }
    }
  }

  function resolveHorizontal(p) {
    const cy0 = Math.floor((p.y + 1) / TILE);
    const cy1 = Math.floor((p.y + p.h - 1) / TILE);
    if (p.vx > 0) {
      const cx = Math.floor((p.x + p.w) / TILE);
      for (let cy = cy0; cy <= cy1; cy += 1) {
        if (tileKind(cx, cy)) { p.x = cx * TILE - p.w - 0.01; p.vx = 0; break; }
      }
    } else if (p.vx < 0) {
      const cx = Math.floor(p.x / TILE);
      for (let cy = cy0; cy <= cy1; cy += 1) {
        if (tileKind(cx, cy)) { p.x = (cx + 1) * TILE + 0.01; p.vx = 0; break; }
      }
    }
    if (p.x < 0) p.x = 0;
    if (p.x + p.w > level.cols * TILE) p.x = level.cols * TILE - p.w;
  }

  function collectPickups() {
    for (const c of coins) {
      if (!c.taken && circleHit(c.x, c.y, 14, player)) collectCoin(c);
    }
    for (const s of stars) {
      if (!s.taken && circleHit(s.x, s.y, 16, player)) {
        s.taken = true;
        state.starsCollected += 1;
        addScore(SCORE.STAR);
        emit('star', { id: s.id });
      }
    }
    for (const p of powerups) {
      if (!p.taken && circleHit(p.x, p.y, 16, player)) {
        p.taken = true;
        if (p.kind === 'magnet') {
          state.magnetUntil = state.time + SCORE.MAGNET_SEC;
          emit('magnet', { id: p.id });
        } else {
          player.shield = true;
          emit('shield', { id: p.id });
        }
      }
    }
  }

  function attractCoins() {
    const px = player.x + player.w / 2;
    const py = player.y + player.h / 2;
    for (const c of coins) {
      if (c.taken) continue;
      const dx = px - c.x;
      const dy = py - c.y;
      const d = Math.hypot(dx, dy);
      if (d > 0 && d < SCORE.MAGNET_RADIUS) {
        const pull = Math.min(d, 6);
        c.x += (dx / d) * pull;
        c.y += (dy / d) * pull;
      }
    }
  }

  function checkHazards() {
    const cx0 = Math.floor((player.x + 1) / TILE);
    const cx1 = Math.floor((player.x + player.w - 1) / TILE);
    const cy0 = Math.floor((player.y + 1) / TILE);
    const cy1 = Math.floor((player.y + player.h - 1) / TILE);
    for (let cy = cy0; cy <= cy1; cy += 1) {
      for (let cx = cx0; cx <= cx1; cx += 1) {
        const h = hazardAt(cx, cy);
        if (h) { hurt(h); return; }
      }
    }
  }

  function checkFlag() {
    if (aabb(player, flagRect)) win();
  }

  function updateMonsters(dt) {
    for (const m of monsters) {
      if (!m.alive) continue;
      m.x += m.dir * m.speed * dt;
      if (m.x <= m.minX) { m.x = m.minX; m.dir = 1; }
      else if (m.x + m.w >= m.maxX) { m.x = m.maxX - m.w; m.dir = -1; }
    }
  }

  function checkMonsterCollision(prevBottom) {
    for (const m of monsters) {
      if (!m.alive) continue;
      if (!aabb(player, m)) continue;
      // 从上方踩（正在下落，且上一帧脚在怪头顶之上）
      if (player.vy > 0 && prevBottom <= m.y + 8) {
        m.alive = false;
        player.vy = -PHYS.STOMP_BOUNCE;
        addScore(SCORE.STOMP);
        emit('stomp', { id: m.id });
      } else {
        hurt('monster');
      }
    }
  }

  function step(input = {}) {
    if (state.phase !== 'playing') return;

    const dt = STEP;
    state.time += dt;

    const left = !!input.left;
    const right = !!input.right;
    const jumpHeld = !!input.jump;
    if (jumpHeld && !prevJump) jumpBuffer = PHYS.JUMP_BUFFER;
    prevJump = jumpHeld;

    if (jumpBuffer > 0) jumpBuffer -= dt;
    if (state.comboTimer > 0) {
      state.comboTimer -= dt;
      if (state.comboTimer <= 0) state.combo = 0;
    }
    if (state.invulnUntil > 0) state.invulnUntil -= dt;
    if (state.magnetUntil > 0) state.magnetUntil -= dt;
    if (player.coyote > 0) player.coyote -= dt;

    player.vx = left ? -PHYS.SPEED : right ? PHYS.SPEED : 0;
    if (left) player.facing = -1;
    else if (right) player.facing = 1;

    if ((player.onGround || player.coyote > 0) && jumpBuffer > 0) {
      player.vy = -PHYS.JUMP_V;
      player.onGround = false;
      player.coyote = 0;
      jumpBuffer = 0;
      emit('jump', {});
    }

    player.vy += PHYS.GRAVITY * dt;
    if (player.vy > PHYS.MAX_FALL) player.vy = PHYS.MAX_FALL;

    const wasGround = player.onGround;
    const prevBottom = player.y + player.h;

    player.y += player.vy * dt;
    resolveVertical(player, wasGround);

    player.x += player.vx * dt;
    resolveHorizontal(player);

    if (state.magnetUntil > 0) attractCoins();
    collectPickups();
    updateMonsters(dt);
    checkMonsterCollision(prevBottom);
    if (state.phase === 'playing') checkHazards();
    if (state.phase === 'playing') checkFlag();

    // 掉出关卡
    if (state.phase === 'playing' && player.y > level.rows * TILE + 40) {
      die('pit');
    }
  }

  function drainEvents() {
    return events.splice(0, events.length);
  }

  return {
    state,
    level,
    step,
    drainEvents,
    getHud() {
      return {
        level: state.level,
        time: state.time,
        score: state.score,
        coins: state.coinCount,
        combo: state.combo,
        starsCollected: state.starsCollected,
        starsTotal: state.starsTotal,
        shield: player.shield,
        magnet: state.magnetUntil > 0,
      };
    },
  };
}
