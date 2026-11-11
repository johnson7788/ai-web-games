// 全部文案（扁平 key）。zh 为主，en 对照。
// 规则：任何界面上出现的字都必须走 t(key)，不要在代码里写死中文/英文。
export const LOCALES = {
  zh: {
    title: 'LAST LINE', subtitle: '最后一笔',
    tagline: '墨干了，世界开始消失。',
    loading: '正在研墨',
    play: '落笔', newRun: '新的一幅', continue: '继续', gallery: '画册', settings: '设置', howto: '怎么玩',
    bestScore: '最高分 {score}', actProgress: '第 {act} 幕 · {name}',
    on: '开', off: '关', back: '返回', skip: '跳过', tap: '点击继续', close: '关闭',

    'ctrl.move': 'A / D 移动', 'ctrl.aim': '鼠标瞄准', 'ctrl.fire': '左键射击',
    'ctrl.jump': '空格 跳跃', 'ctrl.dash': 'Shift 冲刺', 'ctrl.melee': '右键 笔锋', 'ctrl.reload': 'R 换墨',
    'ctrl.pause': 'Esc 暂停', 'ctrl.weapons': '1 / 2 / 3 换笔',
    'ctrl.line1': '后坐力会推开你 —— 在空中连射就能飞。',
    'ctrl.line2': '墨就是你的血。击杀敌人，把墨吸回来。',

    'hud.ink': '墨', 'hud.wave': '第 {n} 笔', 'hud.act': '第 {n} 幕', 'hud.score': '分',
    'hud.combo': '{n} 连击', 'hud.reload': '换墨', 'hud.boss': '空白', 'hud.objective': '把这一笔画完',

    'act.label': '第 {n} 幕', 'act.enter': '落笔',
    'act.draft.name': '草稿', 'act.draft.sub': '一切从这里起草。',
    'act.draft.quote': '起稿的时候，我总是画得太轻。',
    'act.blueprint.name': '蓝图', 'act.blueprint.sub': '有人想把这座城改成图纸。',
    'act.blueprint.quote': '我画过一座桥。后来忘了它通向哪里。',
    'act.neon.name': '霓虹', 'act.neon.sub': '湿墨在夜里发光。',
    'act.neon.quote': '夜里睡不着，我就把灯一盏一盏点上。',
    'act.wash.name': '水墨', 'act.wash.sub': '旧画正在褪色。',
    'act.wash.quote': '这幅画太旧了。可我还是舍不得洗笔。',
    'act.blank.name': '留白', 'act.blank.sub': '画布尽头，什么都没有。',
    'act.blank.quote': '如果我不再落笔，你会恨我吗？',
    'act.clear': '这一幕画完了', 'act.clearSub': '纸还有空。', 'act.continue': '下一笔',

    'story.intro.1': '这座城是画出来的。每一条线，都是一个人的命。',
    'story.intro.2': '画画的人停了笔。墨一天天干下去，没画完的东西，开始被擦掉。',
    'story.intro.3': '而你是他最后落下的一笔 —— 因为还没画完，所以还没被擦掉。',
    'story.intro.4': '去吸干那些干掉的墨。活下去，把自己画完。',

    'boss.name': '空白', 'boss.phase1': '它开始擦了。', 'boss.phase2': '纸要破了。', 'boss.phase3': '最后一笔。',
    'boss.defeat': '空白被画上了。',

    'upgrade.title': '补一笔', 'upgrade.sub': '选一种画法，继续。', 'upgrade.pick': '就是它',

    'up.quickdraw.name': '速写', 'up.quickdraw.desc': '射速 +14%。',
    'up.heavyink.name': '浓墨', 'up.heavyink.desc': '墨上限 +25，并立刻回满。',
    'up.scavenger.name': '拾墨', 'up.scavenger.desc': '每次击杀多回收 6 点墨。',
    'up.recoilmaster.name': '轻功', 'up.recoilmaster.desc': '后坐力 +35%；空中开火不再下坠。',
    'up.twin.name': '双管', 'up.twin.desc': '每次射击多 1 发弹丸，散布略增。',
    'up.pierce.name': '穿墨', 'up.pierce.desc': '子弹多穿透 1 个目标。',
    'up.splash.name': '溅墨', 'up.splash.desc': '命中时产生小范围溅射。',
    'up.dashcharge.name': '疾风', 'up.dashcharge.desc': '冲刺多 1 次充能。',
    'up.silentstep.name': '静默', 'up.silentstep.desc': '冲刺消耗的墨 -50%。',
    'up.brushwork.name': '笔锋', 'up.brushwork.desc': '近战伤害 +60%，范围略增。',
    'up.magnet.name': '吸墨', 'up.magnet.desc': '墨滴吸取范围大增，回收量 +20%。',
    'up.laststroke.name': '血性', 'up.laststroke.desc': '墨低于 30% 时伤害 +40%。',
    'up.comboink.name': '连击', 'up.comboink.desc': '连击加成也会提升回收的墨。',
    'up.regen.name': '续笔', 'up.regen.desc': '墨恢复速度 +80%。',
    'up.thickline.name': '重线', 'up.thickline.desc': '子弹伤害 +20%，弹速略降。',
    'up.finalcut.name': '定稿', 'up.finalcut.desc': '每一幕开始多 1 次免死。',

    'weapon.pencil': '铅笔', 'weapon.brush': '毛笔', 'weapon.nib': '针管笔',
    'weapon.pencil.desc': '精准 · 轻后坐力', 'weapon.brush.desc': '散射 · 巨大后坐力', 'weapon.nib.desc': '高速 · 穿透',
    'weapon.pickup': '拾得 {name}',

    'enemy.scribble': '墨渣', 'enemy.nib': '断笔', 'enemy.compass': '圆规', 'enemy.smudge': '涂抹', 'enemy.eraser': '橡皮', 'enemy.blank': '空白',

    'pause.title': '暂停', 'pause.resume': '继续画', 'pause.restart': '重新落笔', 'pause.settings': '设置', 'pause.quit': '回到标题',
    'settings.title': '设置', 'settings.music': '音乐', 'settings.sfx': '音效', 'settings.shake': '画面震动',
    'settings.lang': '语言', 'settings.quality': '画质', 'settings.high': '高', 'settings.low': '低',
    'settings.reset': '清除进度', 'settings.resetConfirm': '确定清除所有进度？', 'settings.back': '返回',
    'settings.credits': 'ragdoll 火柴人技法致敬 xienaoban 的公开 DEMO（2019）；本作全部重写。',

    'gallery.title': '画册', 'gallery.sub': '你在纸缝里拾到的东西。', 'gallery.locked': '还没拾到',
    'gallery.count': '{got} / {all}',
    'lore.1': '第 3 稿。咖啡比我先睡着。',
    'lore.2': '这一页被撕掉了，只剩边角一句：「别把她画哭。」',
    'lore.3': '橡皮屑堆在桌角，像一场很小很小的雪。',
    'lore.4': '蓝图纸背面有一行铅笔字：「如果我再画一次，会画得慢一点。」',
    'lore.5': '灯管坏了一半，剩下的一半还在替这座城呼吸。',
    'lore.6': '笔尖分叉了。他还是用它画完了最后一道线。',
    'lore.7': '印章上是他的名字。被水泡过，看不清了。',
    'lore.8': '纸的背面什么都没有。这是最温柔的一件事。',

    'dead.title': '被擦掉了', 'dead.sub': '墨干了。',
    'dead.retry': '再画一次', 'dead.quit': '回到标题',
    'dead.tip.1': '冲刺有无敌帧，穿过去比硬躲稳。',
    'dead.tip.2': '毛笔的后坐力能把你推上高台。',
    'dead.tip.3': '右键笔锋可以打掉敌人的子弹。',
    'dead.tip.4': '连击越高，回收的墨越多。',
    'dead.tip.5': '站在墨池里会减速，也会掉墨。',

    'result.score': '得分', 'result.kills': '击杀', 'result.time': '用时', 'result.best': '最高分',
    'result.bestShort': '最佳', 'result.newBest': '新纪录', 'result.wave': '进度', 'result.rank': '评价',
    'result.again': '再画一幅', 'result.title': '画完了', 'result.sub': '这一幅，还算像样。',

    'ending.choice': '最后一笔，落，还是不落？',
    'ending.finish.btn': '把自己画完', 'ending.blank.btn': '给世界留白',
    'ending.finish.title': '画完', 'ending.finish.text': '你把自己描完了。第二天早上，纸上多了一座城 —— 和一支笔。',
    'ending.blank.title': '留白', 'ending.blank.text': '你松开了最后一根线。纸白了，但有一道很淡的痕还在 —— 像下一笔的起手。',
    'ending.again': '再画一幅', 'ending.gallery': '看看画册',

    'hint.move': 'A / D 移动 · 空格跳跃', 'hint.fire': '鼠标瞄准 · 左键射击',
    'hint.dash': 'Shift 冲刺（耗墨）', 'hint.melee': '右键 笔锋，能打掉子弹',
    'hint.recoil': '后坐力会推开你 —— 空中连射就能飞', 'hint.ink': '墨就是你的命',
    'hint.story': '这一笔画得不错。', 'hint.clear': '这一笔，画完了。',
    'hint.touch.move': '左摇杆移动 · 右下按钮射击', 'hint.touch.aim': '自动瞄准最近的敌人', 'hint.touch.buttons': '跳 / 冲 / 锋 都在右手边',

    'touch.fire': '射', 'touch.jump': '跳', 'touch.dash': '冲', 'touch.melee': '锋', 'touch.reload': '换',

    'rotate.title': '横过来，纸才够大', 'rotate.sub': '这个游戏横屏更好画。', 'rotate.continue': '就这样玩',

    'wave.clear': '这一笔，画完了', 'wave.bonus': '收笔 +{n} 墨',
    'combo.label': '×{n}',

    'load.tip.1': '墨就是你的血。', 'load.tip.2': '后坐力也是一种飞行方式。', 'load.tip.3': '这一笔，还没画完。',

    'err.webgl': '这个浏览器没有打开画布。请换一个浏览器，或开启硬件加速。',
  },

  en: {
    title: 'LAST LINE', subtitle: 'The ink is running out',
    tagline: 'The ink is drying. The world is coming undone.',
    loading: 'GRINDING INK',
    play: 'DRAW', newRun: 'NEW PIECE', continue: 'CONTINUE', gallery: 'SKETCHBOOK', settings: 'SETTINGS', howto: 'HOW TO PLAY',
    bestScore: 'BEST {score}', actProgress: 'ACT {act} · {name}',
    on: 'ON', off: 'OFF', back: 'BACK', skip: 'SKIP', tap: 'TAP TO CONTINUE', close: 'CLOSE',

    'ctrl.move': 'A / D  MOVE', 'ctrl.aim': 'MOUSE  AIM', 'ctrl.fire': 'LMB  SHOOT',
    'ctrl.jump': 'SPACE  JUMP', 'ctrl.dash': 'SHIFT  DASH', 'ctrl.melee': 'RMB  NIB STRIKE', 'ctrl.reload': 'R  RELOAD',
    'ctrl.pause': 'ESC  PAUSE', 'ctrl.weapons': '1 / 2 / 3  SWITCH',
    'ctrl.line1': 'Recoil pushes you. Keep firing mid-air and you can fly.',
    'ctrl.line2': 'Ink is your blood. Kill to take it back.',

    'hud.ink': 'INK', 'hud.wave': 'STROKE {n}', 'hud.act': 'ACT {n}', 'hud.score': 'SCORE',
    'hud.combo': '×{n} CHAIN', 'hud.reload': 'RELOAD', 'hud.boss': 'THE BLANK', 'hud.objective': 'FINISH THE STROKE',

    'act.label': 'ACT {n}', 'act.enter': 'BEGIN',
    'act.draft.name': 'DRAFT', 'act.draft.sub': 'Everything starts as a rough sketch.',
    'act.draft.quote': 'When I draft, I always draw too lightly.',
    'act.blueprint.name': 'BLUEPRINT', 'act.blueprint.sub': 'Someone is turning the city into a plan.',
    'act.blueprint.quote': 'I drew a bridge once. I forgot where it led.',
    'act.neon.name': 'NEON', 'act.neon.sub': 'Wet ink glows at night.',
    'act.neon.quote': 'I could not sleep, so I lit the lamps one by one.',
    'act.wash.name': 'WASH', 'act.wash.sub': 'The old painting is fading.',
    'act.wash.quote': 'This painting is too old. Still, I cannot bring myself to wash the brush.',
    'act.blank.name': 'BLANK', 'act.blank.sub': 'At the edge of the canvas, nothing.',
    'act.blank.quote': 'If I never draw again, will you hate me?',
    'act.clear': 'STROKE FINISHED', 'act.clearSub': 'The paper still has room.', 'act.continue': 'NEXT STROKE',

    'story.intro.1': 'This city was drawn. Every line is somebody\'s life.',
    'story.intro.2': 'The artist stopped. As the ink dried, the unfinished things began to be erased.',
    'story.intro.3': 'You are the last stroke he laid down. Unfinished, so not yet erased.',
    'story.intro.4': 'Drink the dried ink. Stay alive. Finish yourself.',

    'boss.name': 'THE BLANK', 'boss.phase1': 'It is erasing.', 'boss.phase2': 'The paper is tearing.', 'boss.phase3': 'The last stroke.',
    'boss.defeat': 'THE BLANK has been inked in.',

    'upgrade.title': 'ONE MORE STROKE', 'upgrade.sub': 'Pick a way to draw. Keep going.', 'upgrade.pick': 'THIS ONE',

    'up.quickdraw.name': 'QUICK SKETCH', 'up.quickdraw.desc': 'Fire rate +14%.',
    'up.heavyink.name': 'THICK INK', 'up.heavyink.desc': '+25 max ink, refilled now.',
    'up.scavenger.name': 'SCAVENGER', 'up.scavenger.desc': '+6 ink per kill.',
    'up.recoilmaster.name': 'LIGHT STEP', 'up.recoilmaster.desc': 'Recoil +35%; firing in air no longer pulls you down.',
    'up.twin.name': 'TWIN BARREL', 'up.twin.desc': '+1 pellet per shot, slightly wider spread.',
    'up.pierce.name': 'PIERCE', 'up.pierce.desc': 'Bullets pierce 1 more target.',
    'up.splash.name': 'SPLATTER', 'up.splash.desc': 'Hits splash in a small radius.',
    'up.dashcharge.name': 'GALE', 'up.dashcharge.desc': '+1 dash charge.',
    'up.silentstep.name': 'SILENT STEP', 'up.silentstep.desc': 'Dash costs 50% less ink.',
    'up.brushwork.name': 'NIB STRIKE', 'up.brushwork.desc': 'Melee damage +60%, slightly longer reach.',
    'up.magnet.name': 'INK DRAW', 'up.magnet.desc': 'Much bigger pickup radius, +20% ink.',
    'up.laststroke.name': 'LAST STROKE', 'up.laststroke.desc': '+40% damage below 30% ink.',
    'up.comboink.name': 'CHAIN', 'up.comboink.desc': 'Chain bonus also boosts ink gain.',
    'up.regen.name': 'REDRAW', 'up.regen.desc': 'Ink regen +80%.',
    'up.thickline.name': 'HEAVY LINE', 'up.thickline.desc': '+20% bullet damage, slightly slower.',
    'up.finalcut.name': 'FINAL CUT', 'up.finalcut.desc': '+1 extra life at the start of each act.',

    'weapon.pencil': 'PENCIL', 'weapon.brush': 'BRUSH', 'weapon.nib': 'NEEDLE PEN',
    'weapon.pencil.desc': 'Precise · light recoil', 'weapon.brush.desc': 'Spread · massive recoil', 'weapon.nib.desc': 'Fast · piercing',
    'weapon.pickup': 'PICKED UP {name}',

    'enemy.scribble': 'SCRIBBLE', 'enemy.nib': 'BROKEN NIB', 'enemy.compass': 'COMPASS', 'enemy.smudge': 'SMUDGE', 'enemy.eraser': 'ERASER', 'enemy.blank': 'THE BLANK',

    'pause.title': 'PAUSED', 'pause.resume': 'KEEP DRAWING', 'pause.restart': 'START OVER', 'pause.settings': 'SETTINGS', 'pause.quit': 'TITLE',
    'settings.title': 'SETTINGS', 'settings.music': 'MUSIC', 'settings.sfx': 'SFX', 'settings.shake': 'SCREEN SHAKE',
    'settings.lang': 'LANGUAGE', 'settings.quality': 'QUALITY', 'settings.high': 'HIGH', 'settings.low': 'LOW',
    'settings.reset': 'CLEAR PROGRESS', 'settings.resetConfirm': 'Erase all progress?', 'settings.back': 'BACK',
    'settings.credits': 'Stickman ragdoll technique inspired by xienaoban\'s public 2019 demo. Fully rewritten.',

    'gallery.title': 'SKETCHBOOK', 'gallery.sub': 'Things you found between the pages.', 'gallery.locked': 'NOT FOUND',
    'gallery.count': '{got} / {all}',
    'lore.1': 'Draft no. 3. The coffee fell asleep before I did.',
    'lore.2': 'This page was torn out. Only the corner survived: "Don\'t draw her crying."',
    'lore.3': 'Eraser crumbs piled up in the corner, like a very small snow.',
    'lore.4': 'On the back of the blueprint, in pencil: "If I draw it again, I will draw slower."',
    'lore.5': 'Half the tube was dead. The other half kept breathing for the city.',
    'lore.6': 'The nib split. He finished the last line with it anyway.',
    'lore.7': 'The seal carries his name. Water got to it. It is unreadable now.',
    'lore.8': 'There is nothing on the back of the paper. That is the kindest thing.',

    'dead.title': 'ERASED', 'dead.sub': 'The ink ran dry.',
    'dead.retry': 'DRAW AGAIN', 'dead.quit': 'TITLE',
    'dead.tip.1': 'Dash has i-frames. Passing through beats dodging.',
    'dead.tip.2': 'The brush recoil can launch you onto high ledges.',
    'dead.tip.3': 'Nib strike deflects enemy bullets.',
    'dead.tip.4': 'Higher chains mean more ink back.',
    'dead.tip.5': 'Ink pools slow you down and drink your ink.',

    'result.score': 'SCORE', 'result.kills': 'KILLS', 'result.time': 'TIME', 'result.best': 'BEST',
    'result.bestShort': 'BEST', 'result.newBest': 'NEW BEST', 'result.wave': 'PROGRESS', 'result.rank': 'RANK',
    'result.again': 'DRAW AGAIN', 'result.title': 'FINISHED', 'result.sub': 'Not bad, for a last stroke.',

    'ending.choice': 'One last stroke. Lay it down, or not?',
    'ending.finish.btn': 'FINISH YOURSELF', 'ending.blank.btn': 'LEAVE IT BLANK',
    'ending.finish.title': 'FINISHED', 'ending.finish.text': 'You inked yourself in. Next morning, the paper held a city — and a brush.',
    'ending.blank.title': 'BLANK', 'ending.blank.text': 'You let go of the last line. The paper went white, but a faint trace remained — like the start of a next stroke.',
    'ending.again': 'DRAW AGAIN', 'ending.gallery': 'SKETCHBOOK',

    'hint.move': 'A / D MOVE · SPACE JUMP', 'hint.fire': 'MOUSE AIM · LMB SHOOT',
    'hint.dash': 'SHIFT DASH (COSTS INK)', 'hint.melee': 'RMB NIB STRIKE · DEFLECTS BULLETS',
    'hint.recoil': 'RECOIL PUSHES YOU — FLY WITH AIR SHOTS', 'hint.ink': 'INK IS YOUR LIFE',
    'hint.story': 'A good stroke.', 'hint.clear': 'This stroke is done.',
    'hint.touch.move': 'LEFT STICK TO MOVE · BUTTONS TO FIRE', 'hint.touch.aim': 'AUTO-AIM AT THE NEAREST INK', 'hint.touch.buttons': 'JUMP / DASH / NIB ON THE RIGHT',

    'touch.fire': 'FIRE', 'touch.jump': 'JUMP', 'touch.dash': 'DASH', 'touch.melee': 'NIB', 'touch.reload': 'RLD',

    'rotate.title': 'TURN THE PAGE', 'rotate.sub': 'This game draws better in landscape.', 'rotate.continue': 'PLAY ANYWAY',

    'wave.clear': 'STROKE FINISHED', 'wave.bonus': 'INK +{n}',
    'combo.label': '×{n}',

    'load.tip.1': 'Ink is your blood.', 'load.tip.2': 'Recoil is also a way to fly.', 'load.tip.3': 'This stroke is not finished.',

    'err.webgl': 'This browser could not open the canvas. Try another browser or enable hardware acceleration.',
  },
};

export default LOCALES;
