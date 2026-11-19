// 成语题库（自撰）：每档一套 4 字成语 + 自写释义（en/zh 各一条）。
// 成语本身是公共文化知识；释义与难度编排为本作原创。
// difficulty: 1 = 简单（笔画擦除少，分低） 2 = 复杂 3 = 困难（笔画擦得多，分高）

export const DIFFICULTIES = {
  1: { key: 'easy', points: 1.0, timeSec: 15, eraseRatio: 0.22, label: { en: 'Easy', zh: '简单' } },
  2: { key: 'medium', points: 1.5, timeSec: 15, eraseRatio: 0.35, label: { en: 'Medium', zh: '复杂' } },
  3: { key: 'hard', points: 2.0, timeSec: 15, eraseRatio: 0.48, label: { en: 'Hard', zh: '困难' } },
};

export const WAYSTATION_EVERY = 4;  // 每答对 N 题抵达一座驿站
export const HINT_COST_POINTS = 5;  // 每累计 N 基础分得 1 张提示笺
export const STARS = { threeAtSec: 10, twoAtSec: 5 }; // 剩余时间阈值
export const COMBO_MAX_MULT = 2.0;  // 连击封顶倍率

// 成语条目：{ idiom, meaningZh, meaningEn }
export const IDIOMS = {
  1: [
    { idiom: '画蛇添足', meaningZh: '给蛇再画上脚，比喻做了多余的事反而坏事。', meaningEn: 'To overdo something and ruin it by adding what is unnecessary.' },
    { idiom: '守株待兔', meaningZh: '守着树桩等兔子，比喻死守经验不知变通。', meaningEn: 'To wait for luck by a stump instead of adapting.' },
    { idiom: '亡羊补牢', meaningZh: '羊丢了才修羊圈，比喻出问题后及时补救还不算晚。', meaningEn: 'To mend the pen after losing sheep — better late than never.' },
    { idiom: '井底之蛙', meaningZh: '井底的青蛙，比喻眼界狭小的人。', meaningEn: 'A frog at the bottom of a well — a narrow-minded person.' },
    { idiom: '对牛弹琴', meaningZh: '对着牛弹琴，比喻对不懂道理的人白费口舌。', meaningEn: 'To play music to a cow — to waste words on the wrong audience.' },
    { idiom: '狐假虎威', meaningZh: '狐狸借老虎的威风，比喻仗势欺人。', meaningEn: 'A fox borrowing a tiger’s might — to bully via borrowed power.' },
    { idiom: '掩耳盗铃', meaningZh: '捂着耳朵去偷铃铛，比喻自欺欺人。', meaningEn: 'To cover your ears while stealing a bell — self-deception.' },
    { idiom: '刻舟求剑', meaningZh: '在船上刻记号找落水的剑，比喻拘泥固执不知变通。', meaningEn: 'To mark the boat to find a lost sword — rigid and inflexible.' },
    { idiom: '拔苗助长', meaningZh: '把苗拔高帮它长，比喻急于求成反而坏事。', meaningEn: 'To yank seedlings upward — to rush and ruin things.' },
    { idiom: '画龙点睛', meaningZh: '给龙点上眼睛，比喻关键一笔使整体传神。', meaningEn: 'To dot the dragon’s eyes — the finishing touch that brings it alive.' },
    { idiom: '自相矛盾', meaningZh: '自己的矛戳自己的盾，比喻言行前后冲突。', meaningEn: 'One’s spear vs one’s shield — self-contradiction.' },
    { idiom: '滥竽充数', meaningZh: '不会吹竽却混在乐队里，比喻以次充好。', meaningEn: 'To fake playing in the band — to pass off poor work as good.' },
    { idiom: '叶公好龙', meaningZh: '叶公口称爱龙，真龙来了却害怕，比喻口是心非。', meaningEn: 'To claim to love dragons but fear a real one — lip service.' },
    { idiom: '东施效颦', meaningZh: '东施学西施皱眉，比喻盲目模仿反而更丑。', meaningEn: 'To copy a frown clumsily — blind imitation makes it worse.' },
    { idiom: '愚公移山', meaningZh: '愚公坚持挖山，比喻有恒心终能成事。', meaningEn: 'The old man moving a mountain — perseverance wins.' },
    { idiom: '精卫填海', meaningZh: '精卫鸟衔石填海，比喻意志坚定不达目的不止。', meaningEn: 'A bird carrying stones to fill the sea — unyielding will.' },
    { idiom: '夸父追日', meaningZh: '夸父追赶太阳，比喻志向宏大却难以实现。', meaningEn: 'Chasing the sun — a grand but impossible ambition.' },
    { idiom: '卧薪尝胆', meaningZh: '睡柴草尝苦胆，比喻刻苦自励发愤图强。', meaningEn: 'To sleep on brushwood and taste gall — to endure hardship for revenge.' },
    { idiom: '负荆请罪', meaningZh: '背着荆条上门认错，比喻诚恳赔罪。', meaningEn: 'To carry thorns and apologize — sincere admission of fault.' },
    { idiom: '完璧归赵', meaningZh: '把和氏璧完好送回赵国，比喻物归原主。', meaningEn: 'To return the jade intact — to give back what is not yours.' },
  ],
  2: [
    { idiom: '纸上谈兵', meaningZh: '只在纸上空谈用兵，比喻空谈理论不切实际。', meaningEn: 'To fight wars on paper — empty theory, no practice.' },
    { idiom: '指鹿为马', meaningZh: '把鹿说成马，比喻颠倒是非混淆黑白。', meaningEn: 'To call a deer a horse — to distort right and wrong.' },
    { idiom: '望梅止渴', meaningZh: '想到梅子就止渴，比喻用空想自我安慰。', meaningEn: 'To quench thirst by imagining plums — wishful comfort.' },
    { idiom: '草船借箭', meaningZh: '用草船诱敌放箭，比喻用智谋借用他人之力。', meaningEn: 'To borrow arrows with straw boats — winning by wit.' },
    { idiom: '三顾茅庐', meaningZh: '三次拜访茅屋，比喻诚心诚意延请贤才。', meaningEn: 'To visit the thatched hut three times — sincere recruitment.' },
    { idiom: '闻鸡起舞', meaningZh: '听到鸡叫就起身练剑，比喻奋发图强。', meaningEn: 'To rise at the rooster’s call and train — eager diligence.' },
    { idiom: '悬梁刺股', meaningZh: '用绳系梁、用锥刺腿来提神苦读，比喻刻苦学习。', meaningEn: 'To tie hair to a beam and prick a thigh — extreme study discipline.' },
    { idiom: '凿壁偷光', meaningZh: '凿穿墙壁借邻家灯光读书，比喻刻苦求学。', meaningEn: 'To bore a wall for a neighbor’s light — studying against all odds.' },
    { idiom: '程门立雪', meaningZh: '在老师门前雪中等候，比喻尊师重道。', meaningEn: 'To stand in snow at the master’s gate — deep respect for teachers.' },
    { idiom: '破釜沉舟', meaningZh: '砸锅沉船不留退路，比喻下定决心背水一战。', meaningEn: 'To smash pots and sink boats — to burn one’s bridges.' },
    { idiom: '四面楚歌', meaningZh: '四面都是楚人的歌声，比喻陷入孤立无援的绝境。', meaningEn: 'Surrounded by enemy songs — isolated and helpless.' },
    { idiom: '围魏救赵', meaningZh: '围攻魏国来救赵国，比喻绕开正面攻其必救。', meaningEn: 'To besiege Wei to rescue Zhao — an indirect rescue.' },
    { idiom: '声东击西', meaningZh: '表面打东边实际打西边，比喻用假象迷惑对方。', meaningEn: 'To feint east and strike west — misdirection.' },
    { idiom: '调虎离山', meaningZh: '把老虎引离山头，比喻设法使对手离开有利位置。', meaningEn: 'To lure the tiger off the mountain — drawing the foe out.' },
    { idiom: '金蝉脱壳', meaningZh: '金蝉脱去外壳逃走，比喻巧妙脱身留假象。', meaningEn: 'To shed a shell and slip away — a clever escape.' },
    { idiom: '抛砖引玉', meaningZh: '抛出砖头引来美玉，比喻用粗浅引出高见。', meaningEn: 'To cast a brick to draw jade — a modest opener for better ideas.' },
  ],
  3: [
    { idiom: '杯水车薪', meaningZh: '用一杯水去救一车柴的火，比喻力量太小无济于事。', meaningEn: 'A cup of water for a cartload of fire — far too little to help.' },
    { idiom: '大相径庭', meaningZh: '彼此相差很远，形容彼此矛盾或截然不同。', meaningEn: 'Vastly different — poles apart.' },
    { idiom: '登堂入室', meaningZh: '登上厅堂进入内室，比喻学问由浅入深达到高境界。', meaningEn: 'To enter the hall then the inner room — mastery step by step.' },
    { idiom: '筚路蓝缕', meaningZh: '驾柴车穿破衣去开辟山林，形容创业艰辛。', meaningEn: 'To pioneer in rags and a cart — hard-fought beginnings.' },
    { idiom: '举案齐眉', meaningZh: '把食案举到眉高相敬，形容夫妻互敬互爱。', meaningEn: 'To raise the tray to eyebrow level — mutual respect between spouses.' },
    { idiom: '洛阳纸贵', meaningZh: '洛阳的纸因传抄而涨价，比喻著作广为流传。', meaningEn: 'Paper dear in Luoyang — a work everyone copies.' },
    { idiom: '门庭若市', meaningZh: '门前热闹像集市，形容来客众多。', meaningEn: 'A doorway like a market — a busy, popular house.' },
    { idiom: '明日黄花', meaningZh: '过了时节的菊花，比喻过时的事物。', meaningEn: 'Chrysanthemums past their prime — something out of date.' },
    { idiom: '噤若寒蝉', meaningZh: '像寒天的蝉不敢出声，形容吓得不敢说话。', meaningEn: 'Silent as a winter cicada — too scared to speak.' },
    { idiom: '孤注一掷', meaningZh: '把全部赌注押在一把上，比喻危急时倾尽全力一搏。', meaningEn: 'To stake everything on one throw — a last desperate gamble.' },
    { idiom: '泾渭分明', meaningZh: '泾水渭水清浊不同，比喻界限清楚是非分明。', meaningEn: 'As distinct as two rivers — a clear, sharp boundary.' },
    { idiom: '走马观花', meaningZh: '骑马看花匆匆而过，比喻观察粗略不深入。', meaningEn: 'To view flowers from a galloping horse — a cursory look.' },
    { idiom: '未雨绸缪', meaningZh: '下雨前先修好门窗，比喻事先做好准备。', meaningEn: 'To mend the house before rain — to prepare in advance.' },
    { idiom: '相得益彰', meaningZh: '互相配合更能显出各自长处。', meaningEn: 'To bring out the best in each other by working together.' },
    { idiom: '韬光养晦', meaningZh: '隐藏锋芒积蓄力量，比喻低调等待时机。', meaningEn: 'To hide one’s light and bide time.' },
    { idiom: '偃旗息鼓', meaningZh: '收起旗帜停止击鼓，比喻停止行动或休战。', meaningEn: 'To lower flags and still drums — to halt or retreat quietly.' },
  ],
};

export function idiomsForDifficulty(d) {
  return IDIOMS[d] || IDIOMS[1];
}
