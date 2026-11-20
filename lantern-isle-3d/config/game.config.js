// 全局数值与世界布局（config-first：逻辑层不写死数字）。
// 地形高度公式在 src/game/terrain.js（纯函数，sim 与 render 共用同一份，绝不出现「看得见踩不着」）。

export const STEP = 1 / 60;
export const WORLD = { HALF: 62, SEG: 150, WATER_Y: -0.35 };

export const CONFIG = {
  slug: 'lantern-isle-3d',
  version: 1,
  // ---- i18n / save（i18n.js 与 save.js 依赖这些字段）----
  defaultLang: 'en',
  languages: ['en', 'zh'],
  rtlLangs: ['ar'],
  langStorageKey: 'lantern-isle-3d-lang',
  saveKey: 'lantern-isle-3d-save',
  langNames: { en: 'English', zh: '中文' },

  world: {
    half: WORLD.HALF, seg: WORLD.SEG, waterY: WORLD.WATER_Y,
    zones: [
      { name: 'harbor', x: -46, z: 4, r: 20, y: 1.1, bias: 0.9 },
      { name: 'village', x: -22, z: -2, r: 18, y: 1.6, bias: 0.85 },
      { name: 'dune', x: -4, z: 6, r: 16, y: 2.6, bias: 0.8 },
      { name: 'rocks', x: 12, z: -6, r: 15, y: 4.0, bias: 0.7 },
      { name: 'pine', x: 23, z: 14, r: 17, y: 7.4, bias: 0.75 },
      { name: 'cliff', x: 37, z: 2, r: 15, y: 12.0, bias: 0.7 },
      { name: 'summit', x: 50, z: -6, r: 11, y: 17.5, bias: 1 },
    ],
    path: [[-46, 6], [-38, 2], [-28, -1], [-18, 0], [-8, 3], [2, 5], [10, 0], [16, -4], [22, 4], [28, 9], [34, 5], [42, 0], [49, -5]],
  },

  // 灯位：big = 必须用大灯（主塔），oilCost 每盏耗油，lightSec 引导时长
  stations: [
    { id: 'lamp_harbor', zone: 'harbor', x: -44, z: 4, lightSec: 2.0 },
    { id: 'lamp_village', zone: 'village', x: -25, z: -4, lightSec: 2.2 },
    { id: 'lamp_village2', zone: 'village', x: -16, z: 3, lightSec: 2.2 },
    { id: 'lamp_dune', zone: 'dune', x: -2, z: 8, lightSec: 2.4 },
    { id: 'lamp_rocks', zone: 'rocks', x: 13, z: -8, lightSec: 2.6 },
    { id: 'lamp_pine', zone: 'pine', x: 23, z: 12, lightSec: 2.8 },
    { id: 'lamp_cliff', zone: 'cliff', x: 37, z: 3, lightSec: 3.0 },
    { id: 'lamp_tower', zone: 'summit', x: 50, z: -6, lightSec: 4.2, big: true, oilCost: 2 },
  ],

  pickups: [
    { id: 'lantern_small', zone: 'harbor', kind: 'lantern', x: -45, z: 10, count: 4, spread: 3.4 },
    { id: 'lantern_village', zone: 'village', kind: 'lantern', x: -21, z: -7, count: 2, spread: 2.6 },
    { id: 'lantern_big', zone: 'harbor', kind: 'lantern', big: true, x: -49, z: 5, count: 1 },
    { id: 'lantern_pine', zone: 'pine', kind: 'lantern', x: 25, z: 16, count: 2, spread: 3 },
    { id: 'oil_drum', zone: 'village', kind: 'oil', x: -13, z: -3, count: 2, spread: 2.2 },
    { id: 'oil_rocks', zone: 'rocks', kind: 'oil', x: 15, z: -3, count: 1 },
    { id: 'oil_summit', zone: 'summit', kind: 'oil', x: 47, z: -9, count: 1 },
    { id: 'glass_pine', zone: 'pine', kind: 'glass', x: 27, z: 19, count: 1 },
  ],

  npcs: {
    warden: { id: 'warden', x: -27, z: 1, ry: 2.1, model: 'npc_warden' },
    netmender: { id: 'netmender', x: -43, z: -3, ry: 0.6, model: 'npc_netmender' },
    lampchild: { id: 'lampchild', x: 24, z: 15, ry: 3.4, model: 'npc_lampchild' },
  },

  buildings: [
    { model: 'build_lighthouse_01', x: 50, z: -6, ry: 0, scale: 1, solid: 2.6 },
    { model: 'build_cottage_a', x: -26, z: -4, ry: 0.5, scale: 1, solid: 3.0 },
    { model: 'build_cottage_b', x: -20, z: 4, ry: -2.3, scale: 1, solid: 3.2 },
    { model: 'build_cottage_a', x: -14, z: -6, ry: 1.6, scale: 0.92, solid: 3.0 },
    { model: 'build_shed_01', x: -42, z: -2, ry: 0.2, scale: 1, solid: 2.2 },
    { model: 'build_boathouse_01', x: -49, z: -3, ry: 1.2, scale: 1, solid: 2.8 },
    { model: 'build_well_01', x: -23, z: -1, ry: 0, scale: 1, solid: 1.2 },
    { model: 'build_pier_platform_01', x: -52, z: 9, ry: 0, scale: 1, solid: 0 },
    { model: 'build_stairs_01', x: 33, z: 7, ry: 1.1, scale: 1.1, solid: 0 },
    { model: 'build_fence_01', x: -34, z: 3, ry: 0.1, scale: 1, solid: 0 },
    { model: 'build_fence_01', x: -31, z: 3, ry: 0.1, scale: 1, solid: 0 },
  ],
  props: [
    { model: 'prop_lantern_post_01', at: 'lamp_harbor', solid: 0.3, tag: 'station' },
    { model: 'prop_lantern_post_01', at: 'lamp_village', solid: 0.35, tag: 'station' },
    { model: 'prop_lantern_post_01', at: 'lamp_village2', solid: 0.35, tag: 'station' },
    { model: 'prop_lantern_post_01', at: 'lamp_dune', solid: 0.35, tag: 'station' },
    { model: 'prop_lantern_post_01', at: 'lamp_rocks', solid: 0.35, tag: 'station' },
    { model: 'prop_lantern_post_01', at: 'lamp_pine', solid: 0.35, tag: 'station' },
    { model: 'prop_lantern_post_01', at: 'lamp_cliff', solid: 0.35, tag: 'station' },
    { model: 'env_crate_stack_01', x: -47, z: 3, scale: 1, solid: 1.0 },
    { model: 'env_crate_stack_01', x: -19, z: -2, ry: 1.1, scale: 0.9, solid: 1.0 },
    { model: 'prop_bell_01', x: -48, z: 6, scale: 1, solid: 0.6 },
  ],
  scatter: [
    { model: 'env_tree_pine_01', zone: 'pine', count: 40, scale: [0.8, 1.3], solid: 0.5 },
    { model: 'env_tree_pine_01', zone: 'village', count: 5, scale: [0.7, 1.0], solid: 0.5 },
    { model: 'env_rock_01', zone: 'rocks', count: 30, scale: [0.6, 1.6], solid: 0.8 },
    { model: 'env_rock_01', zone: 'dune', count: 7, scale: [0.4, 0.8], solid: 0 },
    { model: 'env_rock_01', zone: 'rocks', count: 10, scale: [1.3, 2.4], solid: 1.4 },
    { model: 'env_bush_01', zone: 'dune', count: 30, scale: [0.7, 1.2], solid: 0 },
    { model: 'env_bush_01', zone: 'pine', count: 16, scale: [0.8, 1.4], solid: 0 },
    { model: 'env_grass_tuft_01', zone: 'dune', count: 90, scale: [0.7, 1.5], solid: 0 },
    { model: 'env_grass_tuft_01', zone: 'village', count: 60, scale: [0.7, 1.3], solid: 0 },
    { model: 'prop_crate_01', zone: 'harbor', count: 4, scale: [0.8, 1.1], solid: 0.9 },
    { model: 'prop_oil_barrel_01', zone: 'village', count: 3, scale: [0.9, 1.1], solid: 0.7 },
  ],

  player: {
    walkSpeed: 3.3, runSpeed: 6.1, accel: 26, friction: 14, gravity: 22, jumpVel: 7.4,
    coyoteMs: 120, jumpBufferMs: 150, radius: 0.44, turnRate: 12, runThreshold: 4.3, crossfadeSec: 0.18,
    stepSec: 0.055,
  },
  camera: { dist: 7.6, height: 3.1, pitch: 0.3, pitchMin: -0.16, pitchMax: 1.0, smooth: 9, sensitivity: 0.0034 },

  levels: [
    { name: 'night1', durationSec: 215, oil: 5, capacity: 3, route: ['harbor', 'village', 'dune'], gustEvery: [22, 34], extinguish: 0, hazards: [], spawn: { x: -43, z: 9 }, newElement: '基础：搬灯 / 引导点灯 / 负重降速' },
    { name: 'night2', durationSec: 210, oil: 6, capacity: 3, route: ['harbor', 'village', 'dune', 'rocks'], gustEvery: [14, 22], extinguish: 0, hazards: ['gust'], spawn: { x: -43, z: 9 }, newElement: '阵风：风口会吹落手里的灯' },
    { name: 'night3', durationSec: 205, oil: 6, capacity: 4, route: ['harbor', 'village', 'dune', 'rocks', 'pine'], gustEvery: [13, 20], extinguish: 0.05, hazards: ['gust', 'fog'], spawn: { x: -43, z: 9 }, newElement: '迷雾与坡地：视野缩短，松林里藏着灯与油' },
    { name: 'night4', durationSec: 200, oil: 7, capacity: 4, route: ['harbor', 'village', 'dune', 'rocks', 'pine', 'cliff'], gustEvery: [11, 17], extinguish: 0.12, hazards: ['gust', 'fog', 'cliff'], spawn: { x: -43, z: 9 }, newElement: '崖顶强阵风：崖段灯会被吹灭，需要看守人预警' },
    { name: 'night5', durationSec: 235, oil: 8, capacity: 4, route: ['harbor', 'village', 'dune', 'rocks', 'pine', 'cliff', 'summit'], gustEvery: [9, 14], extinguish: 0.18, hazards: ['gust', 'fog', 'cliff', 'storm'], spawn: { x: -43, z: 9 }, newElement: '风暴夜：全岛要素 + 主塔要大灯与双份油' },
  ],

  quests: [
    { id: 'collect_oil', reward: { oil: 2, score: 120 }, from: 'warden' },
    { id: 'deliver_lantern', reward: { score: 200, time: 10, unlock: 'lantern_resonance' }, from: 'netmender' },
    { id: 'find_glass', reward: { time: 16, score: 150, unlock: 'warden_warning' }, from: 'lampchild' },
  ],
  upgrades: [
    { id: 'lantern_resonance', kind: 'rule', effect: 'lantern_resonance' },
    { id: 'warden_warning', kind: 'rule', effect: 'warden_warning' },
    { id: 'sure_hands', kind: 'rule', effect: 'sure_hands' },
    { id: 'slow_wind', kind: 'rule', effect: 'slow_wind' },
    { id: 'oil_recovery', kind: 'rule', effect: 'oil_recovery' },
    { id: 'cap1', kind: 'stat', effect: 'capacity' },
    { id: 'speed1', kind: 'stat', effect: 'speed' },
    { id: 'light_fast', kind: 'stat', effect: 'light_fast' },
    { id: 'storm_resist', kind: 'stat', effect: 'storm_resist' },
  ],

  animations: { skeleton: 'HERO_RIG_v1', clips: ['idle', 'walk', 'run', 'jump', 'carry', 'talk'], fps: 30, crossfadeSec: 0.18 },
  audio: {
    bgmVolume: 0.5, sfxVolume: 0.7,
    bgmFiles: { main: 'assets/audio/bgm_main.mp3', storm: 'assets/audio/bgm_storm.mp3' },
    // NPC 配音 descoped：indextts 需要参考音色（spk_audio_prompt / ref_audio_base64），本轮无授权音色可用。
    // 不在 config 里留会 404 的路径；运行期由 game-audio.voice() 返回 false，UI 不播即可。
    voices: {},
  },
  npc: { mode: 'offline', maxTalkDistance: 6 },
  sdk: { enabled: true },
  tutorialSeed: { steps: 4 },
};
export default CONFIG;
