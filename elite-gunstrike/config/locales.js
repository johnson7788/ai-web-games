// 国际化文案：en 默认，zh 必做；本作只暴露 en/zh。
// UI 侧只允许 t(key) 取文案；key 必须与 en 完全一致、无空值。
export const locales = {
  en: {
    // 标题屏
    'title.logo': 'ELITE GUNSTRIKE',
    'title.tagline': 'Drag to sling neon bolts. Topple every hostile drone before the reactor melts down.',
    'title.best': 'Best sector {level}',
    'title.stars': 'Total stars {stars}',

    // 按钮
    'btn.start': 'Deploy',
    'btn.how': 'How to play',
    'btn.settings': 'Settings',
    'btn.resume': 'Resume',
    'btn.restart': 'Restart',
    'btn.share': 'Share',
    'btn.skip': 'Skip',
    'btn.close': 'Close',
    'btn.again': 'Redeploy',

    // 设置
    'set.title': 'Settings',
    'set.language': 'Language',
    'set.loading': 'Loading…',
    'set.rotate': 'Rotate for the best view',
    'set.back': 'Back',

    // HUD
    'hud.sector': 'Sector',
    'hud.score': 'Score',
    'hud.combo': 'Combo',
    'hud.ammo': 'Bolts',
    'hud.targets': 'Targets',
    'hud.meltdown': 'Reactor',

    // 敌人
    'enemy.scout': 'Scout',
    'enemy.turret': 'Turret',
    'enemy.heavy': 'Mech',

    // 场景
    'scene.foundry': 'Neon Foundry',
    'scene.reactor': 'Crimson Reactor',
    'scene.citadel': 'Violet Citadel',

    // 暂停
    'pause.title': 'Paused',
    'pause.hint': 'Press Esc to resume',

    // 结算
    'result.title': 'Strike Complete',
    'result.sector': 'Sector reached',
    'result.score': 'Score',
    'result.maxCombo': 'Best combo',
    'result.best': 'Best sector',
    'result.stars': 'Stars',
    'result.newRecord': 'NEW RECORD',
    'result.hint': 'Press R to redeploy',

    // 战斗横幅
    'banner.clear': 'Sector Clear',
    'banner.stars': '{stars} ★',
    'banner.scene': 'Entering {name}',

    // 首次交互引导
    'tut.title': 'First strike',
    'tut.1': 'Drag away from the turret to aim',
    'tut.2': 'Release to launch a neon bolt',
    'tut.3': 'Take down a hostile drone',
    'tut.4': 'Never hit a shielded captive',
    'tut.step': 'Step {n}/{total}',
  },
  zh: {
    // 标题屏
    'title.logo': '精英枪袭',
    'title.tagline': '拖拽甩出霓虹能量弹，在反应堆熔毁前击倒所有敌机。',
    'title.best': '最佳第 {level} 区',
    'title.stars': '累计 {stars} 星',

    // 按钮
    'btn.start': '出击',
    'btn.how': '怎么玩',
    'btn.settings': '设置',
    'btn.resume': '继续',
    'btn.restart': '重开',
    'btn.share': '分享',
    'btn.skip': '跳过',
    'btn.close': '关闭',
    'btn.again': '重新出击',

    // 设置
    'set.title': '设置',
    'set.language': '语言',
    'set.loading': '加载中…',
    'set.rotate': '旋转设备获得最佳体验',
    'set.back': '返回',

    // HUD
    'hud.sector': '第几区',
    'hud.score': '得分',
    'hud.combo': '连击',
    'hud.ammo': '弹量',
    'hud.targets': '目标',
    'hud.meltdown': '反应堆',

    // 敌人
    'enemy.scout': '侦察机',
    'enemy.turret': '炮塔机',
    'enemy.heavy': '重装机甲',

    // 场景
    'scene.foundry': '霓虹铸造厂',
    'scene.reactor': '深红反应堆',
    'scene.citadel': '紫罗兰堡垒',

    // 暂停
    'pause.title': '已暂停',
    'pause.hint': '按 Esc 继续',

    // 结算
    'result.title': '突袭结束',
    'result.sector': '到达区段',
    'result.score': '得分',
    'result.maxCombo': '最大连击',
    'result.best': '最佳区段',
    'result.stars': '星数',
    'result.newRecord': '新纪录',
    'result.hint': '按 R 键重新出击',

    // 战斗横幅
    'banner.clear': '区域肃清',
    'banner.stars': '{stars} ★',
    'banner.scene': '进入 {name}',

    // 首次交互引导
    'tut.title': '首次突击',
    'tut.1': '从炮塔向外拖拽瞄准',
    'tut.2': '松手发射霓虹能量弹',
    'tut.3': '击倒一架敌机',
    'tut.4': '绝不要打中带护盾的俘虏',
    'tut.step': '步骤 {n}/{total}',
  },
};
