/**
 * 无头自对弈：用一个「会打的人类」策略去撞三个难度的电脑对手，
 * 输出胜率 / 局长 / 各种死法的分布，用来判断数值是否失衡。
 *
 * 用法：node tools/selfplay.mjs [每人局数]
 */
import { createRun, startRun, step, strike, drainEvents, SIDE, PHASE } from '../src/game/rules.js';
import { stepAi } from '../src/game/ai.js';
import { AI_LEVELS } from '../config/game.config.js';

const FRAME = 16;

/** 人类策略：等雷印亮，反应 delay 毫秒后劈安全侧；落后 2 木才偶尔抢跑 */
function makeHuman(seed, reactMs = 260) {
  let plan = null;
  let rngState = seed >>> 0;
  const rng = () => {
    rngState = (rngState * 1664525 + 1013904223) >>> 0;
    return rngState / 4294967296;
  };
  return function human(run, now) {
    const p = run.players[0];
    if (!p.alive || now < p.stunnedUntil) return;
    const seg = run.segs[0];
    if (!seg || seg.state === 'done') return;

    if (seg.chopped[0]) return;
    if (!plan || plan.segId !== seg.id) {
      const behind = run.players[1].logs - p.logs;
      const blind = behind >= 4 && rng() < 0.22;
      plan = blind
        ? { segId: seg.id, kind: 'blind', side: rng() < 0.5 ? SIDE.L : SIDE.R, at: seg.activeAt + (seg.hintAt - seg.activeAt) * (0.4 + rng() * 0.4) }
        : { segId: seg.id, kind: 'wait', at: seg.revealAt + reactMs * (0.85 + rng() * 0.4) };
    }
    if (now < plan.at) return;
    if (plan.kind === 'blind') return strike(run, 0, plan.side, now);
    if (seg.state === 'hidden') return;
    if (seg.brand === SIDE.BOTH) { plan = { segId: -1 }; return; }
    strike(run, 0, seg.brand === SIDE.L ? SIDE.R : SIDE.L, now);
  };
}

function playMatch(aiLevel, seed) {
  const run = createRun({ mode: 'solo', aiLevel, seed });
  startRun(run, 0);
  const human = makeHuman(seed * 7 + 13);
  let now = 0;
  let guard = 0;
  const evCount = { zap: 0, smite: 0, chop: 0, blind: 0, pass: 0 };
  while (run.phase === PHASE.PLAYING && guard++ < 40000) {
    now += FRAME;
    step(run, now);
    stepAi(run, now);
    human(run, now);
    for (const e of drainEvents(run)) {
      if (e.type === 'zap') evCount.zap++;
      else if (e.type === 'smite') evCount.smite++;
      else if (e.type === 'chop') e.tier === 'blind' ? evCount.blind++ : evCount.chop++;
      else if (e.type === 'pass') evCount.pass++;
    }
  }
  return { run, now, evCount };
}

const rounds = Number(process.argv[2] || 300);
console.log(`\n=== 夺木 · 自对弈平衡报告（每档 ${rounds} 局，人类策略 260ms 反应） ===\n`);
console.log('难度      胜率     平均局长   平均夺木   我方被劈   天雷   鬼门关平局');
for (const level of AI_LEVELS) {
  let wins = 0, duration = 0, logs = 0, zaps = 0, smites = 0, draws = 0;
  for (let i = 0; i < rounds; i++) {
    const { run, now, evCount } = playMatch(level.id, 1000 + i);
    if (run.winner === 0) wins++;
    if (run.winner === -1) draws++;
    if (run.winner === 1) { /* lost */ }
    duration += now;
    logs += run.players[0].logs;
    zaps += run.players[0].killed;
    smites += evCount.smite;
  }
  const rate = ((wins / rounds) * 100).toFixed(1).padStart(5);
  console.log(
    `${level.id.padEnd(9)} ${rate}%  ${(duration / rounds / 1000).toFixed(1).padStart(6)}s  ` +
    `${(logs / rounds).toFixed(1).padStart(7)}  ${(zaps / rounds).toFixed(2).padStart(8)}  ` +
    `${(smites / rounds).toFixed(2).padStart(5)}  ${draws}`
  );
}
console.log('');
