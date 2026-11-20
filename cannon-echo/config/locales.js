// 国际化文案：en 默认，zh 必做；本作只暴露 en/zh。
// UI 侧只允许 t(key) 取文案；key 必须与 en 完全一致、无空值。
export const locales = {
  en: {
    // 标题屏
    'title.logo': 'CANNON ECHO',
    'title.tagline': 'Aim your echo cannon. Bounce shots off the canyon walls. Break every crate before they reach the fortress.',
    'title.best': 'Best score {score}',

    // 按钮
    'btn.start': 'Start',
    'btn.how': 'How to play',
    'btn.settings': 'Settings',
    'btn.resume': 'Resume',
    'btn.share': 'Share',
    'btn.restart': 'Play again',
    'btn.skip': 'Skip',
    'btn.close': 'Close',

    // 设置
    'set.title': 'Settings',
    'set.language': 'Language',
    'set.loading': 'Charging the cannon…',
    'set.rotate': 'Rotate for the best view',
    'set.back': 'Back',

    // HUD
    'hud.score': 'Score',
    'hud.wave': 'Wave',
    'hud.hp': 'Fortress',
    'hud.heat': 'Heat',
    'hud.level': 'Cannon',
    'hud.overheat': 'OVERHEATED',

    // 场景
    'scene.0': 'Morning Valley',
    'scene.1': 'Snow Pass',
    'scene.2': 'Lava Gorge',
    'scene.boss': 'The Great Crate',

    // 波次新元素（12 关推进）
    'wave.1': 'Slow floating crates',
    'wave.2': 'Dive clusters',
    'wave.3': 'Supply crates behind cover — bounce to hit',
    'wave.4': 'Armored crates need echo hits',
    'wave.5': 'Cover + armor mix',
    'wave.6': 'Snow dive swarm',
    'wave.7': 'Armored pair',
    'wave.8': 'Cover + dive rush',
    'wave.9': 'Full mix',
    'wave.10': 'Heavy armor line',
    'wave.11': 'Final swarm',
    'wave.12': 'The Great Crate boss',

    // 升级
    'upgrade.title': 'Choose an upgrade',
    'upgrade.ricochet.name': 'Ricochet',
    'upgrade.ricochet.desc': 'Shots bounce once more, softer decay',
    'upgrade.pierce.name': 'Pierce',
    'upgrade.pierce.desc': 'Shots pierce one target',
    'upgrade.echoChain.name': 'Echo Chain',
    'upgrade.echoChain.desc': 'Echo hits spark a seeking bolt',
    'upgrade.heatVent.name': 'Heat Vent',
    'upgrade.heatVent.desc': 'Overheat bursts a 3-way shot and vents',
    'upgrade.frost.name': 'Frost Tip',
    'upgrade.frost.desc': 'Direct hits slow targets',
    'upgrade.bossBuster.name': 'Boss Buster',
    'upgrade.bossBuster.desc': 'Echo hits crush armor and bosses',
    'upgrade.power.name': 'Power',
    'upgrade.power.desc': '+45% damage',
    'upgrade.rate.name': 'Rapid Fire',
    'upgrade.rate.desc': '+35% fire rate',
    'upgrade.coolant.name': 'Coolant',
    'upgrade.coolant.desc': '+45% cooling',
    'upgrade.velocity.name': 'Velocity',
    'upgrade.velocity.desc': '+30% shot speed',

    // 暂停
    'pause.title': 'Paused',
    'pause.hint': 'Press Esc to resume',

    // 结算
    'result.title': 'Fortress Lost',
    'result.winTitle': 'Valley Secured',
    'result.score': 'Score',
    'result.wave': 'Waves cleared',
    'result.best': 'Best score',
    'result.newRecord': 'NEW RECORD',
    'result.hint': 'Press R to play again',
    'result.bestScore': 'Best',

    // 首次交互引导
    'tut.title': 'First volley',
    'tut.1': 'Move to aim the cannon',
    'tut.2': 'Hold to fire',
    'tut.3': 'Break a crate',
    'tut.step': 'Step {n}/{total}',

    // Boss
    'boss.name': 'The Great Crate',
  },
  zh: {
    // 标题屏
    'title.logo': 'CANNON ECHO',
    'title.tagline': '瞄准回声炮台，让炮弹在崖壁间反弹，击碎所有逼近要塞的货箱。',
    'title.best': '最高分 {score}',

    // 按钮
    'btn.start': '开始',
    'btn.how': '怎么玩',
    'btn.settings': '设置',
    'btn.resume': '继续',
    'btn.share': '分享',
    'btn.restart': '再玩一局',
    'btn.skip': '跳过',
    'btn.close': '关闭',

    // 设置
    'set.title': '设置',
    'set.language': '语言',
    'set.loading': '炮台充能中…',
    'set.rotate': '旋转设备获得最佳体验',
    'set.back': '返回',

    // HUD
    'hud.score': '得分',
    'hud.wave': '波次',
    'hud.hp': '要塞',
    'hud.heat': '热量',
    'hud.level': '炮台',
    'hud.overheat': '过热锁定',

    // 场景
    'scene.0': '晨谷',
    'scene.1': '雪隘',
    'scene.2': '熔峡',
    'scene.boss': '巨型货箱',

    // 波次新元素（12 关推进）
    'wave.1': '慢速浮空箱',
    'wave.2': '俯冲集群',
    'wave.3': '掩体后补给箱——用反弹打',
    'wave.4': '装甲箱需要回声连击',
    'wave.5': '掩体 + 装甲混编',
    'wave.6': '雪原俯冲群',
    'wave.7': '装甲双箱',
    'wave.8': '掩体 + 俯冲突进',
    'wave.9': '全类型混编',
    'wave.10': '重型装甲线',
    'wave.11': '最终群袭',
    'wave.12': '巨型货箱 Boss',

    // 升级
    'upgrade.title': '选择一项升级',
    'upgrade.ricochet.name': '跳弹',
    'upgrade.ricochet.desc': '炮弹多反弹一次，衰减更缓',
    'upgrade.pierce.name': '穿透',
    'upgrade.pierce.desc': '炮弹穿透一个目标',
    'upgrade.echoChain.name': '回声链',
    'upgrade.echoChain.desc': '回声命中溅射一枚追踪小弹',
    'upgrade.heatVent.name': '泄压阀',
    'upgrade.heatVent.desc': '过热瞬间爆发三向散弹并泄压',
    'upgrade.frost.name': '霜冻弹头',
    'upgrade.frost.desc': '直射击中减速目标',
    'upgrade.bossBuster.name': '破甲弹',
    'upgrade.bossBuster.desc': '回声弹对装甲与 Boss 伤害更高',
    'upgrade.power.name': '威力',
    'upgrade.power.desc': '伤害 +45%',
    'upgrade.rate.name': '急速射击',
    'upgrade.rate.desc': '射速 +35%',
    'upgrade.coolant.name': '冷却液',
    'upgrade.coolant.desc': '冷却 +45%',
    'upgrade.velocity.name': '高速弹',
    'upgrade.velocity.desc': '弹速 +30%',

    // 暂停
    'pause.title': '已暂停',
    'pause.hint': '按 Esc 继续',

    // 结算
    'result.title': '要塞失守',
    'result.winTitle': '山谷守住了',
    'result.score': '得分',
    'result.wave': '通关波次',
    'result.best': '最高分',
    'result.newRecord': '新纪录',
    'result.hint': '按 R 键再玩一局',
    'result.bestScore': '最佳',

    // 首次交互引导
    'tut.title': '初次齐射',
    'tut.1': '移动来瞄准炮台',
    'tut.2': '按住发射',
    'tut.3': '击碎一个货箱',
    'tut.step': '步骤 {n}/{total}',

    // Boss
    'boss.name': '巨型货箱',
  },
};
