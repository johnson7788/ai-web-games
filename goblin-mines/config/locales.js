// 国际化文案：en 默认，zh 必做；本作只暴露 en/zh（ja/ko/ar/ru 整块不暴露）。
// UI 侧只允许 t(key) 取文案；key 必须与 en 完全一致、无空值。
export const locales = {
  en: {
    // 标题屏
    'title.logo': 'GOBLIN MINES',
    'title.tagline': 'Swap veins, hire lantern goblins, dig the night mine.',
    'title.best': 'Deepest shaft {shaft} · {coins} gold',

    // 按钮
    'btn.start': 'Enter Mine',
    'btn.how': 'How to play',
    'btn.settings': 'Settings',
    'btn.resume': 'Resume',
    'btn.restart': 'New mine',
    'btn.share': 'Share',
    'btn.skip': 'Skip',
    'btn.close': 'Close',
    'btn.dig': 'Dig deeper',
    'btn.reinforce': 'Reinforce (8g)',
    'btn.gamble': 'Gamble',
    'btn.hire': 'Hire goblin',
    'btn.upgrade': 'Upgrade',
    'btn.back': 'Back',

    // 设置
    'set.title': 'Settings',
    'set.language': 'Language',
    'set.loading': 'Lighting lanterns…',
    'set.rotate': 'Rotate for the best view',
    'set.back': 'Back',

    // HUD
    'hud.shaft': 'Shaft',
    'hud.depth': 'Depth',
    'hud.moves': 'Moves',
    'hud.stability': 'Stability',
    'hud.coins': 'Gold',
    'hud.fuel': 'Fuel',
    'hud.boss': 'Mine beast',

    // 矿石名
    'ore.ruby': 'Ruby',
    'ore.sapphire': 'Sapphire',
    'ore.amethyst': 'Amethyst',
    'ore.emerald': 'Emerald',
    'ore.fuel': 'Fuel',
    'ore.gold': 'Gold',

    // 场景名（章节）
    'scene.fluorite': 'Fluorite Cave',
    'scene.copper': 'Copper Town',
    'scene.abyss': 'Abyss Shaft',

    // 暂停 / 结算
    'pause.title': 'Paused',
    'pause.hint': 'Press Esc to resume',
    'result.title': 'Mine Collapsed',
    'result.shaft': 'Shaft reached',
    'result.depth': 'Depth',
    'result.coins': 'Gold mined',
    'result.newRecord': 'NEW DEPTH',
    'result.best': 'Deepest shaft',
    'result.hint': 'Press R to dig again',

    // 首次交互引导
    'tut.title': 'First night shift',
    'tut.1': 'Drag one ore to swap it with a neighbour',
    'tut.2': 'Make a match of 3 to mine ore',
    'tut.3': 'Clear the rocks, then press Dig deeper',
    'tut.step': 'Step {n}/{total}',

    // 技能
    'skill.fuelSurge': 'Fuel Surge',
    'skill.tnt': 'TNT',
    'skill.fuelCollect': 'Fuel Collector',
    'skill.precisePick': 'Precise Pick',
    'skill.cost': 'Cost',

    // 事件提示
    'event.collapse': 'Cave-in incoming!',
    'event.shaftClear': 'Shaft cleared!',
    'event.boss': 'A mine beast stirs…',

    // 矿工
    'goblin.title': 'Lantern goblins',
    'goblin.lit': 'lit',
    'goblin.dim': 'dim',
  },
  zh: {
    'title.logo': '地精矿脉',
    'title.tagline': '交换矿脉、雇佣提灯地精、挖穿深夜矿洞。',
    'title.best': '最深矿道 {shaft} · {coins} 金币',

    'btn.start': '进入矿洞',
    'btn.how': '怎么玩',
    'btn.settings': '设置',
    'btn.resume': '继续',
    'btn.restart': '重开矿洞',
    'btn.share': '分享',
    'btn.skip': '跳过',
    'btn.close': '关闭',
    'btn.dig': '向下挖',
    'btn.reinforce': '加固（8 金）',
    'btn.gamble': '赌一把',
    'btn.hire': '雇佣地精',
    'btn.upgrade': '升级',
    'btn.back': '返回',

    'set.title': '设置',
    'set.language': '语言',
    'set.loading': '点亮灯笼中…',
    'set.rotate': '旋转设备获得最佳体验',
    'set.back': '返回',

    'hud.shaft': '矿道',
    'hud.depth': '深度',
    'hud.moves': '步数',
    'hud.stability': '安全度',
    'hud.coins': '金币',
    'hud.fuel': '燃料',
    'hud.boss': '矿兽',

    'ore.ruby': '红宝石',
    'ore.sapphire': '蓝宝石',
    'ore.amethyst': '紫晶',
    'ore.emerald': '绿宝石',
    'ore.fuel': '燃料',
    'ore.gold': '金块',

    'scene.fluorite': '萤石洞',
    'scene.copper': '铜镇',
    'scene.abyss': '深渊竖井',

    'pause.title': '已暂停',
    'pause.hint': '按 Esc 继续',
    'result.title': '矿洞塌方',
    'result.shaft': '抵达矿道',
    'result.depth': '深度',
    'result.coins': '挖得金币',
    'result.newRecord': '新深度',
    'result.best': '历史最深',
    'result.hint': '按 R 键再挖一次',

    'tut.title': '初次夜班',
    'tut.1': '拖动一块矿石与相邻矿石交换',
    'tut.2': '凑成 3 连消来挖矿',
    'tut.3': '清空岩壁，然后按下「向下挖」',
    'tut.step': '步骤 {n}/{total}',

    'skill.fuelSurge': '燃油充能',
    'skill.tnt': 'TNT',
    'skill.fuelCollect': '燃油收集',
    'skill.precisePick': '精准采集',
    'skill.cost': '消耗',

    'event.collapse': '塌方预警！',
    'event.shaftClear': '矿道打通！',
    'event.boss': '矿兽苏醒了……',

    'goblin.title': '提灯地精',
    'goblin.lit': '点亮',
    'goblin.dim': '熄灭',
  },
};
