// 国际化文案：en 默认，zh 必做；本作只暴露 en/zh（ja/ko/ar/ru 已整块删除）。
// UI 侧只允许 t(key) 取文案；key 必须与 en 完全一致、无空值。
export const locales = {
  en: {
    // 标题屏
    'title.logo': 'HEROES CHARGE',
    'title.tagline': 'A neon beat-em-up. Slash, dash, and chain combos through the synth city.',
    'title.best': 'Best: {stars}★',
    'title.hint': 'Arrows / A·D move · J attack · K dash · Space jump · L special',

    // 按钮
    'btn.start': 'Start',
    'btn.how': 'How to play',
    'btn.resume': 'Resume',
    'btn.restart': 'Restart',
    'btn.retry': 'Retry',
    'btn.next': 'Next level',
    'btn.home': 'Menu',
    'btn.skip': 'Skip',
    'btn.got': 'Got it',

    // 暂停
    'pause.title': 'Paused',
    'pause.hint': 'Press Esc / P to resume',

    // HUD
    'hud.enemies': 'FOES',
    'hud.level': 'LV',
    'hud.score': 'SCORE',
    'hud.combo': 'COMBO',
    'hud.dash': 'DASH',

    // 结算
    'result.victory': 'CITY LIBERATED',
    'result.gameover': 'SIGNAL LOST',
    'result.stars': 'Stars',
    'result.score': 'Score',
    'result.bestCombo': 'Best combo',
    'result.hint': 'Press R to retry',

    // 引导
    'tut.title': 'Charge protocol',
    'tut.1': 'Hold ← / → or A·D to run toward the red foes',
    'tut.2': 'Press J to slash enemies in front of you',
    'tut.3': 'Press K to dash — it costs dash energy',
    'tut.4': 'Clear every foe to free the district',
    'tut.step': 'Step {n}/{total}',

    // 竖屏
    'rotate.text': 'Rotate for the best view',
    'rotate.skip': 'Play anyway',

    // 语言
    'lang': 'Language',
  },
  zh: {
    'title.logo': 'HEROES CHARGE',
    'title.tagline': '霓虹街机横版格斗。挥剑、冲刺、连击，杀穿合成都市。',
    'title.best': '最佳：{stars}★',
    'title.hint': '方向键 / A·D 移动 · J 攻击 · K 冲刺 · 空格跳跃 · L 技能',

    'btn.start': '开始',
    'btn.how': '怎么玩',
    'btn.resume': '继续',
    'btn.restart': '重新开始',
    'btn.retry': '再来一次',
    'btn.next': '下一关',
    'btn.home': '菜单',
    'btn.skip': '跳过',
    'btn.got': '知道了',

    'pause.title': '已暂停',
    'pause.hint': '按 Esc / P 继续',

    'hud.enemies': '敌人',
    'hud.level': '关',
    'hud.score': '得分',
    'hud.combo': '连击',
    'hud.dash': '冲刺',

    'result.victory': '城市解放',
    'result.gameover': '信号中断',
    'result.stars': '星级',
    'result.score': '得分',
    'result.bestCombo': '最高连击',
    'result.hint': '按 R 重试',

    'tut.title': '出击协议',
    'tut.1': '按住 ← / → 或 A·D 朝红色敌人冲过去',
    'tut.2': '按 J 挥剑砍前方敌人',
    'tut.3': '按 K 冲刺——冲刺会消耗能量',
    'tut.4': '清光所有敌人，解放街区',
    'tut.step': '步骤 {n}/{total}',

    'rotate.text': '旋转设备获得最佳体验',
    'rotate.skip': '仍然游玩',

    'lang': '语言',
  },
};
