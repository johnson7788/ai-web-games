/**
 * 电脑对手。纯逻辑，同样不碰 DOM。
 *
 * 设计原则：AI 不作弊——它在微光/明牌之前也不知道真印在哪边，
 * 只是「反应更快 / 更敢赌 / 更少犯错」。玩家输了要怪自己手慢，不怪系统。
 */
import { strike, SIDE } from './rules.js';

/** 决定这一节 AI 走哪个档次：盲劈 / 赌微光 / 等明牌 */
function makePlan(run, seg) {
  const lv = run.ai.level;
  const r = run.rng();
  let tier;
  if (r < lv.aggr * 0.4) tier = 'blind';
  else if (r < lv.aggr) tier = 'hint';
  else tier = 'sure';

  const span = Math.max(1, seg.hintAt - seg.activeAt);
  if (tier === 'blind') {
    return {
      segId: seg.id, tier,
      side: run.rng() < 0.5 ? SIDE.L : SIDE.R,
      at: seg.activeAt + span * (0.3 + run.rng() * 0.55),
    };
  }

  const base = tier === 'hint' ? seg.hintAt : seg.revealAt;
  let at = base + lv.reactMs * (0.85 + run.rng() * 0.4);
  if (run.rng() < lv.hesitate) at += 180 + run.rng() * 220;
  return { segId: seg.id, tier, at, mistake: lv.mistake };
}

/** 每帧调用；返回本次出手结果或 null */
export function stepAi(run, now) {
  if (run.mode !== 'solo') return null;
  const p = run.players[1];
  if (!p || !p.alive) return null;
  if (now < p.stunnedUntil) return null;
  if (now < (run.gapUntil || 0)) return null;
  const seg = run.segs[0];
  if (!seg || seg.state === 'done' || seg.chopped[1]) return null;

  if (!run.ai.plan || run.ai.plan.segId !== seg.id) run.ai.plan = makePlan(run, seg);
  const plan = run.ai.plan;
  if (now < plan.at) return null;

  if (seg.brand === SIDE.BOTH) {          // 双雷段：唯一正确操作是按兵不动
    run.ai.plan = { segId: -1 };
    return null;
  }
  if (plan.tier === 'blind') return strike(run, 1, plan.side, now);

  // 赌微光就用微光给的那一侧；等明牌就用真印的对侧
  let side = plan.tier === 'hint'
    ? seg.hint
    : (seg.brand === SIDE.L ? SIDE.R : SIDE.L);

  if (run.rng() < (plan.mistake || 0)) side = side === SIDE.L ? SIDE.R : SIDE.L;
  return strike(run, 1, side, now);
}
