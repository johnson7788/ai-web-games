// 贪心 bot：供 tools/selfplay.mjs 与 window.__ll.debug.autoWin 共用。
// 策略：先收集可达道具 → 开钥匙门 → 破水晶 → 逛商店 → 爬楼梯 → 打最省血的怪物。
// 尖刺/怪物/门在 BFS 中视为障碍（避免无谓掉血）。
import { MONSTERS, DOORS, GAME } from '../../config/maps.js';
import { simulateFight } from './sim.js';

const key = (x, y) => `${x},${y}`;

function reachableSet(run) {
  const st = run.state;
  const f = st.floors[st.floor - 1];
  const passable = (t) => t.kind === 'floor' || t.kind === 'prop';
  const seen = new Set([key(st.pos.x, st.pos.y)]);
  const queue = [[st.pos.x, st.pos.y]];
  while (queue.length) {
    const [x, y] = queue.shift();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= f.cols || ny >= f.rows) continue;
      const k = key(nx, ny);
      if (seen.has(k)) continue;
      if (passable(f.grid[ny][nx])) { seen.add(k); queue.push([nx, ny]); }
    }
  }
  return seen;
}

function adjacent(run, seen, pred) {
  const st = run.state;
  const f = st.floors[st.floor - 1];
  const out = [];
  for (const k of seen) {
    const [x, y] = k.split(',').map(Number);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= f.cols || ny >= f.rows) continue;
      const t = f.grid[ny][nx];
      if (!seen.has(key(nx, ny)) && pred(t)) out.push({ x: nx, y: ny, t });
    }
  }
  return out;
}

// 执行一步贪心；返回 true 表示有动作，false 表示卡住（或已终局）
export function greedyStep(run) {
  const st = run.state;
  if (st.phase !== 'playing') return false;
  const seen = reachableSet(run);

  // 1. 收集可达道具
  for (const k of seen) {
    const [x, y] = k.split(',').map(Number);
    if (st.floors[st.floor - 1].grid[y][x].kind === 'prop' && !(x === st.pos.x && y === st.pos.y)) {
      run.moveTo(x, y);
      return true;
    }
  }

  // 2. 开钥匙门
  const doors = adjacent(run, seen, (t) => t.kind === 'door' && st.keys[t.key] > 0);
  if (doors.length) { run.moveTo(doors[0].x, doors[0].y); return true; }

  // 3. 破水晶（免费加攻防）
  const crystals = adjacent(run, seen, (t) => t.kind === 'crystal' && st.pick > 0);
  if (crystals.length) { run.moveTo(crystals[0].x, crystals[0].y); return true; }

  // 4. 逛商店（能负担才买，防御优先）
  const price = GAME.SHOP.beginGold + GAME.SHOP.ratio * st.shopCount;
  const shops = adjacent(run, seen, (t) => t.kind === 'shop');
  if (shops.length && st.hero.gold >= price) {
    run.moveTo(shops[0].x, shops[0].y);
    run.buy('def');
    return true;
  }

  // 5. 爬楼梯（第 5 层无上楼，靠打 boss 通关）
  const up = adjacent(run, seen, (t) => t.kind === 'stair' && t.dir === 'up');
  if (up.length && st.floor < st.floors.length) { run.moveTo(up[0].x, up[0].y); return true; }

  // 6. 打能打赢的怪物（挑掉血最少的）
  const monsters = adjacent(run, seen, (t) => t.kind === 'monster')
    .map((m) => ({ ...m, m: MONSTERS[m.t.char] || MONSTERS[m.t.id] }))
    .filter((m) => m.m && simulateFight(st.hero, m.m).win)
    .sort((a, b) => simulateFight(st.hero, a.m).dmg - simulateFight(st.hero, b.m).dmg);
  if (monsters.length) { run.moveTo(monsters[0].x, monsters[0].y); return true; }

  return false;
}

export function autoPlay(run, maxSteps = 2000) {
  let steps = 0;
  while (run.state.phase === 'playing' && steps < maxSteps) {
    if (!greedyStep(run)) break;
    steps += 1;
  }
  return { steps, phase: run.state.phase };
}
