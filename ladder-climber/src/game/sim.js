// LADDER CLIMBER · 模拟层（纯逻辑，零 DOM / window / Date.now / canvas）
// 职责：楼层生成（左右横杆）、攀爬判定、连击/星星/护盾/冰冻、底部塌陷、事件表。
// 随机：注入 seed 的 mulberry32，可复现。事件由 main 消费（音频/视觉/遥测）。
//
// P0 玩法 1:1 提取自参考源码「爬梯达人」（Cocos 2.2.2）：
//   - 正式阶梯每层 ±71.5px（ladW/2）横向偏移，层高 82px（ladH），玩家站在横杆上方 65px。
//   - 玩家按左/右爬向下一层，方向匹配则上攀，不匹配则坠亡（或踩到装饰断裂横杆）。
//   - 底部楼层按递减间隔被移除（起始 1000ms，每层 -5ms）；脚下那层被移除则终结。
// 新增机制（换皮改造）：连击加分 / 星星锻造护盾 / 冰冻道具。

import { GAME } from '../../config/game.config.js';

// ------------------------------------------------------------------ RNG
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const DECO_TYPES = [-2, -1, 1, 2];

// 星星/冰冻道具出现的概率（随层数缓慢提升，但保持固定 seed 可复现）
function starChance(index) {
  if (index < 2) return 0;
  return Math.min(0.42, 0.22 + index * 0.004);
}
function orbChance(index) {
  if (index < 4) return 0;
  return Math.min(0.18, 0.06 + index * 0.0015);
}

export function createRun(opts = {}) {
  const seed = (opts.seed == null ? 1 : opts.seed) >>> 0;
  const rng = mulberry32(seed);

  const floors = [];       // 已生成的楼层（索引 = 楼层号，从 0 起）

  const state = {
    seed,
    floors,
    phase: 'ready',        // sim 阶段：'ready' | 'playing' | 'end'
    curIndex: 0,           // 玩家当前所在楼层（0 基）
    floorsClimbed: 0,      // 已爬层数（= curIndex，但保留独立字段便于遥测）
    score: 0,
    x: 0,                  // 玩家世界坐标（站在 floor[curIndex] 上方 RIDE_H）
    y: GAME.RIDE_H,
    combo: 0,
    comboMax: 0,
    comboTimer: 0,         // 距上次攀爬的秒数，超 COMBO_WINDOW 连击归零
    readyTimer: 0,         // 开局等待输入的秒数，超 READY_AUTO_SEC 自动启动塌陷
    stars: 0,              // 累计收集星星
    starMeter: 0,          // 当前护盾进度 0..STAR_SHIELD_NEED-1
    shields: 0,
    freezeT: 0,            // 剩余冰冻秒数
    removeTopIndex: 0,     // 下一个要从底部移除的楼层索引
    removeTimer: GAME.COLLAPSE_START_MS / 1000,
    removeInterval: GAME.COLLAPSE_START_MS / 1000,
    nextDir: null,         // floor[curIndex+1].dir（渲染/贪心 bot 读取）
    result: null,
  };

  function makeFloor(index) {
    const prev = floors[index - 1];
    const dir = index === 0 ? 0 : (rng() < 0.5 ? -1 : 1);
    const x = index === 0 ? 0 : prev.x + dir * GAME.STEP_HALF;
    const y = index * GAME.STEP_H;
    const star = index > 0 && rng() < starChance(index);
    const orb = index > 0 && rng() < orbChance(index);
    // 装饰断裂横杆：-2/-1/1/2 相对正式阶梯偏移；0 表示该层没有装饰横杆
    const decoRoll = index > 0 ? Math.floor(rng() * 5) - 2 : 0;
    const deco = decoRoll === 0 ? null : { type: decoRoll, icon: Math.floor(rng() * 5) };
    return { index, dir, x, y, star, orb, deco };
  }

  function ensureTo(n) {
    while (floors.length <= n) {
      floors.push(makeFloor(floors.length));
    }
    return floors[n];
  }

  // 初始生成到能渲染/读取下一层为止
  ensureTo(1);
  state.nextDir = floors[1].dir;

  function refreshNextDir() {
    ensureTo(state.curIndex + 1);
    state.nextDir = floors[state.curIndex + 1].dir;
  }

  const events = [];

  const run = {
    state,
    ensureTo,
    _rng: rng,
    _events: events,
    _clock: 0,

    /** 推进时间；'end' 阶段不推进 */
    step(dt) {
      const s = state;
      if (s.phase === 'end') return;
      dt = Number(dt);
      if (!Number.isFinite(dt) || dt <= 0) return;
      if (dt > 1) dt = 1; // 防大跳帧
      this._clock += dt;

      if (s.phase === 'ready') {
        s.readyTimer += dt;
        if (s.readyTimer >= GAME.READY_AUTO_SEC) this._startPlaying();
        return;
      }

      if (s.phase !== 'playing') return;

      // 连击窗口计时
      s.comboTimer += dt;
      if (s.comboTimer > GAME.COMBO_WINDOW && s.combo > 0) {
        s.combo = 0;
        this._emit({ type: 'comboReset' });
      }

      // 冰冻：冻结塌陷倒计时
      if (s.freezeT > 0) {
        s.freezeT -= dt;
        if (s.freezeT <= 0) {
          s.freezeT = 0;
          this._emit({ type: 'freezeEnd' });
        }
        return; // 冰冻期间塌陷计时暂停
      }

      // 底部塌陷推进
      s.removeTimer -= dt;
      if (s.removeTimer <= 0) {
        this._removeTopFloor();
        s.removeInterval = Math.max(GAME.COLLAPSE_MIN_MS / 1000, s.removeInterval - GAME.COLLAPSE_STEP_MS / 1000);
        s.removeTimer = s.removeInterval;
      }
    },

    /** 爬向下一层。dir: -1 左 / 1 右。首次输入把 ready 切到 playing 并启动塌陷。 */
    climb(dir) {
      const s = state;
      if (s.phase === 'end') return { ok: false, reason: 'phase' };
      if (dir !== -1 && dir !== 1) return { ok: false, reason: 'dir' };

      if (s.phase === 'ready') this._startPlaying();

      ensureTo(s.curIndex + 1);
      const target = floors[s.curIndex + 1];

      if (target.dir === dir) {
        // 成功上攀
        s.curIndex += 1;
        s.floorsClimbed = s.curIndex;
        s.x = target.x;
        s.y = target.y + GAME.RIDE_H;
        refreshNextDir();
        if (s.curIndex % GAME.STAGE_FLOORS === 0) {
          this._emit({ type: 'stage', stage: Math.floor(s.curIndex / GAME.STAGE_FLOORS) + 1 });
        }

        // 连击
        if (s.comboTimer <= GAME.COMBO_WINDOW) {
          s.combo = Math.min(GAME.COMBO_MAX, s.combo + 1);
        } else {
          s.combo = 1;
        }
        s.comboTimer = 0;
        s.comboMax = Math.max(s.comboMax, s.combo);
        const gained = 1 + (s.combo - 1); // 连击 1 得 1 分，连击 2 得 2 分…
        s.score += gained;
        this._emit({ type: 'climb', index: s.curIndex, dir, gained, score: s.score, combo: s.combo });
        if (s.combo >= 2) this._emit({ type: 'combo', combo: s.combo });

        // 收集物（落在刚踩上的这一层）
        if (target.star) {
          target.star = false;
          s.stars += 1;
          s.score += GAME.STAR_SCORE;
          s.starMeter += 1;
          this._emit({ type: 'star', index: s.curIndex, stars: s.stars, score: s.score });
          if (s.starMeter >= GAME.STAR_SHIELD_NEED) {
            s.starMeter = 0;
            if (s.shields < GAME.SHIELD_MAX) {
              s.shields += 1;
              this._emit({ type: 'shield', shields: s.shields });
            }
          }
        }
        if (target.orb) {
          target.orb = false;
          s.freezeT = Math.max(s.freezeT, GAME.FREEZE_SEC);
          s.score += GAME.ORB_SCORE;
          this._emit({ type: 'freeze', index: s.curIndex, score: s.score });
        }
        return { ok: true, climbed: true, dir };
      }

      // 方向错误
      if (s.shields > 0) {
        s.shields -= 1;
        s.combo = 0;
        this._emit({ type: 'miss', index: s.curIndex, shields: s.shields });
        return { ok: true, climbed: false, shielded: true };
      }

      // 坠亡：踩到装饰断裂横杆（同方向）或踩空
      const deco = target.deco;
      const reason = deco && deco.type === dir ? 'deco' : 'fall';
      this._die(reason);
      return { ok: true, climbed: false, dead: true, reason };
    },

    /** 遥测/验收辅助：读下一层方向后正确攀爬（greedy bot 用） */
    climbCorrect() {
      return this.climb(state.nextDir);
    },

    /** 遥测/验收辅助：故意爬错方向 */
    climbWrong() {
      return this.climb(state.nextDir === 1 ? -1 : 1);
    },

    getHud() {
      const s = state;
      return {
        phase: s.phase,
        floor: s.curIndex,
        score: s.score,
        combo: s.combo,
        comboMax: s.comboMax,
        stars: s.stars,
        starMeter: s.starMeter,
        shields: s.shields,
        freezeT: s.freezeT,
        nextDir: s.nextDir,
        removeInterval: s.removeInterval,
      };
    },

    drainEvents() {
      const ev = this._events.slice();
      this._events.length = 0;
      return ev;
    },

    _emit(e) { this._events.push(e); },

    _startPlaying() {
      const s = state;
      if (s.phase !== 'ready') return;
      s.phase = 'playing';
      this._emit({ type: 'start' });
    },

    _removeTopFloor() {
      const s = state;
      const idx = s.removeTopIndex;
      if (idx >= floors.length) return;
      s.removeTopIndex += 1;
      this._emit({ type: 'floorRemoved', index: idx });
      if (idx === s.curIndex) {
        // 脚下这层被移除 → 终结
        this._die('collapse');
      }
    },

    _die(reason) {
      const s = state;
      if (s.phase === 'end') return;
      s.phase = 'end';
      s.result = {
        won: false,
        reason,
        score: s.score,
        floors: s.floorsClimbed,
        stars: s.stars,
        comboMax: s.comboMax,
      };
      this._emit({ type: 'lose', reason, score: s.score, floors: s.floorsClimbed, stars: s.stars, comboMax: s.comboMax });
    },
  };

  return run;
}

/** 兼容骨架别名（可移除） */
export function createSim() {
  return createRun({ seed: 1 });
}
