// src/game/course.js — 程序化屋顶路线：5 段（天台/管道/窄巷/吊臂/速降）拼接。
// 纯逻辑，无 DOM/THREE/Date.now；随机用传入的 rng（seed 派生），结果确定可测。
import { LEVELS, RUN, SCORE } from '../../config/game.config.js';

// 由 rng 生成确定路线：障碍/拾取物/检查点，全落在 5 段各自区间内。
export function createCourse(rng) {
  const finishZ = RUN.finishZ;
  const obstacles = [];
  const pickups = [];
  let id = 0;

  const vault = (z) => obstacles.push({ id: id++, type: 'vault', z, x: 0, w: 999, h: 1.2, cleared: false });
  const slide = (z) => obstacles.push({ id: id++, type: 'slide', z, x: 0, w: 999, h: 0.9, cleared: false });
  const wallrun = (z) => obstacles.push({ id: id++, type: 'wallrun', z, x: 0, w: 999, gapW: 8, cleared: false });
  const crane = (z) => obstacles.push({
    id: id++, type: 'crane', z, x: 0, gapW: 9,
    platformAmp: 2.6, platformFreq: 0.9, phase: rng() * Math.PI * 2, platformHalf: 1.35, cleared: false,
  });
  const pickup = (z, x) => pickups.push({ id: id++, z, x, taken: false });

  // 段 1 · 天台：矮墙翻越（含签名三连矮墙 z=120/132/144）
  vault(40); vault(72); vault(96);
  vault(120); vault(132); vault(144);
  vault(176); vault(208); vault(240); vault(272); vault(304); vault(336); vault(368);
  pickup(230, 0); pickup(340, 2);

  // 段 2 · 管道：滑铲 + 翻越交替
  [420, 480, 540, 600, 660, 720, 780].forEach(slide);
  [450, 510, 570, 630, 690, 750].forEach(vault);
  pickup(495, -2); pickup(705, 0);

  // 段 3 · 窄巷：蹬墙跨越缺口（宽度窄 → 侧向坠落风险）
  [850, 950, 1050, 1150].forEach(wallrun);

  // 段 4 · 吊臂：移动平台过缺口（需对齐 x）
  [1250, 1350, 1450, 1550].forEach(crane);

  // 段 5 · 速降：窄梁 + 连续翻越冲线
  [1680, 1760, 1840, 1920].forEach(vault);
  pickup(1800, 0);

  obstacles.sort((a, b) => a.z - b.z);
  pickups.sort((a, b) => a.z - b.z);

  const sections = LEVELS.map((l) => ({ ...l }));

  return {
    finishZ,
    obstacles,
    pickups,
    sections,
    halfWidthAt(z) {
      let hw = sections[0].halfWidth;
      for (const s of sections) if (z >= s.startZ) hw = s.halfWidth;
      return hw;
    },
    // 当前段 index（1..5），用于 HUD/结算
    sectionAt(z) {
      let idx = 1;
      for (const s of sections) if (z >= s.startZ) idx = s.index;
      return idx;
    },
    // 最近检查点（段起点）
    checkpointAt(z) {
      let cp = { z: 0, section: 1 };
      for (const s of sections) if (z >= s.startZ) cp = { z: s.startZ, section: s.index };
      return cp;
    },
  };
}

// 移动吊臂平台当前 x（由 run.time 计算；纯函数便于测试）
export function cranePlatformX(ob, time) {
  return Math.sin(time * ob.platformFreq + ob.phase) * ob.platformAmp;
}

export function ratingFor(score) {
  let r = 'C';
  for (const [name, min] of SCORE.ratings) if (score >= min) { r = name; break; }
  return r;
}
