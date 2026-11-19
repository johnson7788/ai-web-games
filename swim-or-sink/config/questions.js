// 题目库：12 道原创水下生存题，分 3 个深度（每关 4 题）。
// q / opts / reason 均为 { en, zh } 双语；answer 为正确选项下标。
// shuffle 为 true 的关在开局时随机打乱选项顺序（并同步重映射 answer）。

export const LEVELS = [
  {
    id: 'shallow',
    nameKey: 'depthShallow',
    scene: 'shallow',
    shuffle: false,
    questions: [
      {
        q: { en: 'You suddenly fall into deep water. What do you do first?', zh: '你不慎跌入深水，首先应该怎么做？' },
        opts: [
          { en: 'Stay calm and avoid thrashing', zh: '保持冷静，不乱扑腾' },
          { en: 'Flail and shout as loud as possible', zh: '拼命挣扎并大声呼喊' },
        ],
        answer: 0,
        reason: { en: 'Panic wastes air and energy; staying calm lets you think and float.', zh: '慌乱只会浪费空气和体力，冷静才能思考并漂浮。' },
      },
      {
        q: { en: 'Your pockets are full of phone and keys. What should you do?', zh: '口袋里装着手机和钥匙，你应该怎么做？' },
        opts: [
          { en: 'Keep them safe', zh: '保护好，不能丢失' },
          { en: 'Drop heavy items like phone and keys', zh: '扔掉手机、钥匙等重物' },
        ],
        answer: 1,
        reason: { en: 'Anything heavier than water drags you down; light clothing can stay on.', zh: '比水重的东西会把你往下拖，轻薄的衣物可以留着。' },
      },
      {
        q: { en: 'To float with the least effort, you should…', zh: '想用最省力的方式浮起来，应该怎么做？' },
        opts: [
          { en: 'Relax your whole body', zh: '放松全身' },
          { en: 'Kick and paddle hard', zh: '用力蹬水划水' },
        ],
        answer: 0,
        reason: { en: 'The human body floats near water density; relaxing helps it rise.', zh: '人体密度接近水，放松身体有助于自然浮起。' },
      },
      {
        q: { en: 'Once at the surface, which position helps you breathe?', zh: '浮到水面后，哪种姿势更利于呼吸？' },
        opts: [
          { en: 'Float on your back, head tilted, mouth and nose above water', zh: '仰面漂浮，头部后仰，口鼻露出水面' },
          { en: 'Tread water upright with fast kicks', zh: '直立踩水并快速蹬腿' },
        ],
        answer: 0,
        reason: { en: 'Back-floating keeps your airway clear and saves energy.', zh: '仰漂能保持呼吸道畅通，也更省力。' },
      },
    ],
  },
  {
    id: 'deep',
    nameKey: 'depthDeep',
    scene: 'deep',
    shuffle: false,
    questions: [
      {
        q: { en: 'How should you breathe while floating to avoid choking?', zh: '漂浮时怎样呼吸才能避免呛水？' },
        opts: [
          { en: 'Inhale through the nose, exhale through the nose', zh: '用鼻吸气，用鼻呼气' },
          { en: 'Inhale through the mouth, exhale through the nose', zh: '用嘴吸气，用鼻呼气' },
          { en: 'Hold your breath as long as possible', zh: '尽量长时间憋气' },
        ],
        answer: 1,
        reason: { en: 'Mouth-in keeps water out of your nose; slow exhale keeps lungs buoyant.', zh: '用嘴吸气能避免水进鼻腔，缓慢呼气让肺部保持浮力。' },
      },
      {
        q: { en: 'Your leg cramps while swimming. What do you do?', zh: '游泳时腿部抽筋，你应该怎么做？' },
        opts: [
          { en: 'Straighten the leg and pull your toes upward', zh: '伸直抽筋的腿，把脚趾向上扳' },
          { en: 'Kick the leg as hard as you can', zh: '用力蹬腿' },
          { en: 'Rub the leg hard underwater', zh: '在水下用力揉腿' },
        ],
        answer: 0,
        reason: { en: 'Straightening plus toe-up stretches the cramp; kicking makes it worse.', zh: '伸直并上扳脚趾能缓解抽筋，蹬腿会加重。' },
      },
      {
        q: { en: 'Your hand cramps. Best response?', zh: '手指抽筋时，最好的做法是？' },
        opts: [
          { en: 'Make a fist then open hard, repeat quickly', zh: '握拳再用力张开，快速反复几次' },
          { en: 'Shake the hand wildly', zh: '使劲甩手' },
          { en: 'Hold the hand perfectly still', zh: '让手完全不动' },
        ],
        answer: 0,
        reason: { en: 'Fist-open cycles release the spasm and restore blood flow.', zh: '握拳张开的循环能解除痉挛、恢复血流。' },
      },
      {
        q: { en: 'Caught in seaweed, you should…', zh: '被水草缠住时，你应该怎么做？' },
        opts: [
          { en: 'Struggle to break free', zh: '使劲挣扎挣脱' },
          { en: 'Take a breath, dive and untangle by hand', zh: '深吸一口气潜入水下，用手解开' },
          { en: 'Float and wait for help', zh: '漂浮原地等待救援' },
        ],
        answer: 1,
        reason: { en: 'Struggling tightens the tangle; calm untangling works best.', zh: '挣扎会让水草缠得更紧，冷静地用手解开最有效。' },
      },
    ],
  },
  {
    id: 'open',
    nameKey: 'depthOpen',
    scene: 'open',
    shuffle: true,
    questions: [
      {
        q: { en: 'Caught in a whirlpool, you should…', zh: '遇上漩涡时，你应该怎么做？' },
        opts: [
          { en: 'Swim along the tangent, away from the center', zh: '沿切线方向游离漩涡中心' },
          { en: 'Tread water upright in place', zh: '直立踩水留在原地' },
          { en: 'Dive straight down', zh: '直接向下潜' },
        ],
        answer: 0,
        reason: { en: 'Move away from the vortex pull; staying or diving gets you pulled in.', zh: '要远离漩涡的吸力，原地或下潜都会被卷入。' },
      },
      {
        q: { en: 'You see floating debris nearby. What do you do?', zh: '看到附近有漂浮物，你应该怎么做？' },
        opts: [
          { en: 'Push it away', zh: '把它推开' },
          { en: 'Grab and hold onto it', zh: '抓住并抱住它' },
          { en: 'Swim past it', zh: '绕过它继续游' },
        ],
        answer: 1,
        reason: { en: 'Floating objects help you stay buoyant and rest.', zh: '漂浮物能帮你保持浮力、节省体力。' },
      },
      {
        q: { en: 'You see people on shore. Best action?', zh: '看到岸边有人，最好的做法是？' },
        opts: [
          { en: 'Stay calm and call for help', zh: '保持镇定，大声呼救' },
          { en: 'Swim toward them as fast as possible', zh: '拼命朝他们游去' },
          { en: 'Wave only your arms underwater', zh: '只在水下摆动手臂' },
        ],
        answer: 0,
        reason: { en: 'Calm calling attracts attention; frantic swimming exhausts you.', zh: '镇定呼救容易引起注意，慌乱游动只会耗尽体力。' },
      },
      {
        q: { en: 'Exhausted mid-water, the best survival move is…', zh: '在水中体力耗尽时，最好的自救方式是？' },
        opts: [
          { en: 'Keep swimming no matter what', zh: '无论如何坚持游' },
          { en: 'Roll onto your back and float to rest', zh: '翻身仰漂，先休息恢复' },
          { en: 'Dunk your head to cool down', zh: '把头埋进水里降温' },
        ],
        answer: 1,
        reason: { en: 'Back-floating rests you and keeps your airway open.', zh: '仰漂能让你休息，同时保持呼吸道畅通。' },
      },
    ],
  },
];

// 双语取值：对象里没有对应语言时回退英文
export function pick(obj, lang) {
  if (obj == null) return '';
  if (typeof obj === 'string') return obj;
  return obj[lang] || obj.en || '';
}

export const LEVEL_COUNT = LEVELS.length;
