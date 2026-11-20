// 国际化文案：en 默认，zh 必做；只暴露 en/zh。
export const locales = {
  en: {
    // 标题屏
    'title.logo': 'STAR SLAYER',
    'title.tagline': 'Pilot the Iron Guard. Aim with your partner. Overload when it counts.',
    'title.best': 'Best wave {wave}',

    // 按钮
    'btn.start': 'Launch',
    'btn.how': 'How to play',
    'btn.settings': 'Settings',
    'btn.resume': 'Resume',
    'btn.share': 'Share',
    'btn.restart': 'Launch again',
    'btn.skip': 'Skip',
    'btn.close': 'Close',
    'btn.pick': 'Pick',

    // 设置
    'set.title': 'Settings',
    'set.language': 'Language',
    'set.loading': 'Booting…',
    'set.rotate': 'Rotate for the best view',
    'set.back': 'Back',

    // HUD
    'hud.wave': 'Wave',
    'hud.hp': 'Hull',
    'hud.armor': 'Armor',
    'hud.kills': 'Kills',
    'hud.hostiles': 'Hostiles',
    'hud.scene': 'Deck',
    'hud.core': 'Core',
    'hud.core.online': 'ONLINE',
    'hud.core.offline': 'OFFLINE',
    'hud.overloadReady': 'OVERLOAD READY',
    'hud.syncReady': 'SYNC READY',

    // 场景
    'scene.bridge': 'Bridge',
    'scene.hull': 'Outer Hull',
    'scene.reactor': 'Reactor',
    'scene.boss': 'Core Behemoth',

    // 暂停
    'pause.title': 'Paused',
    'pause.hint': 'Press Esc to resume',

    // 结算
    'result.winTitle': 'Vessel Secured',
    'result.loseTitle': 'Hull Breached',
    'result.wave': 'Waves cleared',
    'result.kills': 'Kills',
    'result.best': 'Best wave',
    'result.newRecord': 'NEW RECORD',
    'result.hint': 'Press R to launch again',

    // 首次交互引导
    'tut.title': 'First sortie',
    'tut.1': 'Move with WASD / joystick',
    'tut.2': 'Hold J to fire',
    'tut.3': 'Destroy an enemy',
    'tut.4': 'Press L to phase-sync',
    'tut.step': 'Step {n}/{total}',

    // 卡牌
    'card.title': 'Choose an upgrade',
    'card.rule': 'RULE',
    'card.stat': 'STAT',
    'card.twinCore': 'Light Core copies fire 2 shots',
    'card.echoStrike': 'Phase-sync leaves an exploding afterimage',
    'card.overloadSpike': 'Overload unlocks at 45% hull',
    'card.coldCore': 'Core offline time halved',
    'card.pierce': 'Shots pierce one extra enemy',
    'card.ricochet': 'Shots ricochet to the nearest foe',
    'card.armorRegen': 'Armor regen starts 2s after hit',
    'card.killHeal': 'Kills restore 2 armor',
    'card.rapidFire': 'Fire rate +18%',
    'card.bigMag': 'Shot damage +30%',
    'card.movespeed': 'Move speed +16%',
    'card.bulk': 'Max hull +25, heal 25',

    // 提示
    'hint.overload.no': 'Overload needs hull < 30% and Core online',
    'hint.sync.no': 'Phase-sync needs the Core online',
  },
  zh: {
    'title.logo': 'STAR SLAYER',
    'title.tagline': '驾驶「铁卫」迎敌，与「光核」并肩，血量告急时启动超载。',
    'title.best': '最佳波次 {wave}',

    'btn.start': '出击',
    'btn.how': '怎么玩',
    'btn.settings': '设置',
    'btn.resume': '继续',
    'btn.share': '分享',
    'btn.restart': '再次出击',
    'btn.skip': '跳过',
    'btn.close': '关闭',
    'btn.pick': '选择',

    'set.title': '设置',
    'set.language': '语言',
    'set.loading': '启动中…',
    'set.rotate': '旋转设备获得最佳体验',
    'set.back': '返回',

    'hud.wave': '波次',
    'hud.hp': '护甲值',
    'hud.armor': '装甲',
    'hud.kills': '击杀',
    'hud.hostiles': '敌机',
    'hud.scene': '舰区',
    'hud.core': '光核',
    'hud.core.online': '在线',
    'hud.core.offline': '离线',
    'hud.overloadReady': '超载就绪',
    'hud.syncReady': '同步就绪',

    'scene.bridge': '舰桥',
    'scene.hull': '舰体外壳',
    'scene.reactor': '反应堆',
    'scene.boss': '核心巨兽',

    'pause.title': '已暂停',
    'pause.hint': '按 Esc 继续',

    'result.winTitle': '舰船已肃清',
    'result.loseTitle': '舰体失守',
    'result.wave': '通关波次',
    'result.kills': '击杀数',
    'result.best': '最佳波次',
    'result.newRecord': '新纪录',
    'result.hint': '按 R 键再次出击',

    'tut.title': '首次出击',
    'tut.1': '用 WASD / 摇杆移动',
    'tut.2': '按住 J 开火',
    'tut.3': '击毁一个敌人',
    'tut.4': '按 L 相位同步',
    'tut.step': '步骤 {n}/{total}',

    'card.title': '选择一项强化',
    'card.rule': '规则',
    'card.stat': '数值',
    'card.twinCore': '光核复制攻击变为 2 发',
    'card.echoStrike': '相位同步留下爆炸残影',
    'card.overloadSpike': '超载解锁阈值提升到 45%',
    'card.coldCore': '光核离线时间减半',
    'card.pierce': '子弹穿透一个额外敌人',
    'card.ricochet': '子弹命中后弹向最近敌人',
    'card.armorRegen': '受击后 2 秒开始回装甲',
    'card.killHeal': '击杀回复 2 点装甲',
    'card.rapidFire': '射速 +18%',
    'card.bigMag': '子弹伤害 +30%',
    'card.movespeed': '移速 +16%',
    'card.bulk': '最大护甲值 +25，立即回复 25',

    'hint.overload.no': '超载需要血量 < 30% 且光核在线',
    'hint.sync.no': '相位同步需要光核在线',
  },
};
