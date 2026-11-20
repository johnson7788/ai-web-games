// 国际化文案：en 默认，zh 必做；本作只暴露 en/zh。
// UI 侧只允许 t(key) 取文案；key 必须与 en 完全一致、无空值。
export const locales = {
  en: {
    // 标题屏
    'title.logo': 'NEO TETRA',
    'title.tagline': 'Drop element crystals. Smelt lines. Ignite the furnace.',
    'title.best': 'Best {score}',
    'title.startHint': 'Press Enter or tap Start',

    // 按钮
    'btn.start': 'Start',
    'btn.how': 'How to play',
    'btn.settings': 'Settings',
    'btn.resume': 'Resume',
    'btn.share': 'Share',
    'btn.restart': 'Smelt again',
    'btn.skip': 'Skip',
    'btn.close': 'Close',
    'btn.back': 'Back',

    // 设置
    'set.title': 'Settings',
    'set.language': 'Language',
    'set.loading': 'Charging the furnace…',
    'set.rotate': 'Rotate for the best view',
    'set.mute': 'Sound',
    'set.on': 'On',
    'set.off': 'Off',

    // HUD
    'hud.score': 'Score',
    'hud.level': 'Lv',
    'hud.layer': 'Mine',
    'hud.lines': 'Lines',
    'hud.next': 'Next',
    'hud.hold': 'Hold',
    'hud.heat': 'Heat',
    'hud.target': '{n} to next layer',

    // 场景包
    'scene.copper': 'Copper Mine',
    'scene.ice': 'Ice Crystal',
    'scene.core': 'Melt Core',

    // 矿层
    'layer.1': 'Copper Vein',
    'layer.2': 'Deep Copper',
    'layer.3': 'Iron Vein',
    'layer.4': 'Narrow Iron',
    'layer.5': 'Gold Vein',
    'layer.6': 'Dark Gold',
    'layer.7': 'Diamond Vein',
    'layer.8': 'Narrow Diamond',
    'layer.9': 'Dark Ice',
    'layer.10': 'Magma Vein',
    'layer.11': 'Narrow Magma',
    'layer.12': 'Furnace Core',

    // 暂停
    'pause.title': 'Paused',
    'pause.hint': 'Press Esc to resume',

    // 结算
    'result.title': 'Smelt Over',
    'result.score': 'Score',
    'result.level': 'Level',
    'result.layer': 'Deepest mine',
    'result.lines': 'Lines',
    'result.newRecord': 'NEW RECORD',
    'result.best': 'Best score',
    'result.hint': 'Press R to smelt again',

    // 通关
    'win.title': 'Furnace Complete',
    'win.subtitle': 'All 12 mines smelted.',
    'win.score': 'Final score',

    // 首次交互引导
    'tut.title': 'First smelt',
    'tut.1': 'Move left or right',
    'tut.2': 'Rotate the crystal',
    'tut.3': 'Hard drop to lock it',
    'tut.4': 'Clear a line',
    'tut.step': 'Step {n}/{total}',
  },
  zh: {
    // 标题屏
    'title.logo': 'NEO TETRA',
    'title.tagline': '落下元素晶块，熔炼成行，点燃熔炉。',
    'title.best': '最佳 {score}',
    'title.startHint': '按回车或点开始',

    // 按钮
    'btn.start': '开始',
    'btn.how': '怎么玩',
    'btn.settings': '设置',
    'btn.resume': '继续',
    'btn.share': '分享',
    'btn.restart': '再炼一炉',
    'btn.skip': '跳过',
    'btn.close': '关闭',
    'btn.back': '返回',

    // 设置
    'set.title': '设置',
    'set.language': '语言',
    'set.loading': '熔炉充能中…',
    'set.rotate': '旋转设备获得最佳体验',
    'set.mute': '声音',
    'set.on': '开',
    'set.off': '关',

    // HUD
    'hud.score': '分数',
    'hud.level': '等级',
    'hud.layer': '矿层',
    'hud.lines': '行数',
    'hud.next': '下一个',
    'hud.hold': '暂存',
    'hud.heat': '热力',
    'hud.target': '距下一层 {n} 行',

    // 场景包
    'scene.copper': '铜矿层',
    'scene.ice': '冰晶层',
    'scene.core': '熔核层',

    // 矿层
    'layer.1': '铜矿脉',
    'layer.2': '深铜矿',
    'layer.3': '铁矿脉',
    'layer.4': '窄铁矿',
    'layer.5': '金矿脉',
    'layer.6': '暗金矿',
    'layer.7': '钻石矿脉',
    'layer.8': '窄钻石矿',
    'layer.9': '暗冰晶',
    'layer.10': '熔岩浆脉',
    'layer.11': '窄熔岩',
    'layer.12': '熔炉炉心',

    // 暂停
    'pause.title': '已暂停',
    'pause.hint': '按 Esc 继续',

    // 结算
    'result.title': '熔炼结束',
    'result.score': '分数',
    'result.level': '等级',
    'result.layer': '最深矿层',
    'result.lines': '行数',
    'result.newRecord': '新纪录',
    'result.best': '历史最佳',
    'result.hint': '按 R 键再炼一炉',

    // 通关
    'win.title': '熔炉大成',
    'win.subtitle': '十二层矿脉全部熔炼完毕。',
    'win.score': '最终分数',

    // 首次交互引导
    'tut.title': '初次熔炼',
    'tut.1': '左右移动晶块',
    'tut.2': '旋转晶块',
    'tut.3': '硬降落定',
    'tut.4': '消掉一行',
    'tut.step': '步骤 {n}/{total}',
  },
};
