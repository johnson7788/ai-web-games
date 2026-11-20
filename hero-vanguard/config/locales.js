// 国际化文案：en 默认，zh 必做；本作只暴露 en/zh（ja/ko/ar/ru 已整块删除）。
// UI 侧只允许 t(key) 取文案；key 必须与 en 完全一致、无空值。
export const locales = {
  en: {
    // 标题屏
    'title.logo': 'HERO VANGUARD',
    'title.tagline': 'Command two heroes. Hold the station line.',
    'title.best': 'Best wave {wave}',

    // 按钮
    'btn.start': 'Deploy',
    'btn.how': 'How to play',
    'btn.settings': 'Settings',
    'btn.resume': 'Resume',
    'btn.share': 'Share',
    'btn.restart': 'Redeploy',
    'btn.skip': 'Skip',
    'btn.back': 'Back',
    'btn.choose': 'Choose',

    // 设置
    'set.title': 'Settings',
    'set.language': 'Language',
    'set.loading': 'Deploying…',
    'set.rotate': 'Rotate for the best view',
    'set.back': 'Back',

    // HUD
    'hud.wave': 'Wave',
    'hud.base': 'Base',
    'hud.gold': 'Gold',
    'hud.shield': 'Shield',
    'hud.best': 'Best',
    'hud.swap': 'Swap',
    'hud.resonance': 'Resonance',
    'hud.shieldSkill': 'Charge',

    // 英雄名 / 技能
    'hero.blade': 'Blade',
    'hero.bow': 'Bow',
    'skill.resonance': 'Resonance Slash',
    'skill.shield': 'Shield Charge',
    'skill.swap': 'Resonance Swap',

    // 场景
    'scene.orbit': 'Near Orbit',
    'scene.asteroid': 'Asteroid Belt',
    'scene.deep': 'Deep Space',

    // 敌人
    'enemy.swarm': 'Swarm',
    'enemy.armored': 'Armored',
    'enemy.kamikaze': 'Kamikaze',
    'enemy.shield': 'Shield',
    'enemy.boss': 'Boss',

    // 暂停
    'pause.title': 'Paused',
    'pause.hint': 'Press Esc to resume',

    // 升级
    'upgrade.title': 'Choose an upgrade',
    'upgrade.waveCleared': 'Wave {wave} cleared',
    'upgrade.hint': 'Pick 1 of 3',

    // 升级项
    'up.bladeAtk': '+55% Blade attack',
    'up.bowAtk': '+55% Bow attack',
    'up.atkSpeed': '+22% attack speed',
    'up.baseMax': '+30 base durability',
    'up.heroSpeed': '+18% move speed',
    'up.resonanceRange': 'Resonance radius +50%',
    'up.swapDamage': 'Swap damage ×2',
    'up.shieldLink': 'Charge heals base 1/s',
    'up.vampiric': 'Kills heal base 1',
    'up.chainBow': 'Bow pierces +1 enemy',
    'up.twinLink': 'Twin link: +30% atk speed when near',

    // 结算
    'result.win.title': 'Station Secured',
    'result.lose.title': 'Station Lost',
    'result.wave': 'Waves held',
    'result.kills': 'Kills',
    'result.best': 'Best wave',
    'result.newRecord': 'NEW RECORD',
    'result.hint': 'Press R to redeploy',
    'result.winHint': 'All 12 waves cleared!',

    // 首次交互引导
    'tut.title': 'First deployment',
    'tut.1': 'Move your hero (WASD / joystick)',
    'tut.2': 'Your hero defeats 1 enemy',
    'tut.3': 'Press J to unleash Resonance Slash',
    'tut.step': 'Step {n}/{total}',
  },
  zh: {
    // 标题屏
    'title.logo': '英雄前哨',
    'title.tagline': '指挥双子英雄，守住轨道站防线。',
    'title.best': '最高波次 {wave}',

    // 按钮
    'btn.start': '部署',
    'btn.how': '怎么玩',
    'btn.settings': '设置',
    'btn.resume': '继续',
    'btn.share': '分享',
    'btn.restart': '重新部署',
    'btn.skip': '跳过',
    'btn.back': '返回',
    'btn.choose': '选择',

    // 设置
    'set.title': '设置',
    'set.language': '语言',
    'set.loading': '部署中…',
    'set.rotate': '旋转设备获得最佳体验',
    'set.back': '返回',

    // HUD
    'hud.wave': '波次',
    'hud.base': '基地',
    'hud.gold': '金币',
    'hud.shield': '护盾',
    'hud.best': '最佳',
    'hud.swap': '换位',
    'hud.resonance': '共鸣斩',
    'hud.shieldSkill': '充能',

    // 英雄名 / 技能
    'hero.blade': '刃',
    'hero.bow': '弓',
    'skill.resonance': '共鸣斩',
    'skill.shield': '护盾充能',
    'skill.swap': '换位共鸣',

    // 场景
    'scene.orbit': '近轨',
    'scene.asteroid': '小行星带',
    'scene.deep': '深空',

    // 敌人
    'enemy.swarm': '蜂群',
    'enemy.armored': '重甲',
    'enemy.kamikaze': '自爆',
    'enemy.shield': '护盾兵',
    'enemy.boss': 'Boss',

    // 暂停
    'pause.title': '已暂停',
    'pause.hint': '按 Esc 继续',

    // 升级
    'upgrade.title': '选择一项升级',
    'upgrade.waveCleared': '第 {wave} 波已清',
    'upgrade.hint': '三选一',

    // 升级项
    'up.bladeAtk': '刃攻击 +55%',
    'up.bowAtk': '弓攻击 +55%',
    'up.atkSpeed': '攻速 +22%',
    'up.baseMax': '基地耐久 +30',
    'up.heroSpeed': '移速 +18%',
    'up.resonanceRange': '共鸣斩范围 +50%',
    'up.swapDamage': '换位伤害翻倍',
    'up.shieldLink': '充能每秒回 1 基地耐久',
    'up.vampiric': '击杀回复 1 基地耐久',
    'up.chainBow': '弓再穿透 1 个敌人',
    'up.twinLink': '双子共鸣：靠近时攻速 +30%',

    // 结算
    'result.win.title': '防线守住',
    'result.lose.title': '防线失守',
    'result.wave': '坚守波次',
    'result.kills': '击杀',
    'result.best': '最高波次',
    'result.newRecord': '新纪录',
    'result.hint': '按 R 重新部署',
    'result.winHint': '12 波全部清空！',

    // 首次交互引导
    'tut.title': '首次部署',
    'tut.1': '移动你的英雄（WASD / 摇杆）',
    'tut.2': '你的英雄击败 1 个敌人',
    'tut.3': '按 J 释放共鸣斩',
    'tut.step': '步骤 {n}/{total}',
  },
};
