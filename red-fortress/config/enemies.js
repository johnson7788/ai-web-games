// 敌人数值表。sim 只读；渲染层按 type 画自己的形状，不读颜色。
export const ENEMY_TYPES = {
  rifle: {
    hp: 1, r: 13, speed: 62, score: 60,
    fireCd: 1.6, bulletSpeed: 300, dmg: 1, range: 520, keep: 0,
    aimJitter: 0.10, w: 26, h: 26, burst: 1,
  },
  rocket: {
    hp: 2, r: 15, speed: 54, score: 120,
    fireCd: 2.6, bulletSpeed: 240, dmg: 1, range: 640, keep: 360,
    aimJitter: 0.04, w: 30, h: 30, burst: 1,
  },
  tank: {
    hp: 8, r: 24, speed: 46, score: 300,
    fireCd: 2.2, bulletSpeed: 380, dmg: 2, range: 700, keep: 120,
    aimJitter: 0.02, w: 44, h: 56, burst: 1,
  },
  turret: {
    hp: 5, r: 20, speed: 0, score: 150,
    fireCd: 1.4, bulletSpeed: 340, dmg: 1, range: 560, keep: 0,
    aimJitter: 0.02, w: 40, h: 40, burst: 1,
  },
  mortar: {
    hp: 4, r: 18, speed: 0, score: 180,
    fireCd: 3.2, bulletSpeed: 0, dmg: 1, range: 800,
    radius: 70, fuse: 1.1, w: 36, h: 36, burst: 1,
  },
  mine: {
    hp: 1, r: 14, speed: 0, score: 40,
    dmg: 2, radius: 64, trigger: 44, w: 22, h: 22, burst: 0,
  },
  tankboss: {
    hp: 60, r: 34, speed: 30, score: 1500,
    fireCd: 1.6, bulletSpeed: 360, dmg: 1, range: 900, keep: 180,
    aimJitter: 0.02, w: 84, h: 104, burst: 3,
  },
  boss: {
    nodeHp: 16, coreHp: 100, fireCd: 2.4, bulletSpeed: 300,
    dmg: 1, spawnCd: 14, score: 5000,
    w: 520, h: 300,
  },
};

// 敌人子弹统一参数（sim 用）
export const ENEMY_BULLET = {
  life: 4.0,
  r: 7,
  killableByGrenade: true,
};
