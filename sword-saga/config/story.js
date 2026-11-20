// config/story.js — 《云隐剑歌》原创仙侠短篇剧情（en/zh 双语，每章 ≤8 句对白）
// 纯数据：who = 说话人（hero/fox/elder/boss/narrator/stranger），text = { en, zh }。
// 全 IP 原创：无任何原作人名/地名。

export const STORY = {
  1: {
    scene: 1,
    npc: [
      { who: 'elder', en: 'The forest grows restless, young sword. A bamboo wraith prowls the east path.', zh: '少侠，竹林躁动不安，一只竹妖在东边小径游荡。' },
      { who: 'hero', en: 'Then my blade will quiet it.', zh: '那就让我的剑去让它安静。' },
    ],
    opening: [
      { who: 'narrator', en: 'Yun Jian, a wandering sword, crosses into the Green Bamboo Forest with his spirit fox.', zh: '游历剑客云隐，与灵狐一同踏入青竹林。' },
      { who: 'fox', en: 'A foul smell rides the wind. An enemy waits ahead.', zh: '风里有股腥气，前面有敌。' },
      { who: 'hero', en: 'Good. Let us learn its element, then strike true.', zh: '正好。看准它的五行，一击制敌。' },
    ],
    closing: [
      { who: 'hero', en: 'The wraith is ash. The path east is open.', zh: '竹妖已散，东路已开。' },
      { who: 'fox', en: 'Do not sheathe your blade yet. The forest has many eyes.', zh: '先别收剑，这林子里还有别的眼睛。' },
    ],
  },
  2: {
    scene: 1,
    npc: [
      { who: 'elder', en: 'Two wraiths now guard the glade. Divide them, or fall together.', zh: '如今两只竹妖守着林间空地。要么分而击之，要么一并倒下。' },
    ],
    opening: [
      { who: 'narrator', en: 'Deeper in the bamboo, the shadows move in pairs.', zh: '竹林深处，阴影成双而动。' },
      { who: 'fox', en: 'Two of them. Water will not help you here — use your metal.', zh: '有两只。这里水不顶用——用你的金。' },
      { who: 'hero', en: 'Metal breaks wood. I remember.', zh: '金克木，我记得。' },
    ],
    closing: [
      { who: 'fox', en: 'That is the last of the glade wraiths.', zh: '这是空地里的最后一只了。' },
      { who: 'hero', en: 'The mountain path calls. We move north.', zh: '山路在召唤，我们向北。' },
    ],
  },
  3: {
    scene: 1,
    npc: [
      { who: 'elder', en: 'Embers drift from the north. Ash mites, born of wildfire, block the pass.', zh: '北方飘来火星。野火生出的烬虫挡住了山口。' },
    ],
    opening: [
      { who: 'narrator', en: 'The bamboo thins. Fire-scarred stones mark the way to the Snow Mountain Pass.', zh: '竹林渐疏，被火燎过的山石指向雪山道。' },
      { who: 'fox', en: 'Ash mites burn with fire. My rime will drown them — let me take the lead.', zh: '烬虫身上带着火。我的凝霜能浇灭它们——让我来。' },
      { who: 'hero', en: 'Water quells fire. Stand forward, Linghu.', zh: '水能克火。上前，灵狐。' },
    ],
    closing: [
      { who: 'hero', en: 'The embers are cold. You fought well, little flame.', zh: '火星已冷。打得漂亮，小火焰。' },
      { who: 'fox', en: 'Flame against flame is wasteful. Rime is the answer.', zh: '以火对火是浪费，凝霜才是答案。' },
    ],
  },
  4: {
    scene: 1,
    npc: [
      { who: 'elder', en: 'The Bamboo King stirs. End his root, and the forest will sleep.', zh: '竹王苏醒了。斩断他的根，这竹林才能安睡。' },
    ],
    opening: [
      { who: 'narrator', en: 'The heart of the forest is a grove older than memory. Its king rises to meet them.', zh: '竹林之心是一片比记忆更古老的林地，竹王起身相迎。' },
      { who: 'hero', en: 'A king of wood. My blade was forged for this.', zh: '木中之王。我的剑正是为此而铸。' },
      { who: 'fox', en: 'Strike with metal, and do not hold back.', zh: '以金击之，别留手。' },
    ],
    closing: [
      { who: 'narrator', en: 'The Bamboo King falls, and the forest exhales. Beyond it, the snow waits.', zh: '竹王倒下，竹林吐出一口长气。山外，风雪在等待。' },
      { who: 'hero', en: 'One realm cleansed. Two remain.', zh: '一境已净，尚余两境。' },
    ],
  },
  5: {
    scene: 2,
    npc: [
      { who: 'stranger', en: 'The pass is white with snow and fang. Snow whelps hunt in pairs.', zh: '山口雪白，雪中有牙。雪崽成对出没。' },
    ],
    opening: [
      { who: 'narrator', en: 'Snow swallows the world. The Snow Mountain Pass is a blade of white.', zh: '大雪吞没天地，雪山道如一道白刃。' },
      { who: 'fox', en: 'Cold things hunt us. Stay close to the fire in my tail.', zh: '有冰冷之物在猎我们。靠近我尾巴的火。' },
      { who: 'hero', en: 'Earth will answer water. I will show them stone.', zh: '土能应水。我会让他们见识山石。' },
    ],
    closing: [
      { who: 'hero', en: 'The snow runs red, then white again.', zh: '雪染红又复白。' },
      { who: 'fox', en: 'And we climb higher still.', zh: '而我们还要继续向上。' },
    ],
  },
  6: {
    scene: 2,
    npc: [
      { who: 'stranger', en: 'Stone wards block the ridge. Break them, or turn back into the storm.', zh: '石卫挡住了山脊。击碎它们，或退回风雪。' },
    ],
    opening: [
      { who: 'narrator', en: 'The ridge is guarded by things of living rock and a snow whelp.', zh: '山脊由活岩之物与一只雪崽守卫。' },
      { who: 'fox', en: 'Rock is stubborn. Wood will splinter it — my vines are ready.', zh: '石头顽固。木能裂它——我的藤蔓已经就绪。' },
    ],
    closing: [
      { who: 'hero', en: 'The ridge is ours. The tower is near.', zh: '山脊已在我们脚下，塔近了。' },
      { who: 'fox', en: 'I can feel it. Something old and cold is watching.', zh: '我能感觉到，有古老而冰冷的东西在看着。' },
    ],
  },
  7: {
    scene: 2,
    npc: [
      { who: 'stranger', en: 'Metal imps skitter on the ice. Their kind fears the true flame.', zh: '金妖在冰上吱吱乱窜。这种东西惧怕真火。' },
    ],
    opening: [
      { who: 'narrator', en: 'The snow thins to black ice. Metal imps and a stone ward bar the way.', zh: '雪渐薄成黑冰。金妖与石卫拦住了去路。' },
      { who: 'fox', en: 'Metal fears fire. My foxfire will melt their shells.', zh: '金怕火。我的狐火会熔掉它们的壳。' },
    ],
    closing: [
      { who: 'hero', en: 'The ice is littered with their husks. Forward.', zh: '冰面上散落着它们的壳。前进。' },
    ],
  },
  8: {
    scene: 2,
    npc: [
      { who: 'stranger', en: 'The Snow Mother rules this peak. Bring fire, or bring nothing.', zh: '雪母统治此峰。带来火，否则什么都别带。' },
    ],
    opening: [
      { who: 'narrator', en: 'At the peak, the Snow Mother uncoils — a storm with a beating heart.', zh: '山巅之上，雪母舒展开来——一场有心跳的风暴。' },
      { who: 'fox', en: 'She is water given shape. Meet her with stone and flame.', zh: '她是水凝成的形。以石与火应她。' },
      { who: 'hero', en: 'Then let us end winter itself.', zh: '那就让我们终结这冬天。' },
    ],
    closing: [
      { who: 'narrator', en: 'The Snow Mother shatters into a thousand quiet flakes. The peak is silent.', zh: '雪母碎成千万片寂静的雪花，山巅归于无声。' },
      { who: 'hero', en: 'Two realms cleansed. The tower remains.', zh: '两境已净，只剩高塔。' },
    ],
  },
  9: {
    scene: 3,
    npc: [
      { who: 'stranger', en: 'Beyond this gate lies the Spirit-Lock Tower. Metal imps guard its throat.', zh: '此门之后便是锁妖塔。金妖守着塔的咽喉。' },
    ],
    opening: [
      { who: 'narrator', en: 'The Spirit-Lock Tower rises purple-black against a starless sky.', zh: '锁妖塔紫黑耸立，顶着无星之天。' },
      { who: 'fox', en: 'Metal demons, cold and cruel. Fire will be our torch.', zh: '金铸的妖，又冷又狠。火就是我们的火把。' },
    ],
    closing: [
      { who: 'hero', en: 'The throat is cleared. We descend.', zh: '咽喉已通，我们下行。' },
    ],
  },
  10: {
    scene: 3,
    npc: [
      { who: 'stranger', en: 'Three of them now — mite, ward, and imp. Split them or perish.', zh: '这次有三个——烬虫、石卫、金妖。分而击之，否则必死。' },
    ],
    opening: [
      { who: 'narrator', en: 'The tower tests them with a swarm of its most vicious wardens.', zh: '高塔派出最凶的狱卒，成队试炼他们。' },
      { who: 'fox', en: 'Three at once. We fight as one, or not at all.', zh: '一次三个。我们并肩，否则一无所有。' },
    ],
    closing: [
      { who: 'hero', en: 'The wardens fall. The tower trembles.', zh: '狱卒尽数倒下，高塔为之颤抖。' },
    ],
  },
  11: {
    scene: 3,
    npc: [
      { who: 'stranger', en: 'The final gate is sealed. Break the last wardens and pass.', zh: '最后一道门被封印。击碎最后的狱卒，方能通过。' },
    ],
    opening: [
      { who: 'narrator', en: 'The deepest vault is guarded by imp, ward, and mite in a ring of hate.', zh: '最深的穹顶下，金妖、石卫与烬虫以恨意结成环。' },
      { who: 'hero', en: 'This is the last wall before the demon.', zh: '这是魔前的最后一堵墙。' },
      { who: 'fox', en: 'Break it, and we face what waits below.', zh: '击碎它，我们便直面深渊之物。' },
    ],
    closing: [
      { who: 'hero', en: 'The ring is broken. Only the demon remains.', zh: '环已破，只剩那魔。' },
    ],
  },
  12: {
    scene: 3,
    npc: [
      { who: 'stranger', en: 'The Tower Demon sits on a throne of rusted blades. End the saga, or end here.', zh: '塔魔端坐于锈剑之座。了结这段传奇，或在此了结。' },
    ],
    opening: [
      { who: 'narrator', en: 'At the tower’s heart, the Tower Demon waits, crowned in rust and shadow.', zh: '高塔之心，塔魔静候，头戴锈与影之冠。' },
      { who: 'hero', en: 'This ends now.', zh: '此刻了结。' },
      { who: 'fox', en: 'Then let the song of the cloud-hidden sword be sung one last time.', zh: '那就让云隐剑歌，最后再唱一次。' },
    ],
    closing: [
      { who: 'narrator', en: 'The demon falls, and the tower’s shadow lifts. The sword song is complete.', zh: '魔倒，塔影散去。剑歌终成。' },
      { who: 'hero', en: 'The three realms are free.', zh: '三境皆得自由。' },
    ],
  },
};
