// 国际化文案：en 默认，zh 必做；本作只暴露 en/zh（ja/ko/ar/ru 已整块删除）。
// UI 侧只允许 t(key) 取文案；key 必须与 en 完全一致、无空值。
export const locales = {
  en: {
    // 标题屏
    'title.logo': 'IRON SIEGE',
    'title.tagline': 'Drive the armored mech. Guard the Core Furnace. Break the steel tide.',
    'title.best': 'Best wave {wave}',

    // 按钮
    'btn.start': 'Deploy',
    'btn.how': 'How to play',
    'btn.settings': 'Settings',
    'btn.resume': 'Resume',
    'btn.restart': 'Restart',
    'btn.share': 'Share',
    'btn.skip': 'Skip',
    'btn.close': 'Close',
    'btn.back': 'Back',
    'btn.weld': 'Weld',
    'btn.fire': 'FIRE',
    'btn.heavy': 'HEAVY',

    // 设置
    'set.title': 'Settings',
    'set.language': 'Language',
    'set.loading': 'Charging the forge…',
    'set.rotate': 'Rotate for the best view',
    'set.back': 'Back',
    'set.mute': 'Sound',

    // HUD（右控制台）
    'hud.wave': 'Wave',
    'hud.scene': 'Sector',
    'hud.lives': 'Mechs',
    'hud.firepower': 'Firepower',
    'hud.heavy': 'Heavy shells',
    'hud.score': 'Score',
    'hud.furnace': 'Core Furnace',
    'hud.enemies': 'Hostiles left',
    'hud.controls': 'Controls',

    // 暂停
    'pause.title': 'Paused',
    'pause.hint': 'Press Esc or P to resume',

    // 结算
    'result.title': 'FORGE OVERRUN',
    'result.winTitle': 'SIEGE BROKEN',
    'result.wave': 'Wave reached',
    'result.score': 'Score',
    'result.kills': 'Mechs destroyed',
    'result.best': 'Best wave',
    'result.newRecord': 'NEW RECORD',
    'result.hint': 'Press R to deploy again',
    'result.winHint': 'All 12 waves cleared — the fortress stands.',

    // 场景名
    'scene.wastes': 'IRON WASTES',
    'scene.snowfield': 'SNOWFIELD',
    'scene.molten': 'MOLTEN CITY',

    // 敌人
    'enemy.normal': 'Scout',
    'enemy.fast': 'Raider',
    'enemy.armored': 'Juggernaut',
    'enemy.prop': 'Supply rig',

    // 波间强化
    'up.title': 'Forge upgrade',
    'up.firepower': 'Firepower +1',
    'up.speed': 'Traction +12%',
    'up.armor': 'Core armor +1',
    'up.ammo': 'Heavy shells +1/wave',

    // 道具
    'prop.star': 'Star core',
    'prop.bomb': 'Seismic bomb',
    'prop.fence': 'Armor plating',
    'prop.clock': 'Time freeze',

    // 首次交互引导
    'tut.title': 'First deployment',
    'tut.1': 'Move the mech — WASD / arrows / joystick',
    'tut.2': 'Fire the main cannon — Space or J',
    'tut.3': 'Fire a heavy shell — K (breaks steel)',
    'tut.4': 'Destroy an enemy mech',
    'tut.step': 'Step {n}/{total}',
  },
  zh: {
    // 标题屏
    'title.logo': 'IRON SIEGE',
    'title.tagline': '驾驶装甲机甲，守住核心熔炉，击碎钢铁洪流。',
    'title.best': '最远到达第 {wave} 波',

    // 按钮
    'btn.start': '出击',
    'btn.how': '怎么玩',
    'btn.settings': '设置',
    'btn.resume': '继续',
    'btn.restart': '重新开始',
    'btn.share': '分享',
    'btn.skip': '跳过',
    'btn.close': '关闭',
    'btn.back': '返回',
    'btn.weld': '焊修',
    'btn.fire': '开火',
    'btn.heavy': '重炮',

    // 设置
    'set.title': '设置',
    'set.language': '语言',
    'set.loading': '熔炉充能中…',
    'set.rotate': '旋转设备获得最佳体验',
    'set.back': '返回',
    'set.mute': '声音',

    // HUD（右控制台）
    'hud.wave': '波次',
    'hud.scene': '战区',
    'hud.lives': '机甲',
    'hud.firepower': '火力',
    'hud.heavy': '重炮弹',
    'hud.score': '分数',
    'hud.furnace': '核心熔炉',
    'hud.enemies': '剩余敌人',
    'hud.controls': '操作',

    // 暂停
    'pause.title': '已暂停',
    'pause.hint': '按 Esc 或 P 继续',

    // 结算
    'result.title': '要塞沦陷',
    'result.winTitle': '围城已破',
    'result.wave': '到达波次',
    'result.score': '分数',
    'result.kills': '击毁机甲',
    'result.best': '最远波次',
    'result.newRecord': '新纪录',
    'result.hint': '按 R 重新出击',
    'result.winHint': '12 波全部肃清——要塞屹立不倒。',

    // 场景名
    'scene.wastes': '钢铁荒原',
    'scene.snowfield': '雪原',
    'scene.molten': '熔城',

    // 敌人
    'enemy.normal': '侦察兵',
    'enemy.fast': '突袭者',
    'enemy.armored': '重装机甲',
    'enemy.prop': '补给车',

    // 波间强化
    'up.title': '熔炉强化',
    'up.firepower': '火力 +1',
    'up.speed': '牵引 +12%',
    'up.armor': '核心护甲 +1',
    'up.ammo': '重炮弹 +1/波',

    // 道具
    'prop.star': '星核',
    'prop.bomb': '震爆弹',
    'prop.fence': '装甲板',
    'prop.clock': '时间冻结',

    // 首次交互引导
    'tut.title': '首次出击',
    'tut.1': '移动机甲 — WASD / 方向键 / 摇杆',
    'tut.2': '主炮开火 — 空格 或 J',
    'tut.3': '发射重炮 — K（可击穿钢墙）',
    'tut.4': '击毁一架敌机甲',
    'tut.step': '步骤 {n}/{total}',
  },
};
