// EARN 100 MILLION · 自对弈（bot 遥测）
// Node 无头，直接 import sim（无 DOM）。greedy / random / noinput 三策略，
// 跑完写 tools/fun/autoplay.json（schema 见 playtest-protocol §3）。
// 运行：node tools/selfplay.mjs
import { createRun } from '../src/game/sim.js';
import { GOODS, COMPANIES, HOUSES } from '../config/data.js';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'tools', 'fun', 'autoplay.json');

function makeTracker(run, policy, seed) {
  return {
    id: `${policy}-1`,
    policy,
    seed,
    simTime: 0,
    firstInputAt: null,
    firstSuccessAt: null,
    deaths: 0,
    actions: 0,
    seen: new Set(),
    eventTimes: [0],
    tick(dt) { run.step(dt); this.simTime += dt; },
    act(fn, dt = 0.08) {
      const r = fn();
      if (r && r.ok) {
        this.actions += 1;
        if (this.firstInputAt === null) this.firstInputAt = this.simTime;
        this.tick(dt);
      }
      this.consume();
      return r;
    },
    year(fn) {
      const r = fn();
      if (r && r.ok) {
        this.actions += 1;
        if (this.firstInputAt === null) this.firstInputAt = this.simTime;
        this.tick(0.5);
      }
      this.consume();
      return r;
    },
    consume() {
      for (const e of run.drainEvents()) {
        this.seen.add(e.type);
        this.eventTimes.push(this.simTime);
        if ((e.type === 'profit' || e.type === 'milestone' || e.type === 'dividend') && this.firstSuccessAt === null) {
          this.firstSuccessAt = this.simTime;
        }
      }
    },
  };
}

function finish(tel, run) {
  const times = tel.eventTimes.slice().sort((a, b) => a - b);
  let maxGap = 0;
  let idleSec = 0;
  for (let i = 1; i < times.length; i += 1) {
    const gap = times[i] - times[i - 1];
    if (gap > maxGap) maxGap = gap;
    if (gap > 3) idleSec += gap - 3;
  }
  const c = run.state.counters;
  let levelsReached = 1;
  if (c.million) levelsReached = 2;
  if (c.tenMillion) levelsReached = 3;
  if (c.hundredMillion) levelsReached = 4;
  const retired = run.state.phase === 'retired';
  return {
    id: tel.id,
    policy: tel.policy,
    seed: tel.seed,
    durationSec: Number(tel.simTime.toFixed(2)),
    firstInputSec: Number((tel.firstInputAt ?? 0).toFixed(2)),
    inputLatencyMs: 0,
    firstSuccessSec: tel.firstSuccessAt === null ? null : Number(tel.firstSuccessAt.toFixed(2)),
    deaths: tel.deaths + (retired ? 1 : 0),
    actions: tel.actions,
    idleSec: Number(idleSec.toFixed(2)),
    maxEventGapSec: Number(maxGap.toFixed(2)),
    uniqueEvents: tel.seen.size,
    levelsReached,
    completed: run.state.phase === 'won',
  };
}

function upside(good, price) {
  const t2 = good.tiers[2];
  return ((t2[0] + t2[1]) / 2) - Math.max(1, price);
}

function pickEvent(run) {
  // 简单策略：优先选低/零代价且可能带来正现金的选项
  const id = run.state.pendingEvent;
  const ev = EVENTS.find((e) => e.id === id);
  if (!ev) return 'N';
  const [cyType, cyVal] = ev.costY;
  const [cnType, cnVal] = ev.costN;
  const yCost = cyType === 1001 ? cyVal : 0;
  const nCost = cnType === 1001 ? cnVal : 0;
  return yCost <= nCost ? 'Y' : 'N';
}

import { EVENTS } from '../config/data.js';

// ---------------- greedy：低买高卖 + 公司分红 + 房车资产 ----------------
function greedy(seed) {
  const run = createRun({ seed, initCash: 50000 });
  const tel = makeTracker(run, 'greedy', seed);
  const MAX_YEARS = 220;

  for (let y = 0; y < MAX_YEARS; y += 1) {
    if (run.state.phase !== 'playing') break;

    // 1) 结算事件
    while (run.state.pendingEvent && run.state.phase === 'playing') {
      tel.act(() => run.answerEvent(pickEvent(run)));
    }

    // 2) 高价卖出：档 2 必卖，或 4x 以上利润
    for (const g of run.state.goods) {
      if (g.ownNum > 0 && run.state.shownIds.includes(g.id) && (g.tier >= 2 || g.marketPrice >= g.buyPrice * 4)) {
        tel.act(() => run.sellGoods(g.id, g.ownNum));
      }
    }

    // 3) 低价买入：优先买「单件绝对利润最大」的展示商品（档 0/1）
    const shown = run.state.shownIds.map((id) => ({ id, g: GOODS.find((x) => x.id === id), s: run.state.goods.find((x) => x.id === id) }));
    const buyers = shown
      .filter(({ g, s }) => s.tier <= 1 && run.state.cash >= s.marketPrice)
      .sort((a, b) => upside(b.g, b.s.marketPrice) - upside(a.g, a.s.marketPrice));
    if (buyers.length) {
      const best = buyers[0];
      const space = run.state.warehouseCap - run.state.goods.reduce((sum, g) => sum + g.ownNum, 0);
      const affordable = Math.floor(run.state.cash / best.s.marketPrice);
      const qty = Math.min(space, affordable);
      if (qty > 0) tel.act(() => run.buyGoods(best.id, qty));
    }

    // 4) 公司：没公司且现金够就创办，锁定期满且有余钱就加仓
    if (!run.state.companies.some((c) => c.shares > 0)) {
      const founder = COMPANIES.filter((c) => run.state.cash >= 100 * c.sharePrice).sort((a, b) => b.dividend - a.dividend)[0];
      if (founder) tel.act(() => run.createCompany(founder.id));
    } else {
      const own = run.state.companies.find((c) => c.shares > 0);
      if (own && own.lockYears <= 0 && run.state.cash > 100000) {
        const blocks = Math.min(5, Math.floor((run.state.cash * 0.1) / (100 * own.sharePrice)));
        if (blocks > 0) tel.act(() => run.buyStock(own.id, blocks));
      }
    }

    // 5) 房产：闲钱买最便宜的房（攒名声与资产）
    const cheapest = HOUSES.slice().sort((a, b) => a.price - b.price)[0];
    if (cheapest && run.state.cash > cheapest.price * 1.5 && run.state.houses.find((h) => h.id === cheapest.id).ownNum === 0) {
      tel.act(() => run.buyHouse(cheapest.id));
    }

    // 6) 下一年
    tel.year(() => run.nextYear());
  }

  return finish(tel, run);
}

// ---------------- random：随机买卖/创业/约会/赌博 ----------------
function random(seed) {
  const run = createRun({ seed, initCash: 50000 });
  const tel = makeTracker(run, 'random', seed);
  let x = seed;
  const rng = () => { x = (x * 1103515245 + 12345) & 0x7fffffff; return x / 0x7fffffff; };
  const MAX_YEARS = 120;

  for (let y = 0; y < MAX_YEARS; y += 1) {
    if (run.state.phase !== 'playing') break;
    while (run.state.pendingEvent && run.state.phase === 'playing') {
      tel.act(() => run.answerEvent(rng() < 0.5 ? 'Y' : 'N'));
    }
    const roll = rng();
    if (roll < 0.4) {
      const id = run.state.shownIds[Math.floor(rng() * run.state.shownIds.length)];
      tel.act(() => run.buyGoods(id, 1 + Math.floor(rng() * 10)));
    } else if (roll < 0.6) {
      const owned = run.state.goods.filter((g) => g.ownNum > 0);
      if (owned.length) {
        const g = owned[Math.floor(rng() * owned.length)];
        tel.act(() => run.sellGoods(g.id, 1 + Math.floor(rng() * g.ownNum)));
      }
    } else if (roll < 0.7) {
      if (!run.state.companies.some((c) => c.shares > 0)) tel.act(() => run.createCompany(1));
      else tel.act(() => run.sellStock(1, 1));
    } else if (roll < 0.8) {
      const mate = run.state.mates[Math.floor(rng() * run.state.mates.length)];
      if (mate) tel.act(() => run.date(mate.id));
    } else if (roll < 0.9) {
      tel.act(() => run.bet());
    } else {
      tel.act(() => run.buyHouse(6));
    }
    tel.year(() => run.nextYear());
  }
  return finish(tel, run);
}

// ---------------- noinput：只推进时间 ----------------
function noinput(seed) {
  const run = createRun({ seed, initCash: 50000 });
  const tel = makeTracker(run, 'noinput', seed);
  for (let y = 0; y < 30; y += 1) {
    if (run.state.phase !== 'playing') break;
    // noinput 不回答问题：一旦遇到事件就卡住（代表无输入）
    if (run.state.pendingEvent) { tel.tick(0.5); break; }
    tel.year(() => run.nextYear());
  }
  return finish(tel, run);
}

const runs = [greedy(3), random(2), noinput(3)];
const payload = {
  game: 'earn-100-million',
  genre: 'sim',
  source: 'bot',
  version: 'm1',
  runs,
};

mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, `${JSON.stringify(payload, null, 2)}\n`);
console.log(`wrote ${OUT} (${runs.length} runs)`);
for (const r of runs) {
  console.log(
    `${r.id.padEnd(10)} policy=${r.policy.padEnd(8)} dur=${r.durationSec}s ` +
    `firstInput=${r.firstInputSec}s firstSuccess=${r.firstSuccessSec ?? '—'} ` +
    `actions=${r.actions} deaths=${r.deaths} levels=${r.levelsReached} completed=${r.completed}`,
  );
}
