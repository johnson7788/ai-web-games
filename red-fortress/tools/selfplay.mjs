#!/usr/bin/env node
// 赤色要塞 · 自走 AI（无作弊）：网格 BFS 寻路 + 保守闪避 + Boss 绕圈
// 用途：无头验证 4 关可通关、救援闭环（交付 ≥6）、Boss 可击杀。
// 约束：不使用 run.debug / 不回血 / 直接扣 Boss 血 / 卡住瞬移。
import { createRun, emptyMods } from '../src/game/sim.js';
import { STAGES, STAGE_COUNT } from '../config/levels.js';
import { WORLD } from '../config/game.config.js';
import { isWalkable } from '../src/game/level.js';

const TILE = WORLD.TILE;
const DT = WORLD.STEP;
const VERBOSE = process.argv.includes('--verbose');

const UPGRADE_PRIORITY = ['armor', 'reload', 'spread', 'demo', 'turbo', 'repair', 'pierce', 'magnet'];

// ─── 地图工具 ───
function center(tx, ty) {
  return { x: tx * TILE + TILE / 2, y: ty * TILE + TILE / 2 };
}

function walkableTile(map, tx, ty) {
  if (tx < 0 || ty < 0 || tx >= map.cols || ty >= map.rows) return false;
  return isWalkable(map, tx * TILE + TILE / 2, ty * TILE + TILE / 2);
}

function tileOf(x, y) {
  return { tx: Math.floor(x / TILE), ty: Math.floor(y / TILE) };
}

// BFS：返回从起点到目标的下一批格子（含终点）
function bfsPath(map, sx, sy, gx, gy) {
  const w = map.cols;
  const h = map.rows;
  if (sx === gx && sy === gy) return [];
  if (!walkableTile(map, gx, gy)) return null;
  const start = sy * w + sx;
  const goal = gy * w + gx;
  const seen = new Uint8Array(w * h);
  const prev = new Int32Array(w * h).fill(-1);
  const q = [start];
  seen[start] = 1;
  let found = false;
  for (let head = 0; head < q.length; head += 1) {
    const cur = q[head];
    if (cur === goal) { found = true; break; }
    const x = cur % w;
    const y = (cur / w) | 0;
    const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    for (const [dx, dy] of nb) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const ni = ny * w + nx;
      if (seen[ni] || !walkableTile(map, nx, ny)) continue;
      seen[ni] = 1;
      prev[ni] = cur;
      q.push(ni);
    }
  }
  if (!found) return null;
  const path = [];
  let cur = goal;
  while (cur !== start) {
    path.push([cur % w, (cur / w) | 0]);
    cur = prev[cur];
    if (cur < 0) return null;
  }
  path.reverse();
  return path;
}

// ─── 感知 ───
function nearestEnemy(run, maxDist = 720) {
  const p = run.player;
  let best = null;
  let bd = maxDist;
  for (const e of run.entities) {
    if (e.dead || e.kind !== 'enemy') continue;
    if (e.y > p.y + 120 || e.y < p.y - maxDist) continue;
    const d = Math.hypot(e.x - p.x, e.y - p.y);
    if (d < bd) { bd = d; best = e; }
  }
  return best;
}

function nearestBossTarget(run) {
  const p = run.player;
  const b = run.boss;
  if (!b || !b.active) return null;
  if (b.type === 'tankboss') return b.entity && !b.entity.dead ? b.entity : null;
  const alive = (b.nodes || []).filter((n) => n.alive);
  if (alive.length) {
    let best = alive[0];
    let bd = Infinity;
    for (const n of alive) {
      const d = Math.hypot(n.x - p.x, n.y - p.y);
      if (d < bd) { bd = d; best = n; }
    }
    return best;
  }
  return b.core || null;
}

function insidePad(run) {
  const p = run.player;
  for (const z of run.zones) {
    if (z.type !== 'helipad') continue;
    if (p.x >= z.x && p.x <= z.x + z.w && p.y >= z.y && p.y <= z.y + z.h) return true;
  }
  return false;
}

function idlePow(run, maxDist = 520) {
  const p = run.player;
  let best = null;
  let bd = maxDist;
  for (const e of run.entities) {
    if (e.dead || e.kind !== 'pow' || e.state !== 'idle') continue;
    if (e.y > p.y + 80) continue; // 镜头只上移，身后的 POW 不再追
    const d = Math.hypot(e.x - p.x, e.y - p.y);
    if (d < bd) { bd = d; best = e; }
  }
  return best;
}

// 只找玩家上方的停机坪（镜头只上移，身后的点已不可达）
function nextPadAbove(run) {
  const p = run.player;
  let best = null;
  let bd = Infinity;
  for (const z of run.zones) {
    if (z.type !== 'helipad') continue;
    const cy = z.y + z.h / 2;
    if (cy > p.y - 24) continue;
    const d = Math.hypot(z.x + z.w / 2 - p.x, cy - p.y);
    if (d < bd) { bd = d; best = { x: z.x + z.w / 2, y: cy }; }
  }
  return best;
}

// ─── 闪避 ───
function dodgeVector(run) {
  const p = run.player;
  let vx = 0;
  let vy = 0;
  for (const b of run.entities) {
    if (b.dead || b.kind !== 'bullet' || b.owner !== 'enemy') continue;
    const dx = p.x - b.x;
    const dy = p.y - b.y;
    const d = Math.hypot(dx, dy);
    if (d > 130 || d < 1) continue;
    const bs = Math.hypot(b.vx, b.vy);
    if (bs < 30) continue;
    const toward = (dx * b.vx + dy * b.vy) / (d * bs);
    if (toward < 0.45) continue;
    let px = -b.vy / bs;
    let py = b.vx / bs;
    if (dx * px + dy * py < 0) { px = -px; py = -py; }
    const w = (130 - d) / 130;
    vx += px * w;
    vy += py * w;
  }
  // 对坦克/炮塔保持距离
  return { x: vx, y: vy };
}

// ─── 单个决策 ───
function decide(run, mo) {
  const p = run.player;
  const input = { mx: 0, my: 0, aimX: p.x, aimY: p.y - 400, fire: false, grenade: false };
  if (!p.alive) return input;

  // 1) 决策目标
  const bossTarget = nearestBossTarget(run);
  let goal = null;
  let delivering = false;

  mo.bossDirect = false;
  if (bossTarget) {
    if (run.boss.type === 'boss') {
      const core = run.boss.core;
      // 绕核心大圈：持续横向移动躲炮，同时 4 个节点都在射程内
      const ang = (run.time * 0.9) % (Math.PI * 2);
      goal = { x: core.x + Math.cos(ang) * 300, y: core.y + Math.sin(ang) * 250 + 50 };
      mo.bossDirect = true;
    } else {
      goal = { x: bossTarget.x, y: bossTarget.y + 330 }; // 与坦克保持距离
    }
  } else {
    const pad = nextPadAbove(run);
    const padD = pad ? Math.hypot(pad.x - p.x, pad.y - p.y) : Infinity;
    const more = p.pow < p.maxPow ? idlePow(run, 720) : null;
    if (p.pow > 0 && pad && insidePad(run)) {
      delivering = true;
      goal = { x: p.x, y: p.y };
      mo.mode = 'deliver';
    } else if (more && p.pow < 4 && padD > 240) {
      // 先多救几个再回停机坪（单关救满 8 人触发空袭）
      goal = { x: more.x, y: more.y };
      mo.mode = 'pow';
    } else if (pad && p.pow > 0) {
      goal = pad;
      mo.mode = 'pad';
    } else if (more) {
      goal = { x: more.x, y: more.y };
      mo.mode = 'pow';
    } else {
      goal = { x: p.x, y: p.y - 320 };
      mo.mode = 'advance';
    }
  }

  // 2) 寻路（每 15 步或目标格变化时重算）
  const gt = tileOf(goal.x, goal.y);
  const goalKey = `${gt.tx},${gt.ty}`;
  const pt = tileOf(p.x, p.y);
  mo.step = (mo.step || 0) + 1;
  if (mo.bossDirect) {
    mo.path = [];
  } else if (!mo.path || mo.pathKey !== goalKey || mo.step % 15 === 0 || mo.path.length === 0) {
    const path = bfsPath(run.map, pt.tx, pt.ty, gt.tx, gt.ty);
    mo.path = path || [];
    mo.pathKey = goalKey;
    mo.pathAt = mo.step;
  }

  if (VERBOSE && mo.step % 300 === 0) {
    const bs = run.boss && run.boss.active
      ? ` boss=${run.boss.hp} nodes=${(run.boss.nodes || []).filter((n) => n.alive).length} shield=${run.boss.shield}`
      : '';
    console.log(`  [${run.time.toFixed(0)}s] mode=${mo.mode} hp=${p.hp} pow=${p.pow} pos=(${Math.round(p.x)},${Math.round(p.y)}) goal=(${Math.round(goal.x)},${Math.round(goal.y)}) path=${mo.path ? mo.path.length : -1}${bs}`);
  }

  // 3) 沿路径走（到点就切下一个）
  let dirX = 0;
  let dirY = 0;
  if (delivering) {
    dirX = 0;
    dirY = 0;
  } else {
    while (mo.path.length) {
      const [tx, ty] = mo.path[0];
      const c = center(tx, ty);
      if (Math.hypot(c.x - p.x, c.y - p.y) < 34) mo.path.shift();
      else break;
    }
    let wp = null;
    if (mo.path.length) {
      wp = center(mo.path[0][0], mo.path[0][1]);
    } else if (goal) {
      wp = goal;
    }
    if (wp) {
      const dx = wp.x - p.x;
      const dy = wp.y - p.y;
      const d = Math.hypot(dx, dy) || 1;
      dirX = dx / d;
      dirY = dy / d;
      if (d < 18) { dirX = 0; dirY = -1; }
    } else {
      dirY = -1;
    }
  }

  // 4) 叠闪避
  const dodge = dodgeVector(run);
  if (!delivering) {
    dirX += dodge.x * 1.1;
    dirY += dodge.y * 1.1;
    const len = Math.hypot(dirX, dirY) || 1;
    dirX /= len;
    dirY /= len;
  }

  // 5) 卡住兜底：横向挪一下
  if (mo.stuck && mo.stuck.until > run.time) {
    dirX = mo.stuck.dir;
    dirY = -0.4;
    const len = Math.hypot(dirX, dirY) || 1;
    dirX /= len;
    dirY /= len;
  }

  input.mx = Math.max(-1, Math.min(1, dirX));
  input.my = Math.max(-1, Math.min(1, dirY));

  // 6) 瞄准与开火
  const enemy = nearestEnemy(run, 700);
  if (bossTarget) {
    input.aimX = bossTarget.x;
    input.aimY = bossTarget.y;
    input.fire = true;
  } else if (enemy) {
    input.aimX = enemy.x;
    input.aimY = enemy.y;
    input.fire = true;
  } else {
    input.aimX = p.x;
    input.aimY = p.y - 400;
    input.fire = false;
  }

  // 7) 手雷：集群或硬目标
  if (enemy) {
    let cluster = 0;
    for (const e of run.entities) {
      if (e.dead || e.kind !== 'enemy') continue;
      if (Math.hypot(e.x - p.x, e.y - p.y) < 230) cluster += 1;
    }
    const hard = enemy.type === 'tank' || enemy.type === 'tankboss' || enemy.type === 'turret';
    if (p.grenades > 0 && (cluster >= 2 || (hard && Math.hypot(enemy.x - p.x, enemy.y - p.y) < 330))) {
      input.grenade = true;
    }
  }
  if (bossTarget && p.grenades > 0 && Math.hypot(bossTarget.x - p.x, bossTarget.y - p.y) < 340) {
    input.grenade = true;
  }

  // 8) 卡住检测（位置 2 秒没变且不在交付）
  if (!mo.lastPos) mo.lastPos = { x: p.x, y: p.y, at: run.time };
  if (Math.hypot(p.x - mo.lastPos.x, p.y - mo.lastPos.y) > 14) {
    mo.lastPos = { x: p.x, y: p.y, at: run.time };
  } else if (run.time - mo.lastPos.at > 2.2 && !delivering) {
    mo.stuck = { dir: (mo.stuck && mo.stuck.dir === 1 ? -1 : 1), until: run.time + 0.8 };
    mo.lastPos = { x: p.x, y: p.y, at: run.time };
    mo.path = [];
  }
  return input;
}

// ─── 单关（含 3 条命的真实重开规则） ───
function playStage(stageIndex, mods, livesRef) {
  const stage = STAGES[stageIndex];
  const maxStepsPerAttempt = 60 * 260;
  let run = null;
  let steps = 0;
  let airstrikeSeen = false;
  let attempts = 0;
  let deliveredTotal = 0;
  let killsTotal = 0;

  while (livesRef.lives > 0) {
    attempts += 1;
    run = createRun({ stageIndex, seed: stage.seed, difficulty: 'normal', mods: { ...mods } });
    const mo = { step: 0, path: [], pathKey: '', lastPos: null, stuck: null, mode: 'advance' };
    let s = 0;
    while (s < maxStepsPerAttempt && run.state === 'fight') {
      run.step(decide(run, mo));
      for (const ev of run.drainEvents()) if (ev.type === 'airstrike') airstrikeSeen = true;
      s += 1;
      steps += 1;
      if (VERBOSE && s % 600 === 0) {
        const h = run.getHud();
        console.log(`  [${Math.round(run.time)}s] hp=${h.hp} pow=${h.pow} deliv=${h.delivered} prog=${Math.round(h.progress * 100)}% state=${run.state}`);
      }
    }
    deliveredTotal += run.stats.delivered;
    killsTotal += run.stats.kills;
    if (run.state === 'clear') break;
    livesRef.lives -= 1;
    if (livesRef.lives <= 0) break;
    console.log(`  × 被击毁（第 ${attempts} 次尝试），剩余命数 ${livesRef.lives}，重开本关`);
  }

  return {
    run,
    steps,
    airstrikeSeen,
    deliveredTotal,
    killsTotal,
    attempts,
    mods: { ...run.mods },
    picked: { ...run.picked },
  };
}

function main() {
  const onlyArg = process.argv.find((a) => a.startsWith('--stage='));
  if (onlyArg) {
    const only = Math.max(1, Math.min(STAGE_COUNT, Number(onlyArg.split('=')[1]) || 1));
    const res = playStage(only - 1, emptyMods(), { lives: 3 });
    const h = res.run.getHud();
    console.log(JSON.stringify({ stage: only, state: res.run.state, progress: +(h.progress * 100).toFixed(0), time: +res.run.time.toFixed(1), hp: h.hp, delivered: res.run.stats.delivered, attempts: res.attempts }, null, 2));
    process.exit(res.run.state === 'clear' ? 0 : 1);
  }
  console.log('=== 赤色要塞 · Selfplay (BFS v1, 无作弊) ===\n');
  let mods = emptyMods();
  const livesRef = { lives: 3 };
  let cleared = 0;
  let totalDelivered = 0;
  let totalKills = 0;
  let totalAirstrike = 0;
  let totalTime = 0;
  const rows = [];

  for (let i = 0; i < STAGE_COUNT; i += 1) {
    const stage = STAGES[i];
    console.log(`--- Stage ${i + 1}: ${stage.id} ---`);
    const res = playStage(i, mods, livesRef);
    const h = res.run.getHud();
    const s = res.run.stats;
    rows.push({
      stage: i + 1,
      state: res.run.state,
      time: +res.run.time.toFixed(1),
      kills: s.kills,
      delivered: s.delivered,
      hpLeft: h.hp,
      progress: +(h.progress * 100).toFixed(0),
      airstrike: res.airstrikeSeen,
      attempts: res.attempts,
    });
    console.log(`  State: ${res.run.state}`);
    console.log(`  Time: ${res.run.time.toFixed(1)}s  Kills: ${s.kills}  Delivered: ${s.delivered}  HP: ${h.hp}/${h.maxHp}  Attempts: ${res.attempts}  Lives left: ${livesRef.lives}`);
    console.log(`  Progress: ${(h.progress * 100).toFixed(0)}%  Score: ${s.score}  Airstrike: ${res.airstrikeSeen ? 'yes' : 'no'}`);
    console.log('');

    totalKills += res.killsTotal;
    totalDelivered += res.deliveredTotal;
    totalTime += res.run.time;
    if (res.airstrikeSeen) totalAirstrike += 1;
    if (res.run.state !== 'clear') {
      console.log(`✗ Stage ${i + 1} failed (state=${res.run.state})`);
      console.log(`  Player pos: (${Math.round(res.run.player.x)}, ${Math.round(res.run.player.y)})`);
      break;
    }
    cleared += 1;
    mods = res.mods;

    // 关间升级：按优先级拿
    if (i < STAGE_COUNT - 1) {
      const choices = res.run.getUpgradeChoices(3);
      const pick = UPGRADE_PRIORITY.find((id) => choices.includes(id)) || choices[0];
      if (pick) {
        res.run.applyUpgrade(pick);
        mods = { ...res.run.mods };
      }
      console.log(`  Upgrade: ${pick || 'none'}\n`);
    }
  }

  console.log('=== Summary ===');
  console.log(JSON.stringify({ cleared, totalDelivered, totalKills, totalAirstrike, totalTime: +totalTime.toFixed(1), livesLeft: livesRef.lives, rows }, null, 2));
  const ok = cleared === STAGE_COUNT && totalDelivered >= 6 && totalAirstrike >= 1;
  if (ok) console.log('\n✓ 4 关全部清除（无作弊），救援闭环与空袭已验证');
  else console.log('\n✗ 未达标（需要 4 关 clear + 交付 ≥6 + 至少 1 次空袭）');
  process.exit(ok ? 0 : 1);
}

main();
