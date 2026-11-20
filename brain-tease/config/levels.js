// config/levels.js — 24 关整蛊机关谜题（原创）。
// 结构：goal 目标 / hint 提示 / roast 过关吐槽（en+zh），objects 可交互物，solution 解法。
// solution 项：{kind:'tap',id} | {kind:'tapN',id,count} | {kind:'shadow',id}
//              | {kind:'dragTo',id,targetId} | {kind:'dragOff',id} | {kind:'invert'}
// strict:true = 多步按序（Boss 组合关）；coveredBy = 被遮挡物盖住，拖走盖子前不可点。
// 对象：{ id, x, y(中心), w, h, glyph, label:{en,zh}, draggable?, coveredBy?, shadow?:{x,y,w,h} }
// glyph ∈ circle/rect/star/cloud/sun/moon/bottle/person/plant/bird/key/gear/card/cup/bulb/arrow

function O(id, x, y, w, h, glyph, en, zh, opts = {}) {
  return { id, x, y, w, h, glyph, label: { en, zh }, ...opts };
}

function dragTo(id, targetId) { return { kind: 'dragTo', id, targetId }; }
function dragOff(id) { return { kind: 'dragOff', id }; }
function tap(id) { return { kind: 'tap', id }; }
function tapN(id, count) { return { kind: 'tapN', id, count }; }
function shadow(id) { return { kind: 'shadow', id }; }
const invert = () => ({ kind: 'invert' });

export const LEVELS = [
  // ---------- 第 1 章 · 实验室 ----------
  {
    id: 1, chapter: 1, scene: 'lab',
    title: { en: 'The hot thermometer', zh: '发烫的温度计' },
    goal: { en: 'Cool the thermometer down in the ice water', zh: '把温度计放进冰水里降温' },
    hint: { en: 'Drag it, don\'t tap it.', zh: '拖过去，别点它。' },
    roast: { en: 'Ha! It\'s not a lollipop!', zh: '哈！这可不是棒棒糖！' },
    objects: [
      O('thermo', 380, 420, 130, 190, 'bottle', 'Thermometer', '温度计', { draggable: true }),
      O('ice', 920, 420, 200, 190, 'cup', 'Ice water', '冰水'),
    ],
    solution: [dragTo('thermo', 'ice')],
  },
  {
    id: 2, chapter: 1, scene: 'lab', strict: true,
    title: { en: 'Bulb and shadow', zh: '灯泡和影子' },
    goal: { en: 'Turn the bulb on with 3 clicks — but the 3rd click must hit its shadow', zh: '连点灯泡 3 次，但第三次要点影子' },
    hint: { en: 'Two on the bulb, one on the shadow.', zh: '灯泡点两下，影子点一下。' },
    roast: { en: 'Even light has a shadow!', zh: '光也有影子！' },
    objects: [
      O('bulb', 640, 360, 140, 150, 'bulb', 'Bulb', '灯泡', { shadow: { x: 700, y: 470, w: 130, h: 80 } }),
    ],
    solution: [tapN('bulb', 2), shadow('bulb')],
  },
  {
    id: 3, chapter: 1, scene: 'lab',
    title: { en: 'The real button', zh: '真正的按钮' },
    goal: { en: 'Find the real button hidden somewhere else', zh: '找一找藏在别处的真按钮' },
    hint: { en: 'The poster is hiding it.', zh: '海报后面藏着一个。' },
    roast: { en: 'You actually lifted the poster?', zh: '你居然真去掀海报？' },
    objects: [
      O('fake', 640, 420, 200, 120, 'rect', 'Press me', '点我'),
      O('real', 440, 560, 180, 100, 'rect', 'Real button', '真按钮', { coveredBy: 'poster' }),
      O('poster', 440, 560, 210, 130, 'rect', 'Poster', '海报', { draggable: true }),
    ],
    solution: [dragOff('poster'), tap('real')],
  },
  {
    id: 4, chapter: 1, scene: 'lab', rotate: true,
    title: { en: 'Flip it upside down', zh: '把它倒过来' },
    goal: { en: 'Flip the whole scene upside down', zh: '把整个场景倒过来' },
    hint: { en: 'Drag the rotate handle to flip the scene.', zh: '拖旋转把手把场景倒过来。' },
    roast: { en: 'Gravity is just a suggestion.', zh: '重力只是建议。' },
    objects: [
      O('screen', 560, 400, 360, 220, 'rect', 'Sand timer', '沙漏'),
      O('handle', 1040, 540, 120, 120, 'gear', 'Rotate', '旋转', { draggable: true }),
    ],
    solution: [invert()],
  },
  {
    id: 5, chapter: 1, scene: 'lab',
    title: { en: 'The begging popup', zh: '乞讨好评的弹窗' },
    goal: { en: 'Close the begging 5-star review popup', zh: '关掉这个跪求好评的弹窗' },
    hint: { en: 'It\'s just a sticker — peel it off.', zh: '它只是一张贴纸，撕掉它。' },
    roast: { en: 'Nice try, but I\'ll ask again.', zh: '想得美，我下次还问。' },
    objects: [
      O('popup', 640, 400, 460, 240, 'rect', '5 stars please', '跪求 5 星', { draggable: true }),
    ],
    solution: [dragOff('popup')],
  },
  {
    id: 6, chapter: 1, scene: 'lab', strict: true,
    title: { en: 'Wake the assistant', zh: '叫醒助手' },
    goal: { en: 'Wake the sleeping assistant', zh: '叫醒打盹的助手' },
    hint: { en: 'Alarm first, blanket off, then poke.', zh: '先响闹钟，再掀毯子，最后戳他。' },
    roast: { en: 'He sleepwalked into the coffee machine.', zh: '他梦游走进了咖啡机。' },
    objects: [
      O('alarm', 380, 340, 160, 160, 'circle', 'Alarm', '闹钟'),
      O('assistant', 880, 440, 200, 200, 'person', 'Assistant', '助手', { coveredBy: 'blanket' }),
      O('blanket', 880, 440, 240, 240, 'rect', 'Blanket', '毯子', { draggable: true }),
    ],
    solution: [tap('alarm'), dragOff('blanket'), tap('assistant')],
  },

  // ---------- 第 2 章 · 厨房 ----------
  {
    id: 7, chapter: 2, scene: 'kitchen',
    title: { en: 'Standing egg', zh: '立起来的鸡蛋' },
    goal: { en: 'Make the egg stand on its end', zh: '让鸡蛋立起来' },
    hint: { en: 'Tap it three times, not once.', zh: '点三下，别只点一下。' },
    roast: { en: 'Chicken physics 101.', zh: '母鸡物理学入门。' },
    objects: [
      O('egg', 640, 420, 150, 180, 'circle', 'Egg', '鸡蛋'),
    ],
    solution: [tapN('egg', 3)],
  },
  {
    id: 8, chapter: 2, scene: 'kitchen',
    title: { en: 'Boiling over', zh: '烧开的锅' },
    goal: { en: 'Pour the boiling pan into the sink', zh: '把烧开的锅倒进水池' },
    hint: { en: 'Drag the pan to the sink.', zh: '把锅拖到水池。' },
    roast: { en: 'That pan had a lot to say.', zh: '这锅火气真大。' },
    objects: [
      O('pan', 380, 420, 200, 160, 'cup', 'Boiling pan', '烧开的锅', { draggable: true }),
      O('sink', 920, 420, 220, 190, 'rect', 'Sink', '水池'),
    ],
    solution: [dragTo('pan', 'sink')],
  },
  {
    id: 9, chapter: 2, scene: 'kitchen',
    title: { en: 'Not a fruit', zh: '不是水果' },
    goal: { en: 'Tap the one that is NOT a fruit', zh: '点出那个不是水果的' },
    hint: { en: 'It glows and screws into a socket.', zh: '它发光还能拧进灯座。' },
    roast: { en: 'That\'s a lamp. A LAMP.', zh: '那是台灯，台！灯！' },
    objects: [
      O('apple', 360, 420, 140, 140, 'circle', 'Apple', '苹果'),
      O('lamp', 640, 420, 140, 190, 'bulb', 'Lamp', '台灯'),
      O('banana', 920, 420, 170, 130, 'circle', 'Banana', '香蕉'),
    ],
    solution: [tap('lamp')],
  },
  {
    id: 10, chapter: 2, scene: 'kitchen',
    title: { en: 'Melt it fast', zh: '快点融化' },
    goal: { en: 'Melt the ice cube in a hurry', zh: '让冰块快点融化' },
    hint: { en: 'Drag it onto the hot pan.', zh: '把它拖到热锅上。' },
    roast: { en: 'Thermodynamics, defeated.', zh: '热力学，卒。' },
    objects: [
      O('ice', 380, 420, 140, 140, 'circle', 'Ice cube', '冰块', { draggable: true }),
      O('pan', 920, 420, 220, 160, 'cup', 'Hot pan', '热锅'),
    ],
    solution: [dragTo('ice', 'pan')],
  },
  {
    id: 11, chapter: 2, scene: 'kitchen',
    title: { en: 'Milk run', zh: '拿牛奶' },
    goal: { en: 'Get the milk out of the fridge', zh: '从冰箱里拿出牛奶' },
    hint: { en: 'Open the door first.', zh: '先开门。' },
    roast: { en: 'You drank it straight? Brave.', zh: '直接对瓶吹？勇士。' },
    objects: [
      O('fridge', 520, 400, 300, 340, 'rect', 'Fridge', '冰箱'),
      O('milk', 700, 460, 130, 180, 'bottle', 'Milk', '牛奶', { coveredBy: 'fridgeDoor' }),
      O('fridgeDoor', 380, 400, 200, 330, 'rect', 'Fridge door', '冰箱门', { draggable: true }),
    ],
    solution: [dragOff('fridgeDoor'), tap('milk')],
  },
  {
    id: 12, chapter: 2, scene: 'kitchen', strict: true,
    title: { en: 'Bake a cake', zh: '烤蛋糕' },
    goal: { en: 'Bake a birthday cake', zh: '烤一个生日蛋糕' },
    hint: { en: 'Egg + flour into the bowl, bowl into oven, then fire it.', zh: '鸡蛋和面粉倒进碗，碗进烤箱，再开火。' },
    roast: { en: 'Happy birthday, science style!', zh: '生日快乐，科学风味！' },
    objects: [
      O('egg', 300, 320, 120, 130, 'circle', 'Egg', '鸡蛋', { draggable: true }),
      O('flour', 300, 500, 140, 150, 'bottle', 'Flour', '面粉', { draggable: true }),
      O('bowl', 640, 400, 220, 180, 'cup', 'Bowl', '碗', { draggable: true }),
      O('oven', 980, 400, 240, 260, 'rect', 'Oven', '烤箱'),
    ],
    solution: [dragTo('egg', 'bowl'), dragTo('flour', 'bowl'), dragTo('bowl', 'oven'), tap('oven')],
  },

  // ---------- 第 3 章 · 花园 ----------
  {
    id: 13, chapter: 3, scene: 'garden',
    title: { en: 'Thirsty flower', zh: '口渴的花' },
    goal: { en: 'Water the wilting flower', zh: '给蔫掉的花浇水' },
    hint: { en: 'Drag the can to the flower.', zh: '把水壶拖到花上。' },
    roast: { en: 'It was just thirsty, drama queen.', zh: '它只是渴了，戏精。' },
    objects: [
      O('can', 380, 420, 190, 180, 'bottle', 'Watering can', '水壶', { draggable: true }),
      O('flower', 920, 440, 180, 220, 'plant', 'Flower', '花'),
    ],
    solution: [dragTo('can', 'flower')],
  },
  {
    id: 14, chapter: 3, scene: 'garden',
    title: { en: 'Scare the crow', zh: '赶走乌鸦' },
    goal: { en: 'Scare the crow off the tree', zh: '把树上的乌鸦赶走' },
    hint: { en: 'Tap the scarecrow, not the crow.', zh: '点稻草人，别点乌鸦。' },
    roast: { en: 'The crow is still laughing.', zh: '乌鸦还在笑。' },
    objects: [
      O('crow', 640, 300, 160, 140, 'bird', 'Crow', '乌鸦'),
      O('scarecrow', 640, 520, 200, 260, 'person', 'Scarecrow', '稻草人'),
    ],
    solution: [tap('scarecrow')],
  },
  {
    id: 15, chapter: 3, scene: 'garden',
    title: { en: 'Lost key', zh: '丢失的钥匙' },
    goal: { en: 'Find the key hidden in the grass', zh: '找到藏在草丛里的钥匙' },
    hint: { en: 'Brush the grass aside.', zh: '把草拨开。' },
    roast: { en: 'The key was under the grass. Classic.', zh: '钥匙就在草底下，老套路。' },
    objects: [
      O('key', 640, 500, 140, 100, 'key', 'Key', '钥匙', { coveredBy: 'grass' }),
      O('grass', 640, 480, 300, 180, 'plant', 'Grass', '草丛', { draggable: true }),
    ],
    solution: [dragOff('grass'), tap('key')],
  },
  {
    id: 16, chapter: 3, scene: 'garden',
    title: { en: 'Make it rain', zh: '让天下雨' },
    goal: { en: 'Make the cloud pour rain', zh: '让乌云下起雨' },
    hint: { en: 'Tap the cloud three times.', zh: '点乌云三下。' },
    roast: { en: 'You squeezed the whole cloud.', zh: '你把整朵云都挤干了。' },
    objects: [
      O('cloud', 640, 340, 260, 180, 'cloud', 'Cloud', '乌云'),
    ],
    solution: [tapN('cloud', 3)],
  },
  {
    id: 17, chapter: 3, scene: 'garden',
    title: { en: 'Day to night', zh: '白天变黑夜' },
    goal: { en: 'Turn the bright day into night', zh: '把明亮的白天变成黑夜' },
    hint: { en: 'Drag the curtain over the sun.', zh: '把窗帘拉到太阳前。' },
    roast: { en: 'Blackout achieved.', zh: '熄灯成功。' },
    objects: [
      O('sun', 380, 360, 180, 180, 'sun', 'Sun', '太阳'),
      O('curtain', 920, 360, 220, 240, 'rect', 'Curtain', '窗帘', { draggable: true }),
    ],
    solution: [dragTo('curtain', 'sun')],
  },
  {
    id: 18, chapter: 3, scene: 'garden', strict: true,
    title: { en: 'Build a scarecrow', zh: '组装稻草人' },
    goal: { en: 'Assemble the scarecrow to scare the crow away', zh: '组装稻草人，把乌鸦赶走' },
    hint: { en: 'Head on body, hat on head, then shoo the crow.', zh: '头装身体，帽子戴头，再赶乌鸦。' },
    roast: { en: 'Frankenstein\'s scarecrow.', zh: '科学怪人版稻草人。' },
    objects: [
      O('head', 320, 320, 150, 150, 'circle', 'Head', '头', { draggable: true }),
      O('hat', 320, 520, 190, 130, 'rect', 'Hat', '帽子', { draggable: true }),
      O('body', 720, 460, 240, 280, 'person', 'Body', '身体'),
      O('crow', 1040, 300, 150, 130, 'bird', 'Crow', '乌鸦'),
    ],
    solution: [dragTo('head', 'body'), dragTo('hat', 'body'), tap('crow')],
  },

  // ---------- 第 4 章 · 太空控制室 ----------
  {
    id: 19, chapter: 4, scene: 'space',
    title: { en: 'Launch it', zh: '发射火箭' },
    goal: { en: 'Press the launch button under the cover', zh: '按下保护罩下的发射按钮' },
    hint: { en: 'Lift the cover first.', zh: '先掀开保护罩。' },
    roast: { en: 'Three, two, one... boom.', zh: '三、二、一……轰。' },
    objects: [
      O('button', 640, 440, 200, 130, 'rect', 'LAUNCH', '发射', { coveredBy: 'cover' }),
      O('cover', 640, 430, 240, 160, 'rect', 'Cover', '保护罩', { draggable: true }),
      O('rocket', 920, 300, 220, 320, 'arrow', 'Rocket', '火箭'),
    ],
    solution: [dragOff('cover'), tap('button')],
  },
  {
    id: 20, chapter: 4, scene: 'space',
    title: { en: 'Rescue the astronaut', zh: '营救宇航员' },
    goal: { en: 'Send the astronaut back to the ship', zh: '把宇航员送回飞船' },
    hint: { en: 'Drag the astronaut into the ship.', zh: '把宇航员拖进飞船。' },
    roast: { en: 'Houston, we have a hug.', zh: '休斯顿，我们有个拥抱。' },
    objects: [
      O('astronaut', 380, 420, 180, 220, 'person', 'Astronaut', '宇航员', { draggable: true }),
      O('ship', 920, 420, 260, 240, 'rect', 'Ship', '飞船'),
    ],
    solution: [dragTo('astronaut', 'ship')],
  },
  {
    id: 21, chapter: 4, scene: 'space',
    title: { en: 'Fix the light', zh: '修好闪烁的灯' },
    goal: { en: 'Fix the flickering light', zh: '修好闪烁的灯' },
    hint: { en: 'Tap it three times.', zh: '点它三下。' },
    roast: { en: 'Have you tried turning it off and on?', zh: '你试过关掉再打开吗？' },
    objects: [
      O('light', 640, 380, 150, 160, 'bulb', 'Light', '灯'),
    ],
    solution: [tapN('light', 3)],
  },
  {
    id: 22, chapter: 4, scene: 'space',
    title: { en: 'Connect the stars', zh: '连起星星' },
    goal: { en: 'Drag all three stars into the constellation slot', zh: '把三颗星都拖进星座槽' },
    hint: { en: 'All three stars share one slot.', zh: '三颗星共用一个槽。' },
    roast: { en: 'A triangle! Groundbreaking.', zh: '三角形！划时代发现。' },
    objects: [
      O('star1', 340, 300, 120, 120, 'star', 'Star', '星星', { draggable: true }),
      O('star2', 520, 520, 120, 120, 'star', 'Star', '星星', { draggable: true }),
      O('star3', 700, 300, 120, 120, 'star', 'Star', '星星', { draggable: true }),
      O('slot', 1040, 420, 200, 200, 'rect', 'Slot', '星座槽'),
    ],
    solution: [dragTo('star1', 'slot'), dragTo('star2', 'slot'), dragTo('star3', 'slot')],
  },
  {
    id: 23, chapter: 4, scene: 'space', strict: true, rotate: true,
    title: { en: 'Silence the alarm', zh: '关掉警报' },
    goal: { en: 'Flip the scene, then press the MUTE button', zh: '翻转场景，再按 MUTE 键' },
    hint: { en: 'The MUTE button only makes sense upside down.', zh: 'MUTE 键倒过来才看得懂。' },
    roast: { en: 'Muted. Finally some peace.', zh: '静音了，终于清静。' },
    objects: [
      O('mute', 640, 420, 220, 120, 'rect', 'MUTE', '静音'),
      O('handle', 1040, 540, 110, 110, 'gear', 'Rotate', '旋转', { draggable: true }),
    ],
    solution: [invert(), tap('mute')],
  },
  {
    id: 24, chapter: 4, scene: 'space', strict: true, rotate: true,
    title: { en: 'Escape the ship', zh: '逃离飞船' },
    goal: { en: 'Escape the runaway ship', zh: '逃离失控的飞船' },
    hint: { en: 'Keycard in console, pull the lever, flip gravity, enter the pod.', zh: '刷卡进控制台，拉杆，倒置重力，进逃生舱。' },
    roast: { en: 'You escaped. The doctor is still on board.', zh: '你逃出来了，博士还在船上。' },
    objects: [
      O('keycard', 340, 320, 150, 110, 'card', 'Keycard', '门卡', { draggable: true }),
      O('console', 640, 300, 300, 220, 'rect', 'Console', '控制台'),
      O('lever', 640, 540, 180, 130, 'rect', 'Lever', '拉杆'),
      O('pod', 1040, 400, 220, 260, 'rect', 'Escape pod', '逃生舱'),
      O('handle', 1120, 580, 110, 110, 'gear', 'Rotate', '旋转', { draggable: true }),
    ],
    solution: [dragTo('keycard', 'console'), tap('lever'), invert(), tap('pod')],
  },
];

export default LEVELS;
