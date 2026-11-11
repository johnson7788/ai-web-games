// LAST LINE / 最后一笔 —— 全局配置
// 约定：这里是唯一真相。逻辑层（src/game）不得出现硬编码数值，
// 调手感只改本文件，测试会按这里的数值回归。
export const STEP = 1 / 60;            // 固定逻辑步长（60Hz）
export const WORLD = {
  w: 1280,                             // 逻辑世界宽（16:9）
  h: 720,
  groundY: 636,                        // 地面线
  gravity: 5000,                       // 与原版火柴人一致的强力重力
  wallBounce: 0.35,
};

export const CONFIG = {
  appId: 'last-line',
  title: 'LAST LINE',
  titleZh: '最后一笔',
  version: '1.0.0',
  saveKey: 'lastline.save.v1',
  lang: 'auto',

  world: WORLD,
  step: STEP,

  // 火柴人体型（比原版放大 1.25×，在 1280×720 里更清晰）
  rig: {
    scale: 1.25,
    neck: 6 * 1.25,
    arm: 16 * 1.25,
    body: 22 * 1.25,
    leg: 18 * 1.25,
    minGap: 9,                         // 两手/两脚最小间距
    drag: 0.004,                       // 每步速度阻尼
  },

  player: {
    maxInk: 100,
    walkSpeed: 760,   // 脚钉地滑步会损失约 45% 速度，所以基础值给大
    walkAccel: 5200,
    airAccel: 2600,
    friction: 0.82,
    jump: -700,
    jumpCut: 0.55,                     // 松开跳键截断上升
    coyote: 0.09,
    jumpBuffer: 0.1,
    dashSpeed: 1180,
    dashTime: 0.15,
    dashCost: 9,
    dashCharges: 2,
    dashRecharge: 1.15,
    dashInvuln: 0.22,
    dashDamage: 26,
    meleeDmg: 52,
    meleeRange: 78,
    meleeArc: 2.1,
    meleeCd: 0.42,
    meleeLunge: 420,
    reloadPress: 0.0,                  // 立即换弹
    inkRegen: 1.3,
    regenDelay: 1.6,
    inkPerKill: 8,
    pickupInk: 7,
    pickupRadius: 46,
    magnetRadius: 110,
    invulnOnHurt: 0.55,
    hurtFlash: 0.18,
    recoilScale: 1,
    mass: 1,
  },

  enemyScale: {
    scribble: 0.86,
    nib: 1.0,
    compass: 1.1,
    smudge: 1.35,
    eraser: 1.15,
    blank: 3.6,
  },

  combat: {
    headTargetRing: 30,                // 命中原版：头部小判定环
    bodyRadius: 26,
    limbRadius: 18,
    friendlyFire: false,
    hitstop: 0.045,                    // 命中顿帧（表现层用）
    hitstopHeavy: 0.075,
    killSlowmo: 0.18,                  // 击杀慢放（表现层用）
    comboWindow: 3.0,
    comboMax: 30,
    bulletLife: 1.8,
    maxDecals: 64,
  },

  camera: {
    shakeKick: 1.0,
    shakeDecay: 5.5,
    maxShake: 26,
    zoom: 1,
  },

  wave: {
    introDelay: 1.35,                  // 幕首卡片→开打
    spawnInterval: 0.7,
    nextWaveDelay: 2.0,
    pickupVacuum: true,
    clearBonusInk: 15,
  },

  // 一幕 = 3 笔（波次）；第 5 幕为 Boss
  acts: [
    {
      id: 'draft', no: 1, palette: 'draft', waves: [
        { groups: [['scribble', 4]] },
        { groups: [['scribble', 5], ['nib', 1]] },
        { groups: [['scribble', 6], ['nib', 2]] },
      ],
    },
    {
      id: 'blueprint', no: 2, palette: 'blueprint', waves: [
        { groups: [['nib', 3], ['scribble', 3]] },
        { groups: [['compass', 1], ['scribble', 6], ['nib', 1]] },
        { groups: [['nib', 2], ['compass', 2], ['scribble', 6]] },
      ],
    },
    {
      id: 'neon', no: 3, palette: 'neon', waves: [
        { groups: [['smudge', 1], ['nib', 3], ['scribble', 5]] },
        { groups: [['eraser', 1], ['compass', 2], ['scribble', 6]] },
        { groups: [['smudge', 2], ['eraser', 1], ['nib', 3]] },
      ],
    },
    {
      id: 'wash', no: 4, palette: 'wash', waves: [
        { groups: [['compass', 3], ['smudge', 2], ['scribble', 8]] },
        { groups: [['eraser', 2], ['nib', 4], ['smudge', 1]] },
        { groups: [['smudge', 3], ['compass', 2], ['nib', 3], ['scribble', 6]] },
      ],
    },
    {
      id: 'blank', no: 5, palette: 'blank', boss: true, waves: [
        { groups: [] },   // Boss 由 beginWave 单独生成，不要在这里重复
      ],
    },
  ],

  upgrades: {
    perPick: 3,
    everyWaves: 1,                     // 每一笔结束后都能补一笔
  },

  difficulty: {
    normal: { hp: 1, dmg: 1, speed: 1, spawn: 1 },
    hard: { hp: 1.25, dmg: 1.3, speed: 1.08, spawn: 1.15 },
  },

  audio: {
    master: 0.9,
    music: 0.55,
    sfx: 0.85,
  },

  quality: {
    // 低画质：关掉颗粒/色差/部分粒子，不改变逻辑
    levels: ['high', 'low'],
    maxParticlesHigh: 900,
    maxParticlesLow: 260,
    decalsHigh: 64,
    decalsLow: 18,
  },

  debug: {
    showHitboxes: false,
    godMode: false,
  },
};

export default CONFIG;
