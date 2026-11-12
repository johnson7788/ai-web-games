// 纯逻辑：一局会话（当前关卡 + 总星数 + 解锁进度）。不碰 DOM。
import { createLevel } from './level.js';
import { LEVEL_COUNT } from '../../config/levels.js';

export function createRun() {
  const run = {
    levelIndex: 0,
    level: null,
    totalStars: 0,
    unlocked: 0,
    cleared: false,

    loadLevel(i) {
      this.levelIndex = ((i % LEVEL_COUNT) + LEVEL_COUNT) % LEVEL_COUNT;
      this.level = createLevel(this.levelIndex);
      this.cleared = false;
      return this.level;
    },

    unscrew(id, force = false) {
      return this.level ? this.level.unscrew(id, force) : { ok: false, reason: 'missing' };
    },

    step(dt) {
      if (this.level && !this.cleared) this.level.step(dt);
    },

    getHud() {
      const st = this.level ? this.level.getState() : null;
      return {
        level: this.levelIndex + 1,
        platesLeft: st ? st.platesLeft : 0,
        screwsLeft: st ? st.screwsLeft : 0,
        time: this.level ? this.level.time : 0,
      };
    },

    drainEvents() {
      return this.level ? this.level.drainEvents() : [];
    },

    // __ll.debug.state()：{ level, plates, screwsLeft, cleared }
    state() {
      const st = this.level ? this.level.getState() : null;
      return st ? { level: this.levelIndex + 1, plates: st.platesLeft, screwsLeft: st.screwsLeft, cleared: st.cleared } : null;
    },

    // 过关结算：按当前用时评星并累计，推进解锁
    completeLevel() {
      const stars = this.level ? this.level.starRating() : 0;
      this.totalStars += stars;
      this.cleared = true;
      this.unlocked = Math.max(this.unlocked, this.levelIndex + 1);
      return stars;
    },
  };

  return run;
}
