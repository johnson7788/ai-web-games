// 国际化文案：en 默认，zh 必做；本作只暴露 en/zh（ja/ko/ar/ru 已整块删除）。
// UI 侧只允许 t(key) 取文案；key 必须与 en 完全一致、无空值。
export const locales = {
  en: {
    // 标题屏
    'title.logo': 'SWORD SAGA',
    'title.tagline': 'A turn-based wuxia tale. Strike with the five elements, defend to charge your sword.',
    'title.best': 'Chapter {chapter} of 12',
    'title.continue': 'Continue',

    // 按钮
    'btn.start': 'Begin',
    'btn.how': 'How to play',
    'btn.settings': 'Settings',
    'btn.resume': 'Resume',
    'btn.share': 'Share',
    'btn.restart': 'New journey',
    'btn.skip': 'Skip',
    'btn.close': 'Close',
    'btn.back': 'Back',
    'btn.again': 'Continue',

    // 设置
    'set.title': 'Settings',
    'set.language': 'Language',
    'set.loading': 'Entering the mists…',
    'set.rotate': 'Rotate for the best view',
    'set.back': 'Back',

    // 角色
    'hero.name': 'Yun Jian',
    'fox.name': 'Linghu',
    'hero.title': 'Sword Sage',
    'fox.title': 'Spirit Fox',

    // 五行
    'elem.metal': 'Metal',
    'elem.wood': 'Wood',
    'elem.water': 'Water',
    'elem.fire': 'Fire',
    'elem.earth': 'Earth',

    // 战斗菜单
    'battle.attack': 'Attack',
    'battle.skill': 'Skill',
    'battle.item': 'Item',
    'battle.defend': 'Defend',
    'battle.switch': 'Switch',
    'battle.guard': 'Fox Guard',
    'battle.counter': 'ELEMENT STRIKE!',
    'battle.swordIntent': 'Sword Intent ×2!',
    'battle.foxSub': 'The fox shields you!',
    'battle.foxLeave': 'The fox retreats…',
    'battle.foxReturn': 'The fox returns!',
    'battle.victory': 'Victory',

    // 技能名
    'skill.metal': 'Cloud Breaker',
    'skill.wood': 'Verdant Bind',
    'skill.water': 'Rime Lance',
    'skill.fire': 'Foxfire',
    'skill.earth': 'Stone Root',

    // 道具
    'item.herb': 'Herb',
    'item.elixir': 'Elixir',

    // 敌人
    'enemy.bambooWraith': 'Bamboo Wraith',
    'enemy.snowWhelp': 'Snow Whelp',
    'enemy.ashMite': 'Ash Mite',
    'enemy.stoneWard': 'Stone Ward',
    'enemy.metalImp': 'Metal Imp',
    'enemy.bambooKing': 'Bamboo King',
    'enemy.snowMother': 'Snow Mother',
    'enemy.towerDemon': 'Tower Demon',

    // 说话人
    'who.hero': 'Yun Jian',
    'who.fox': 'Linghu',
    'who.elder': 'Elder',
    'who.stranger': 'Wayfarer',
    'who.narrator': 'Narrator',
    'who.boss': '???',

    // HUD
    'hud.chapter': 'Chapter',
    'hud.scene': 'Realm',
    'hud.hint': 'Arrows to walk · Click to interact',

    // 场景名
    'scene.1': 'Green Bamboo Forest',
    'scene.2': 'Snow Mountain Pass',
    'scene.3': 'Spirit-Lock Tower',

    // 对话
    'dialog.next': '▼ Next',

    // 暂停
    'pause.title': 'Paused',
    'pause.hint': 'Press Esc to resume',

    // 结算
    'result.victory': 'Tale Complete',
    'result.gameover': 'The Blade Falls Silent',
    'result.chapter': 'Chapters cleared',
    'result.hint': 'Press R to begin anew',

    // 首次交互引导
    'tut.title': 'First steps on the sword path',
    'tut.1': 'Walk right toward the elder',
    'tut.2': 'Speak to the elder',
    'tut.3': 'In battle, choose Attack',
    'tut.4': 'Win your first duel',
    'tut.step': 'Step {n}/{total}',
  },
  zh: {
    // 标题屏
    'title.logo': 'SWORD SAGA',
    'title.tagline': '一段回合制武侠奇谭。以五行相克出招，防御蓄势再斩。',
    'title.best': '第 {chapter} / 12 章',
    'title.continue': '继续',

    // 按钮
    'btn.start': '开始',
    'btn.how': '怎么玩',
    'btn.settings': '设置',
    'btn.resume': '继续',
    'btn.share': '分享',
    'btn.restart': '新的旅程',
    'btn.skip': '跳过',
    'btn.close': '关闭',
    'btn.back': '返回',
    'btn.again': '继续',

    // 设置
    'set.title': '设置',
    'set.language': '语言',
    'set.loading': '踏入云雾之中…',
    'set.rotate': '旋转设备获得最佳体验',
    'set.back': '返回',

    // 角色
    'hero.name': '云隐',
    'fox.name': '灵狐',
    'hero.title': '剑客',
    'fox.title': '灵狐',

    // 五行
    'elem.metal': '金',
    'elem.wood': '木',
    'elem.water': '水',
    'elem.fire': '火',
    'elem.earth': '土',

    // 战斗菜单
    'battle.attack': '普攻',
    'battle.skill': '技能',
    'battle.item': '道具',
    'battle.defend': '防御',
    'battle.switch': '换人',
    'battle.guard': '灵狐守护',
    'battle.counter': '五行克制！',
    'battle.swordIntent': '剑意蓄势 ×2！',
    'battle.foxSub': '灵狐替你挡下致命一击！',
    'battle.foxLeave': '灵狐暂离战场…',
    'battle.foxReturn': '灵狐归来！',
    'battle.victory': '胜利',

    // 技能名
    'skill.metal': '破云剑',
    'skill.wood': '青藤缚',
    'skill.water': '凝霜枪',
    'skill.fire': '狐火',
    'skill.earth': '石根',

    // 道具
    'item.herb': '止血草',
    'item.elixir': '灵药',

    // 敌人
    'enemy.bambooWraith': '竹妖',
    'enemy.snowWhelp': '雪崽',
    'enemy.ashMite': '烬虫',
    'enemy.stoneWard': '石卫',
    'enemy.metalImp': '金妖',
    'enemy.bambooKing': '竹王',
    'enemy.snowMother': '雪母',
    'enemy.towerDemon': '塔魔',

    // 说话人
    'who.hero': '云隐',
    'who.fox': '灵狐',
    'who.elder': '长老',
    'who.stranger': '路人',
    'who.narrator': '旁白',
    'who.boss': '？？？',

    // HUD
    'hud.chapter': '章节',
    'hud.scene': '境界',
    'hud.hint': '方向键行走 · 点击交互',

    // 场景名
    'scene.1': '青竹林',
    'scene.2': '雪山道',
    'scene.3': '锁妖塔',

    // 对话
    'dialog.next': '▼ 下一句',

    // 暂停
    'pause.title': '已暂停',
    'pause.hint': '按 Esc 继续',

    // 结算
    'result.victory': '传奇落幕',
    'result.gameover': '剑已沉寂',
    'result.chapter': '已通过章节',
    'result.hint': '按 R 键重新开始',

    // 首次交互引导
    'tut.title': '踏上剑道的第一步',
    'tut.1': '向右走向长老',
    'tut.2': '与长老对话',
    'tut.3': '战斗中，选择普攻',
    'tut.4': '赢下第一场对决',
    'tut.step': '步骤 {n}/{total}',
  },
};
