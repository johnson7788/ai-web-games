// src/game/waves.js — 波次生成：远点错峰入场 + 三种布局（random / alternate / lanes）
// 难度落在关卡表字段上，不在这里写 difficulty 的魔法系数。
import { GAME } from "config/game.config.js";

export class Waves {
  constructor(level) {
    this.level = level;
    // 波次节奏用真实时间源，不用 dt 累加：主循环把 dt 夹在 0.05 以防后台节流跳帧，
    // 低帧率手机上 dt 累加会让「1500ms 一只」被拉成 2~3 秒一只，怪潮节奏整个垮掉。
    this.nextAt = performance.now() + 450;
    this.spawned = 0;
    this.side = 1;
    this.waveIndex = 0;
  }

  /** 返回本帧要生成的敌人类型与位置；没有则返回 null */
  update(dt, player, enemiesAlive) {
    if (this.spawned >= this.level.goal) return null;
    const now = performance.now();
    if (now < this.nextAt || enemiesAlive >= 7) return null;
    this.nextAt = now + (this.level.spawnMs || 1200);
    this.spawned += 1;
    // 生成半径别超过 ~18m：27m 外 1.6m 高的僵尸只有 25px，四肢摆动不足 1px，
    // 玩家只会看到「滑行的黑色立牌」。近一点才能看清骨骼步态与逼近感。
    const r = Math.max(10, (this.level.arenaW || 50) * 0.30);
    let a;
    if (this.level.spawnPattern === "alternate") {
      this.side = -this.side;
      a = this.side * 0.42 * Math.PI + (Math.random() - 0.5) * 0.35 + player.yaw;
    } else if (this.level.spawnPattern === "lanes") {
      const lane = this.spawned % 3;
      a = player.yaw + [-0.85, 0, 0.85][lane] + (Math.random() - 0.5) * 0.25;
    } else {
      // 收窄到前方 ±85°：原来 ±144° 会把近一半的怪刷到背后，玩家看不见任何动作
      a = player.yaw + (Math.random() - 0.5) * Math.PI * 0.95;
    }
    // three 相机 yaw=0 面向 -Z：绕 Y 旋转 (yaw+偏角) 后的前向是 (-sin a, 0, -cos a)。
    // 写成 +sin/+cos 会把整波敌人刷到玩家背后，第一关将一只都看不见。
    const pos = {
      x: player.x - Math.sin(a) * r,
      y: 0,
      z: player.z - Math.cos(a) * r
    };
    return { pos, type: this.pickType() };
  }

  pickType() {
    const lv = this.level;
    const n = this.spawned;
    if (lv.boss && n === lv.goal) return "boss";
    if (lv.newMechanic === "bait" && n % 4 === 0) return "bloater";
    if (lv.newMechanic === "kite" && n % 3 === 0) return "runner";
    if ((lv.chapter === 2 || lv.difficulty >= 4) && n % 5 === 0) return "brute";
    if (lv.difficulty >= 2 && n % 2 === 0) return "runner";
    return "shambler";
  }

  /** 顶部 1-2-3-4-BOSS 链的当前节点 */
  chainNode() {
    const total = this.level.waves || 4;
    return Math.min(total, Math.floor(this.spawned / Math.max(1, this.level.goal / total)) + 1);
  }
}
