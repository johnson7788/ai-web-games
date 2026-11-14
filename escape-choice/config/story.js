// 分支剧情图：节点 { id, scene, text:{en,zh}, choices:[{text:{en,zh}, next}], ending? }。
// ending='fail' 搞笑失败；ending='win' 逃脱成功（多结局）。
export const STORY = {
  start: {
    scene: 'cell',
    text: { en: 'You wake in a cold cell. The guard left his keys... almost within reach. Time to escape.', zh: '你在冰冷的牢房中醒来。狱警的钥匙……几乎就在手边。是时候越狱了。' },
    choices: [
      { text: { en: 'Pick the lock', zh: '撬开锁' }, next: 'lock' },
      { text: { en: 'Dig through the wall', zh: '挖穿墙壁' }, next: 'dig' },
      { text: { en: 'Yell for the guard', zh: '大喊叫狱警' }, next: 'yell' },
    ],
  },
  lock: {
    scene: 'corridor',
    text: { en: 'The lock clicks open. The corridor is empty — for now. Which way?', zh: '锁“咔哒”一声开了。走廊空无一人——暂时。走哪边？' },
    choices: [
      { text: { en: 'Sneak left, to the yard', zh: '向左溜去院子' }, next: 'yard' },
      { text: { en: 'Sneak right, to the roof', zh: '向右溜去屋顶' }, next: 'roof' },
      { text: { en: 'Just run straight out', zh: '直接冲出去' }, next: 'run_fail' },
    ],
  },
  dig: {
    scene: 'sewer',
    text: { en: 'You dig for hours and break into a sewer pipe. It smells terrible. Promising!', zh: '你挖了好几个小时，打通了一条下水管道。臭气熏天。有戏！' },
    choices: [
      { text: { en: 'Crawl through the pipe', zh: '爬进管道' }, next: 'tunnel' },
      { text: { en: 'Nope, go back', zh: '算了，回去' }, next: 'start' },
    ],
  },
  yell: {
    scene: 'guard',
    text: { en: 'The guard stomps over, looking annoyed. "What do you want, prisoner?"', zh: '狱警不耐烦地走过来。“干嘛，囚犯？”' },
    choices: [
      { text: { en: 'Pretend to be sick', zh: '装病' }, next: 'sick' },
      { text: { en: 'Attack the guard', zh: '袭击狱警' }, next: 'attack_fail' },
    ],
  },
  yard: {
    scene: 'yard',
    text: { en: 'The yard is fenced high. A delivery truck idles by the gate, driver nowhere in sight.', zh: '院子围着高墙。一辆送货车在门边怠速，司机不知去向。' },
    choices: [
      { text: { en: 'Hide in the truck', zh: '躲进货车' }, next: 'truck' },
      { text: { en: 'Climb the fence', zh: '翻越围栏' }, next: 'fence_fail' },
      { text: { en: 'Dig under the fence', zh: '从围栏下挖洞' }, next: 'tunnel' },
    ],
  },
  roof: {
    scene: 'roof',
    text: { en: 'On the roof: a zipline to the next building... and a very large guard dog.', zh: '屋顶上：一条滑索通往隔壁楼……还有一只非常大的警犬。' },
    choices: [
      { text: { en: 'Ride the zipline', zh: '坐滑索' }, next: 'win_zip' },
      { text: { en: 'Pet the dog', zh: '摸摸狗' }, next: 'dog_fail' },
      { text: { en: 'Jump to the next roof', zh: '跳到隔壁屋顶' }, next: 'jump_fail' },
    ],
  },
  truck: {
    scene: 'truck',
    text: { en: 'You hide among the crates. The truck rumbles toward the gate. Hold your breath...', zh: '你躲在货箱之间。货车轰隆隆驶向大门。屏住呼吸……' },
    choices: [
      { text: { en: 'Stay perfectly hidden', zh: '藏好不动' }, next: 'win_truck' },
      { text: { en: 'Peek out for a look', zh: '探头看看' }, next: 'peek_fail' },
    ],
  },
  tunnel: {
    scene: 'tunnel',
    text: { en: 'The pipe leads to the river outside the walls. Freedom smells like mud.', zh: '管道通往墙外的小河。自由的味道像泥巴。' },
    choices: [
      { text: { en: 'Swim out now', zh: '立刻游出去' }, next: 'win_tunnel' },
      { text: { en: 'Wait until dark', zh: '等到天黑' }, next: 'wait_fail' },
    ],
  },
  sick: {
    scene: 'guard',
    text: { en: '"Ugh, I think I\'m dying," you groan. The guard unlocks the cell to check on you.', zh: '“呃，我快不行了……”你呻吟道。狱警打开牢门查看你。' },
    choices: [
      { text: { en: 'Grab his keys and run', zh: '抢钥匙就跑' }, next: 'corridor2' },
      { text: { en: 'Keep pretending', zh: '继续装' }, next: 'start' },
    ],
  },
  corridor2: {
    scene: 'corridor',
    text: { en: 'You have the keys! You sprint down the corridor. Two exits ahead.', zh: '你拿到了钥匙！沿走廊狂奔。前方有两个出口。' },
    choices: [
      { text: { en: 'Take the front gate', zh: '走正门' }, next: 'gate' },
      { text: { en: 'Head for the roof', zh: '上屋顶' }, next: 'roof' },
    ],
  },
  gate: {
    scene: 'gate',
    text: { en: 'The front gate is locked — but you have the keys. This is it.', zh: '正门锁着——但你有钥匙。就是现在。' },
    choices: [
      { text: { en: 'Unlock the gate', zh: '打开大门' }, next: 'win_gate' },
      { text: { en: 'Run through the wall', zh: '穿墙而过' }, next: 'wall_fail' },
    ],
  },
  // ---- 胜利结局 ----
  win_truck: { scene: 'win', ending: 'win', text: { en: 'The truck rolls out the gate. You hop off down the road — free at last! ESCAPED (Truck).', zh: '货车驶出大门。你在路边跳下车——终于自由了！逃脱成功（货车）。' } },
  win_tunnel: { scene: 'win', ending: 'win', text: { en: 'You swim out under the walls and vanish into the night. ESCAPED (River).', zh: '你从墙下游出，消失在夜色中。逃脱成功（河流）。' } },
  win_gate: { scene: 'win', ending: 'win', text: { en: 'The gate swings open. You stroll out like you own the place. ESCAPED (Front Gate).', zh: '大门敞开。你大摇大摆地走出去，像这儿的主人。逃脱成功（正门）。' } },
  win_zip: { scene: 'win', ending: 'win', text: { en: 'You grab the zipline and zip across to the next building. The dog barks farewell. ESCAPED (Zipline).', zh: '你抓住滑索滑到隔壁楼。警犬吠叫着道别。逃脱成功（滑索）。' } },
  // ---- 搞笑失败 ----
  attack_fail: { scene: 'fail', ending: 'fail', text: { en: 'The guard is bigger than you. Much, much bigger. Back to the cell.', zh: '狱警比你壮多了。得多得多。回牢房吧。' } },
  run_fail: { scene: 'fail', ending: 'fail', text: { en: 'An alarm blares. You didn\'t even make it to the door. Smooth.', zh: '警报大作。你连门都没跑到。真行。' } },
  fence_fail: { scene: 'fail', ending: 'fail', text: { en: 'The fence is electrified. ZAP. Your hair stands on end.', zh: '围栏通电。滋啦。你的头发都竖起来了。' } },
  dog_fail: { scene: 'fail', ending: 'fail', text: { en: 'The dog is not friendly. Good boy, though. Very good boy.', zh: '这狗不友好。不过真是条好狗。非常好的狗。' } },
  jump_fail: { scene: 'fail', ending: 'fail', text: { en: 'The gap is wider than it looked. Gravity remains undefeated.', zh: '间距比看起来宽。重力依然无人能敌。' } },
  peek_fail: { scene: 'fail', ending: 'fail', text: { en: 'A guard spots you peeking. "Hey! You\'re not a crate!" Busted.', zh: '狱警发现你探头。“喂！你又不是货箱！”被抓。' } },
  wait_fail: { scene: 'fail', ending: 'fail', text: { en: 'The rats come back. They brought friends. So many friends.', zh: '老鼠回来了。还带了朋友。好多朋友。' } },
  wall_fail: { scene: 'fail', ending: 'fail', text: { en: 'It\'s a wall. You bounce off. The guards are laughing.', zh: '那是堵墙。你弹了回来。狱警们笑疯了。' } },
};

export const START_NODE = 'start';
export const WIN_NODES = Object.keys(STORY).filter((k) => STORY[k].ending === 'win');
export const FAIL_NODES = Object.keys(STORY).filter((k) => STORY[k].ending === 'fail');