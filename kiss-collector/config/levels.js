// config/levels.js — 24 关甜甜整蛊谜题（原创 · KISS COLLECTOR）。
// 结构：goal 目标 / hint 提示 / roast 过关吐槽（en+zh），objects 可交互物，solution 解法。
// solution 项：
//   {kind:'tap',id} | {kind:'tapN',id,count} | {kind:'shadow',id}
//   | {kind:'dragTo',id,targetId} | {kind:'dragOff',id} | {kind:'invert'}
//   | {kind:'tapSeq',ids:[...]}  (按顺序点)  | {kind:'hold',id}  (长按)
// strict:true = 多步按序；coveredBy = 被遮挡物盖住，拖走盖子前不可点。
// 对象：{ id, x, y(中心), w, h, glyph, label:{en,zh}, draggable?, coveredBy?, shadow?:{x,y,w,h} }
// glyph ∈ circle/rect/star/cloud/sun/moon/bottle/person/plant/bird/key/gear/card/cup/bulb/arrow
//        heart/lips/ring/letter/rose/crown/bell/gem/choco/gift/candle/mirror/mask

function O(id, x, y, w, h, glyph, en, zh, opts = {}) {
  return { id, x, y, w, h, glyph, label: { en, zh }, ...opts };
}

function dragTo(id, targetId) { return { kind: 'dragTo', id, targetId }; }
function dragOff(id) { return { kind: 'dragOff', id }; }
function tap(id) { return { kind: 'tap', id }; }
function tapN(id, count) { return { kind: 'tapN', id, count }; }
function shadow(id) { return { kind: 'shadow', id }; }
function tapSeq(ids) { return { kind: 'tapSeq', ids }; }
function hold(id) { return { kind: 'hold', id }; }
const invert = () => ({ kind: 'invert' });

export const LEVELS = [
  // ---------- 第 1 章 · 甜品街 Sweet Street ----------
  {
    id: 1, chapter: 1, scene: 'sweet',
    title: { en: 'The blushing heart', zh: '脸红的小心' },
    goal: { en: 'Tap the blushing heart', zh: '点一点脸红的小心' },
    hint: { en: 'Only one of them is blushing.', zh: '只有一个是脸红红的。' },
    roast: { en: 'Muah! Your first kiss is collected.', zh: '么么哒！第一枚亲亲到手啦。' },
    objects: [
      O('cloud', 360, 400, 180, 140, 'cloud', 'Cloud', '云朵'),
      O('heart', 640, 400, 180, 180, 'heart', 'Blushing heart', '脸红的小心'),
      O('star', 920, 400, 160, 160, 'star', 'Star', '星星'),
    ],
    solution: [tap('heart')],
  },
  {
    id: 2, chapter: 1, scene: 'sweet',
    title: { en: 'Chocolate delivery', zh: '巧克力快递' },
    goal: { en: 'Send the chocolate into the gift box', zh: '把巧克力送进礼物盒' },
    hint: { en: 'Drag it, don\'t tap it.', zh: '拖过去，别点它。' },
    roast: { en: 'Delivered with a kiss on top!', zh: '快递到了，还附赠一个亲亲！' },
    objects: [
      O('choco', 380, 420, 180, 140, 'choco', 'Chocolate', '巧克力', { draggable: true }),
      O('gift', 920, 420, 220, 200, 'gift', 'Gift box', '礼物盒'),
    ],
    solution: [dragTo('choco', 'gift')],
  },
  {
    id: 3, chapter: 1, scene: 'sweet',
    title: { en: 'The hidden kiss', zh: '藏起来的亲亲' },
    goal: { en: 'Find the real kiss behind the poster', zh: '找到海报后面的真亲亲' },
    hint: { en: 'The poster is hiding it.', zh: '海报后面藏着一个。' },
    roast: { en: 'You actually peeled the poster?', zh: '你居然真去掀海报？' },
    objects: [
      O('lips', 640, 300, 180, 140, 'lips', 'Fake kiss', '假亲亲'),
      O('heart', 640, 470, 180, 170, 'heart', 'Real kiss', '真亲亲', { coveredBy: 'poster' }),
      O('poster', 640, 470, 240, 190, 'rect', 'Poster', '海报', { draggable: true }),
    ],
    solution: [dragOff('poster'), tap('heart')],
  },
  {
    id: 4, chapter: 1, scene: 'sweet',
    title: { en: 'Rub the magic lamp', zh: '擦一擦神灯' },
    goal: { en: 'Rub the lamp to summon the kiss genie', zh: '擦亮神灯，召唤亲亲精灵' },
    hint: { en: 'Press and HOLD the lamp.', zh: '按住神灯别松手。' },
    roast: { en: 'The genie grants you a thousand kisses!', zh: '精灵许你一千个亲亲！' },
    objects: [
      O('lamp', 640, 400, 180, 200, 'bulb', 'Magic lamp', '神灯'),
    ],
    solution: [hold('lamp')],
  },
  {
    id: 5, chapter: 1, scene: 'sweet',
    title: { en: 'Three little kisses', zh: '三枚小亲亲' },
    goal: { en: 'Plant three kisses on the cheek', zh: '在脸颊上亲三下' },
    hint: { en: 'Tap it three times.', zh: '点三下。' },
    roast: { en: 'A triple kiss! Now that is devotion.', zh: '三连亲！这也太甜了吧。' },
    objects: [
      O('cheek', 640, 400, 200, 200, 'lips', 'Cheek', '脸颊'),
    ],
    solution: [tapN('cheek', 3)],
  },
  {
    id: 6, chapter: 1, scene: 'sweet',
    title: { en: 'Sweet sequence', zh: '甜点顺序' },
    goal: { en: 'Tap lollipop, then cupcake, then the heart', zh: '按顺序点：棒棒糖、纸杯蛋糕、爱心' },
    hint: { en: 'Follow the order, don\'t rush.', zh: '按顺序来，别抢跑。' },
    roast: { en: 'A perfect three-course dessert!', zh: '完美的甜点三连击！' },
    objects: [
      O('lollipop', 360, 420, 150, 180, 'circle', 'Lollipop', '棒棒糖'),
      O('cupcake', 640, 420, 170, 170, 'cup', 'Cupcake', '纸杯蛋糕'),
      O('heart', 920, 420, 180, 180, 'heart', 'Heart', '爱心'),
    ],
    solution: [tapSeq(['lollipop', 'cupcake', 'heart'])],
  },

  // ---------- 第 2 章 · 心形花园 Heart Garden ----------
  {
    id: 7, chapter: 2, scene: 'garden',
    title: { en: 'Water the rose', zh: '给玫瑰浇水' },
    goal: { en: 'Water the wilting rose', zh: '给蔫掉的玫瑰浇水' },
    hint: { en: 'Drag the watering can to the rose.', zh: '把水壶拖到玫瑰上。' },
    roast: { en: 'It was just thirsty, drama queen.', zh: '它只是渴了，小戏精。' },
    objects: [
      O('can', 380, 420, 190, 180, 'bottle', 'Watering can', '水壶', { draggable: true }),
      O('rose', 920, 440, 180, 220, 'rose', 'Rose', '玫瑰'),
    ],
    solution: [dragTo('can', 'rose')],
  },
  {
    id: 8, chapter: 2, scene: 'garden',
    title: { en: 'Kiss the shadow', zh: '亲亲影子' },
    goal: { en: 'Tap the bulb twice, then tap its shadow', zh: '点灯泡两下，再点它的影子' },
    hint: { en: 'Two on the bulb, one on the shadow.', zh: '灯泡点两下，影子点一下。' },
    roast: { en: 'Even light has a shadow!', zh: '光也有影子！' },
    objects: [
      O('bulb', 640, 340, 140, 150, 'bulb', 'Bulb', '灯泡', { shadow: { x: 700, y: 470, w: 130, h: 80 } }),
    ],
    solution: [tapN('bulb', 2), shadow('bulb')],
  },
  {
    id: 9, chapter: 2, scene: 'garden',
    title: { en: 'Not a flower', zh: '不是花' },
    goal: { en: 'Tap the one that is NOT a flower', zh: '点出那个不是花的' },
    hint: { en: 'It glows and screws into a socket.', zh: '它发光还能拧进灯座。' },
    roast: { en: 'That\'s a lamp. A LAMP.', zh: '那是台灯，台！灯！' },
    objects: [
      O('roseA', 360, 420, 160, 200, 'rose', 'Rose', '玫瑰'),
      O('roseB', 640, 420, 160, 200, 'rose', 'Rose', '玫瑰'),
      O('lamp', 920, 420, 150, 190, 'bulb', 'Lamp', '台灯'),
    ],
    solution: [tap('lamp')],
  },
  {
    id: 10, chapter: 2, scene: 'garden',
    title: { en: 'Lost ring in the grass', zh: '草丛里的戒指' },
    goal: { en: 'Find the ring hidden in the grass', zh: '找到藏在草丛里的戒指' },
    hint: { en: 'Brush the grass aside.', zh: '把草拨开。' },
    roast: { en: 'The ring was under the grass. Classic.', zh: '戒指就在草底下，老套路。' },
    objects: [
      O('ring', 640, 500, 140, 120, 'ring', 'Ring', '戒指', { coveredBy: 'grass' }),
      O('grass', 640, 480, 320, 180, 'plant', 'Grass', '草丛', { draggable: true }),
    ],
    solution: [dragOff('grass'), tap('ring')],
  },
  {
    id: 11, chapter: 2, scene: 'garden',
    title: { en: 'Two halves, one heart', zh: '两半合一' },
    goal: { en: 'Drag the left half onto the right half', zh: '把左半边拖到右半边' },
    hint: { en: 'A whole heart is sweeter.', zh: '完整的心更甜。' },
    roast: { en: 'A perfect match made in the garden.', zh: '花园里天造地设的一对。' },
    objects: [
      O('halfA', 380, 420, 170, 170, 'heart', 'Left half', '左半边', { draggable: true }),
      O('halfB', 920, 420, 170, 170, 'heart', 'Right half', '右半边'),
    ],
    solution: [dragTo('halfA', 'halfB')],
  },
  {
    id: 12, chapter: 2, scene: 'garden', strict: true,
    title: { en: 'Grow a bouquet', zh: '种出一束花' },
    goal: { en: 'Seed in the pot, water it, then call the sun', zh: '种子进花盆，浇水，再叫太阳' },
    hint: { en: 'Seed, water, sun — in that order.', zh: '先种子，再浇水，最后太阳。' },
    roast: { en: 'A bouquet for your sweetheart!', zh: '一束花送给你的心上人！' },
    objects: [
      O('seed', 300, 320, 120, 130, 'circle', 'Seed', '种子', { draggable: true }),
      O('can', 300, 520, 160, 150, 'bottle', 'Water', '水壶', { draggable: true }),
      O('pot', 700, 440, 220, 200, 'cup', 'Pot', '花盆'),
      O('sun', 1040, 300, 150, 150, 'sun', 'Sun', '太阳'),
    ],
    solution: [dragTo('seed', 'pot'), dragTo('can', 'pot'), tap('sun')],
  },

  // ---------- 第 3 章 · 丘比特工作室 Cupid's Studio ----------
  {
    id: 13, chapter: 3, scene: 'studio',
    title: { en: 'Aim the arrow', zh: '瞄准爱之箭' },
    goal: { en: 'Drag the arrow onto the target', zh: '把箭拖到靶心上' },
    hint: { en: 'Cupid never misses… once you help him.', zh: '丘比特从不失手……只要你帮他。' },
    roast: { en: 'Bullseye! Someone is falling in love.', zh: '正中靶心！有人坠入爱河了。' },
    objects: [
      O('arrow', 380, 420, 190, 150, 'arrow', 'Arrow', '爱之箭', { draggable: true }),
      O('target', 920, 420, 200, 200, 'rect', 'Target', '靶心'),
    ],
    solution: [dragTo('arrow', 'target')],
  },
  {
    id: 14, chapter: 3, scene: 'studio', rotate: true,
    title: { en: 'Flip the mirror', zh: '翻转魔镜' },
    goal: { en: 'Flip the whole scene upside down', zh: '把整个场景倒过来' },
    hint: { en: 'Drag the rotate handle to flip.', zh: '拖旋转把手把场景倒过来。' },
    roast: { en: 'Mirror, mirror — upside down!', zh: '魔镜魔镜——倒过来啦！' },
    objects: [
      O('mirror', 560, 400, 320, 220, 'mirror', 'Magic mirror', '魔镜'),
      O('handle', 1040, 540, 120, 120, 'gear', 'Rotate', '旋转', { draggable: true }),
    ],
    solution: [invert()],
  },
  {
    id: 15, chapter: 3, scene: 'studio',
    title: { en: 'Melt the frozen heart', zh: '融化冰冻的心' },
    goal: { en: 'Drag the ice heart onto the heat lamp', zh: '把冰心拖到暖灯上' },
    hint: { en: 'Warmth melts everything.', zh: '温暖能融化一切。' },
    roast: { en: 'Your warmth melted a frozen heart!', zh: '你的温暖融化了冰冻的心！' },
    objects: [
      O('ice', 380, 420, 160, 160, 'gem', 'Ice heart', '冰心', { draggable: true }),
      O('lamp', 920, 420, 170, 190, 'bulb', 'Heat lamp', '暖灯'),
    ],
    solution: [dragTo('ice', 'lamp')],
  },
  {
    id: 16, chapter: 3, scene: 'studio',
    title: { en: 'Ring the wedding bell', zh: '敲响婚礼钟' },
    goal: { en: 'Ring the wedding bell three times', zh: '敲响婚礼钟三下' },
    hint: { en: 'Three rings for the happy couple.', zh: '为新人敲三下。' },
    roast: { en: 'Ding, ding, ding — you may kiss!', zh: '当当当——可以亲啦！' },
    objects: [
      O('bell', 640, 400, 180, 200, 'bell', 'Wedding bell', '婚礼钟'),
    ],
    solution: [tapN('bell', 3)],
  },
  {
    id: 17, chapter: 3, scene: 'studio',
    title: { en: 'The hidden ring', zh: '面纱下的戒指' },
    goal: { en: 'Lift the veil to find the ring', zh: '掀开面纱找到戒指' },
    hint: { en: 'The veil is in the way.', zh: '面纱挡着呢。' },
    roast: { en: 'Lift the veil — you may kiss the ring!', zh: '掀开面纱——可以亲吻戒指啦！' },
    objects: [
      O('ring', 640, 480, 140, 120, 'ring', 'Ring', '戒指', { coveredBy: 'veil' }),
      O('veil', 640, 470, 260, 170, 'cloud', 'Veil', '面纱', { draggable: true }),
    ],
    solution: [dragOff('veil'), tap('ring')],
  },
  {
    id: 18, chapter: 3, scene: 'studio', strict: true,
    title: { en: 'The proposal', zh: '求婚' },
    goal: { en: 'Ring in the box, then hold the box to seal it', zh: '戒指放进盒子，再长按盒子封存' },
    hint: { en: 'Ring first, then hold.', zh: '先放戒指，再长按。' },
    roast: { en: 'She said YES — with a kiss!', zh: '她答应了——还附赠一个亲亲！' },
    objects: [
      O('ring', 380, 420, 150, 130, 'ring', 'Ring', '戒指', { draggable: true }),
      O('box', 920, 420, 200, 190, 'gift', 'Ring box', '戒指盒'),
    ],
    solution: [dragTo('ring', 'box'), hold('box')],
  },

  // ---------- 第 4 章 · 月光舞会 Moonlight Ball ----------
  {
    id: 19, chapter: 4, scene: 'moon',
    title: { en: 'The odd one out', zh: '找不同' },
    goal: { en: 'Tap the one that is not a star', zh: '点出那个不是星星的' },
    hint: { en: 'Stars have five points.', zh: '星星有五个角。' },
    roast: { en: 'A heart among stars — how romantic.', zh: '群星中的一颗心，真浪漫。' },
    objects: [
      O('starA', 360, 420, 150, 150, 'star', 'Star', '星星'),
      O('starB', 640, 420, 150, 150, 'star', 'Star', '星星'),
      O('heart', 920, 420, 160, 160, 'heart', 'Heart', '爱心'),
    ],
    solution: [tap('heart')],
  },
  {
    id: 20, chapter: 4, scene: 'moon',
    title: { en: 'Catch the falling star', zh: '接住流星' },
    goal: { en: 'Drag the star back into the sky', zh: '把星星拖回天空' },
    hint: { en: 'It belongs in the sky.', zh: '它属于天空。' },
    roast: { en: 'A wish granted for a kiss!', zh: '许个愿，换一个亲亲！' },
    objects: [
      O('star', 380, 420, 150, 150, 'star', 'Fallen star', '流星', { draggable: true }),
      O('sky', 920, 420, 220, 190, 'rect', 'Sky', '天空'),
    ],
    solution: [dragTo('star', 'sky')],
  },
  {
    id: 21, chapter: 4, scene: 'moon',
    title: { en: 'Kiss under the moon', zh: '月下之吻' },
    goal: { en: 'Tap moon, then star, then the heart', zh: '按顺序点：月亮、星星、爱心' },
    hint: { en: 'Moon, star, heart — in order.', zh: '月亮、星星、爱心，按顺序。' },
    roast: { en: 'A kiss under the moonlight. Perfect.', zh: '月光下的吻，完美。' },
    objects: [
      O('moon', 360, 420, 170, 170, 'moon', 'Moon', '月亮'),
      O('star', 640, 420, 150, 150, 'star', 'Star', '星星'),
      O('heart', 920, 420, 160, 160, 'heart', 'Heart', '爱心'),
    ],
    solution: [tapSeq(['moon', 'star', 'heart'])],
  },
  {
    id: 22, chapter: 4, scene: 'moon',
    title: { en: 'Toast the couple', zh: '为新人举杯' },
    goal: { en: 'Pour both bottles into the two glasses', zh: '把两瓶香槟倒进两个酒杯' },
    hint: { en: 'Two bottles, two glasses.', zh: '两瓶酒，两个杯。' },
    roast: { en: 'Cheers! To the happy couple!', zh: '干杯！敬这对幸福的新人！' },
    objects: [
      O('bottle1', 340, 340, 170, 190, 'bottle', 'Champagne', '香槟', { draggable: true }),
      O('bottle2', 340, 520, 170, 190, 'bottle', 'Champagne', '香槟', { draggable: true }),
      O('glass1', 940, 340, 160, 170, 'cup', 'Glass', '酒杯'),
      O('glass2', 940, 520, 160, 170, 'cup', 'Glass', '酒杯'),
    ],
    solution: [dragTo('bottle1', 'glass1'), dragTo('bottle2', 'glass2')],
  },
  {
    id: 23, chapter: 4, scene: 'moon', strict: true, rotate: true,
    title: { en: 'Lights off for the kiss', zh: '关灯亲亲' },
    goal: { en: 'Flip the scene, then hold the candle', zh: '翻转场景，再长按蜡烛' },
    hint: { en: 'The candle only works upside down.', zh: '蜡烛倒过来才点得着。' },
    roast: { en: 'Lights out — a kiss in the dark!', zh: '灯灭了——黑暗中的一吻！' },
    objects: [
      O('candle', 640, 420, 140, 200, 'candle', 'Candle', '蜡烛'),
      O('handle', 1040, 540, 110, 110, 'gear', 'Rotate', '旋转', { draggable: true }),
    ],
    solution: [invert(), hold('candle')],
  },
  {
    id: 24, chapter: 4, scene: 'moon', strict: true, rotate: true,
    title: { en: 'The grand kiss', zh: '盛大之吻' },
    goal: { en: 'Keycard in console, pull the lever, flip gravity, hold the couple', zh: '刷卡进控制台，拉杆，倒置重力，长按新人' },
    hint: { en: 'Follow each step in order.', zh: '按顺序一步步来。' },
    roast: { en: 'The grand kiss! Happily ever after!', zh: '盛大之吻！从此幸福地生活在一起！' },
    objects: [
      O('card', 340, 320, 150, 110, 'card', 'Keycard', '门卡', { draggable: true }),
      O('console', 640, 300, 300, 220, 'rect', 'Console', '控制台'),
      O('lever', 640, 540, 180, 130, 'rect', 'Lever', '拉杆'),
      O('couple', 1040, 400, 200, 220, 'heart', 'The couple', '新人'),
      O('handle', 1120, 580, 110, 110, 'gear', 'Rotate', '旋转', { draggable: true }),
    ],
    solution: [dragTo('card', 'console'), tap('lever'), invert(), hold('couple')],
  },
];

export default LEVELS;
