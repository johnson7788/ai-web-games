// src/game/sim.js — CAKE KART 纯逻辑竞速：赛道推进 + 糖霜漂移 + 甜点道具 + AI + 名次。
// 无 DOM / 无 Date.now / 无 localStorage；随机全部走 run.rng()（seed 可复现）。
// 契约：createRun({seed, station}) → run；run.step(input)；run.drainEvents()；run.getHud()。
import {
  STEP, KART, DRIFT, ITEM, TRACK, AI, TELEMETRY, clamp, approach,
} from '../../config/gameplay.js';
import { buildTrack } from './track.js';
import { stationAt } from '../../config/tracks.js';
import { mulberry32 } from './rng.js';

function tierOf(charge) {
  if (charge >= DRIFT.TIERS[2]) return 3;
  if (charge >= DRIFT.TIERS[1]) return 2;
  return 1;
}

export function createRun({ seed = 1, station = 1 } = {}) {
  const rng = mulberry32(seed >>> 0);
  const st = stationAt(station);
  const track = buildTrack(st.shape);
  const totalLaps = st.laps;
  const aiMax = Math.min(KART.MAX_SPEED - 24, AI.BASE_SPEED + (st.index - 1) * AI.SPEED_PER_STATION);
  const boxSpacing = ITEM.BOX_INTERVAL;

  const karts = [];
  for (let i = 0; i < KART.COUNT; i += 1) {
    const isPlayer = i === 0;
    const startProgress = i * KART.START_LANE_SPACING;
    karts.push({
      id: isPlayer ? 'player' : `ai${i}`,
      isPlayer,
      maxSpeed: isPlayer ? KART.MAX_SPEED : aiMax,
      progress: startProgress % track.length,
      totalProgress: startProgress,
      lane: 0,
      laneV: 0,
      speed: 0,
      driftCharge: 0,
      driftHeld: false,
      _wasDrifting: false,
      _itemHeld: false,
      _lastTier: 0,
      _lastOffroad: false,
      boostUntil: 0,
      boostMult: 1,
      slowUntil: 0,
      slowMult: 1,
      spinUntil: 0,
      shieldUntil: 0,
      blindUntil: 0,
      item: null,
      itemCooldown: 0,
      nextBoxAt: startProgress + boxSpacing,
      itemUseTimer: 0,
      lap: 0,
      finished: false,
      finishTime: null,
      rank: i + 1,
      aimLane: 0,
    });
  }

  const player = karts[0];

  const run = {
    seed: seed >>> 0,
    station: st.index,
    scene: st.scene,
    totalLaps,
    track,
    karts,
    player,
    aiMax,
    boxSpacing,
    time: 0,
    phase: 'racing', // racing | finished
    events: [],
    finishOrder: [],
    stats: {
      deaths: 0,
      boosts: 0,
      itemUses: 0,
      overtakes: 0,
      bestRank: KART.COUNT,
      lastMilestone: 0,
      lastNearMiss: 0,
    },
    _tick: 0,
    rng: () => rng(),
  };

  run.events.push({ type: 'raceStart', station: st.index, laps: totalLaps });

  function emit(type, payload = {}) {
    run.events.push({ type, ...payload });
  }

  function kartAheadOf(kart) {
    let best = null;
    for (const k of run.karts) {
      if (k === kart || k.finished) continue;
      if (k.totalProgress > kart.totalProgress) {
        if (!best || k.totalProgress < best.totalProgress) best = k;
      }
    }
    return best;
  }

  function pickItem() {
    return ITEM.TYPES[Math.floor(rng() * ITEM.TYPES.length)];
  }

  function useItem(kart) {
    if (!kart.item) return;
    const item = kart.item;
    kart.item = null;
    emit('itemUse', { kart: kart.id, item });
    if (kart.isPlayer) run.stats.itemUses += 1;

    if (item === 'shield') {
      kart.shieldUntil = run.time + ITEM.SHIELD_SEC;
      emit('shieldOn', { kart: kart.id });
    } else if (item === 'boost') {
      kart.boostUntil = Math.max(kart.boostUntil, run.time + ITEM.BOOST_SEC);
      kart.boostMult = ITEM.BOOST_MULT;
      emit('itemBoost', { kart: kart.id });
    } else {
      const target = kartAheadOf(kart);
      if (!target) return;
      if (target.shieldUntil > run.time) {
        emit('shieldBlock', { kart: target.id, by: kart.id });
        return;
      }
      if (item === 'missile') {
        target.slowUntil = run.time + ITEM.MISSILE_SPIN_SEC;
        target.slowMult = ITEM.MISSILE_SLOW;
        target.spinUntil = run.time + ITEM.MISSILE_SPIN_SEC;
        emit('missileHit', { kart: target.id, by: kart.id });
      } else {
        target.blindUntil = run.time + ITEM.CAKE_BLIND_SEC;
        emit('cakeBlind', { kart: target.id, by: kart.id });
      }
    }
  }

  function updateKart(kart, ctrl) {
    const now = run.time;
    const sample = track.sampleAt(kart.progress);

    // 已完赛冻结
    if (kart.finished) {
      kart.speed = 0;
      return;
    }

    const blinded = now < kart.blindUntil;
    let steer = clamp(ctrl.steer ?? 0, -1, 1);
    const throttle = clamp(ctrl.throttle ?? 0, 0, 1);
    if (blinded) steer *= ITEM.CAKE_BLIND_STEER;

    // 撞栏失控期间无法转向
    const spinning = now < kart.spinUntil;
    if (spinning) steer = 0;

    // ---- 漂移蓄力（按住 Shift 即蓄力；转向决定外滑方向）----
    const wantDrift = ctrl.driftHeld && !spinning;
    const released = kart._wasDrifting && !ctrl.driftHeld;

    if (wantDrift) {
      if (!kart._wasDrifting) emit('driftStart', { kart: kart.id });
      kart.driftCharge = clamp(kart.driftCharge + DRIFT.CHARGE_RATE * STEP, 0, 1);
    } else {
      kart.driftCharge = clamp(kart.driftCharge - DRIFT.DECAY_RATE * STEP, 0, 1);
    }

    // 松漂移 → 糖霜加速（signature：满蓄更久）
    if (released && kart.driftCharge >= DRIFT.MIN_CHARGE_TO_BOOST) {
      const boostSec = kart.driftCharge * DRIFT.BOOST_SEC_PER_CHARGE;
      kart.boostUntil = Math.max(kart.boostUntil, now + boostSec);
      kart.boostMult = DRIFT.BOOST_MULT;
      emit('boost', { kart: kart.id, charge: Math.round(kart.driftCharge * 100) / 100, tier: tierOf(kart.driftCharge) });
      if (kart.isPlayer) run.stats.boosts += 1;
      kart.driftCharge = 0;
    }

    // 档位上升事件
    const tier = wantDrift ? tierOf(kart.driftCharge) : 0;
    if (tier > kart._lastTier) emit('driftTier', { kart: kart.id, tier });
    kart._lastTier = tier;

    // ---- 速度目标（油门 → 目标速度；地形 / 加速 / 减速）----
    const effThrottle = KART.AUTO_THROTTLE + (1 - KART.AUTO_THROTTLE) * throttle;
    let target = kart.maxSpeed * effThrottle;
    if (sample.mud) target *= TRACK.MUD_SLOW;
    if (sample.jelly) target *= TRACK.JELLY_BOOST_MULT;
    if (now < kart.boostUntil) target *= kart.boostMult;
    if (now < kart.slowUntil) target *= kart.slowMult;
    if (spinning) target *= 0.3;

    const offroad = Math.abs(kart.lane) > sample.halfWidth;
    if (offroad) target *= TRACK.OFFROAD_SLOW;
    if (offroad && !kart._lastOffroad && kart.isPlayer) emit('offroad', { kart: kart.id });
    kart._lastOffroad = offroad;

    if (kart.speed < target) kart.speed += KART.ACCEL * STEP;
    else kart.speed -= KART.BRAKE * STEP;
    if (wantDrift) kart.speed -= DRIFT.DRAG_PER_CHARGE * kart.driftCharge * STEP;
    kart.speed = clamp(kart.speed, 0, KART.MAX_SPEED * 1.5);

    // ---- 横向移动：转向（漂移更敏感）+ 离心外滑 ----
    const steerSpeed = wantDrift ? KART.DRIFT_STEER_SPEED : KART.STEER_SPEED;
    const targetLaneV = steer * steerSpeed;
    kart.laneV = approach(kart.laneV, targetLaneV, KART.LANE_V_LERP, STEP);
    // 离心外滑：弯道不反打就往外滑（noinput 因此冲出赛道）
    const slide = KART.CENTRIFUGAL * kart.speed * sample.curvature;
    if (wantDrift) kart.laneV += Math.sign(steer) * DRIFT.SLIDE_PER_CHARGE * kart.driftCharge;
    kart.lane += (kart.laneV + slide) * STEP;

    // ---- 撞栏（冲出赛道太多）----
    if (Math.abs(kart.lane) > sample.halfWidth * TRACK.CRASH_LANE) {
      emit('crash', { kart: kart.id });
      if (kart.isPlayer) run.stats.deaths += 1;
      kart.lane = clamp(kart.lane, -sample.halfWidth, sample.halfWidth);
      kart.laneV *= -0.25;
      kart.speed *= 0.4;
      kart.spinUntil = now + TRACK.BARRIER_SPIN_SEC;
      kart.driftCharge = 0;
    }

    // ---- 沿赛道推进 ----
    kart.totalProgress += kart.speed * STEP;
    kart.progress = kart.totalProgress % track.length;

    // ---- 道具箱拾取 ----
    if (kart.totalProgress >= kart.nextBoxAt) {
      if (now >= kart.itemCooldown && !kart.item) {
        kart.item = pickItem();
        kart.itemCooldown = now + ITEM.PICKUP_COOLDOWN;
        emit('itemPickup', { kart: kart.id, item: kart.item });
      }
      kart.nextBoxAt += boxSpacing;
    }

    // ---- 圈数 ----
    const newLap = Math.floor(kart.totalProgress / track.length);
    if (newLap > kart.lap) {
      kart.lap = newLap;
      emit('lap', { kart: kart.id, lap: newLap });
      if (kart.isPlayer && newLap >= totalLaps) {
        kart.finished = true;
        kart.finishTime = run.time;
        run.finishOrder.push(kart.id);
        run.phase = 'finished';
        emit('finish', { kart: kart.id, rank: kart.rank, time: Math.round(run.time * 10) / 10 });
      } else if (!kart.isPlayer && newLap >= totalLaps) {
        kart.finished = true;
        kart.finishTime = run.time;
        run.finishOrder.push(kart.id);
        emit('aiFinish', { kart: kart.id });
      }
    }

    // ---- 道具使用（边沿触发）----
    const useNow = ctrl.item && !kart._itemHeld;
    kart._itemHeld = !!ctrl.item;
    if (useNow) useItem(kart);

    kart._wasDrifting = wantDrift;
  }

  function aiCtrl(kart) {
    const sample = track.sampleAt(kart.progress);
    const look = track.sampleAt((kart.progress + Math.max(60, kart.speed * 0.9)) % track.length);
    const halfWidth = sample.halfWidth;
    // 走线：弯内侧偏移
    const inside = -Math.sign(look.curvature) * AI.RACING_LINE * halfWidth;
    const err = inside - kart.lane;
    let steer = clamp(err * 0.14, -1, 1);

    // 弯前漂移（曲率阈值）
    const sharp = Math.abs(look.curvature) > AI.DRIFT_CURV;
    const throttle = sharp ? 0.9 : 1.0;
    const drift = sharp;

    // 被糊：转向混乱
    if (kart.blindUntil > run.time) {
      steer = clamp(steer + (rng() - 0.5) * 1.4, -1, 1);
    }

    // 道具使用（随机节流）
    let useItem = false;
    kart.itemUseTimer -= STEP;
    if (kart.item && kart.itemUseTimer <= 0 && rng() < AI.ITEM_USE_CHANCE) {
      useItem = true;
      kart.itemUseTimer = AI.ITEM_USE_MIN_SEC;
    }

    return { steer, throttle, driftHeld: drift, item: useItem };
  }

  function step(input = {}) {
    run.time += STEP;
    run._tick += 1;

    // 玩家
    updateKart(player, {
      steer: input.steer ?? 0,
      throttle: input.throttle ?? 0,
      driftHeld: !!input.drift,
      item: !!input.item,
    });

    // AI
    for (let i = 1; i < karts.length; i += 1) {
      const c = aiCtrl(karts[i]);
      updateKart(karts[i], c);
    }

    // ---- 名次 ----
    const sorted = [...karts].sort((a, b) => {
      if (a.finished && b.finished) return a.finishTime - b.finishTime;
      if (a.finished) return -1;
      if (b.finished) return 1;
      return b.totalProgress - a.totalProgress;
    });
    const prevRank = player.rank;
    sorted.forEach((k, i) => { k.rank = i + 1; });
    if (player.rank < prevRank) {
      run.stats.overtakes += 1;
      emit('overtake', { kart: 'player', rank: player.rank });
    }
    if (player.rank < run.stats.bestRank) run.stats.bestRank = player.rank;

    // ---- 里程碑（事件密度）----
    const mile = Math.floor(player.totalProgress / TELEMETRY.MILESTONE_M);
    if (mile > run.stats.lastMilestone) {
      run.stats.lastMilestone = mile;
      emit('milestone', { m: mile * TELEMETRY.MILESTONE_M });
    }

    // ---- nearMiss（玩家与 AI 擦肩）----
    for (let i = 1; i < karts.length; i += 1) {
      const ai = karts[i];
      if (Math.abs(player.totalProgress - ai.totalProgress) < 10 && Math.abs(player.lane - ai.lane) < 22) {
        if (run.time - run.stats.lastNearMiss > 1.2) {
          run.stats.lastNearMiss = run.time;
          emit('nearMiss', { kart: ai.id });
        }
      }
    }
  }

  function drainEvents() {
    const evs = run.events;
    run.events = [];
    return evs;
  }

  function getHud() {
    return {
      lap: Math.min(player.lap, totalLaps),
      totalLaps,
      pos: player.rank,
      speed: Math.round(player.speed),
      driftCharge: player.driftCharge,
      tier: player._lastTier,
      item: player.item,
      scene: run.scene,
      station: run.station,
      blind: player.blindUntil > run.time,
      totalProgress: player.totalProgress,
      lapProgress: (player.progress / track.length),
    };
  }

  run.step = step;
  run.drainEvents = drainEvents;
  run.getHud = getHud;

  return run;
}

export default { createRun };
