// config/npc.js — 三个岛民的人格与**构建期生成的对话语料**（运行期只走意图匹配 + 规则校验 + 记忆）。
// 每个 intent 的 replyKey 必须在 config/locales.js 的 en 与 zh 都存在（i18n-check 会查）。
// 文案 key 与措辞由 AI 在开发期产出，运行期零网络请求、断网可玩。

export const NPC_PROFILES = {
  warden: {
    id: 'warden',
    nameKey: 'warden',
    persona: { background: '守了十九年灯塔', occupation: 'warden', speakingStyle: '短句、务实、不安慰人' },
    model: 'npc_warden',
    maxTalkDistance: 6,
    choices: ['oil', 'wind', 'tower', 'thanks'],
    intents: [
      { id: 'greet', match: { any: ['hi', 'hello', 'hey', '你好', '在吗'] }, replyKey: 'warden.greet', emotion: 'neutral', animation: 'talk', affinityDelta: 0, cooldownSec: 12 },
      {
        id: 'oil', match: { any: ['oil', 'drum', '油', '桶'] }, replyKey: 'warden.oil_offer', replyCoolKey: 'cool', emotion: 'worried',
        animation: 'talk', action: 'offer_quest', quest_id: 'collect_oil', affinityDelta: 1, cooldownSec: 22,
      },
      { id: 'oil_have', match: { any: ['brought', '拿到了', '带来了'] }, replyKey: 'warden.oil_have', emotion: 'neutral', animation: 'talk' },
      { id: 'wind', match: { any: ['wind', 'gust', 'storm', '风', '风暴'] }, replyKey: 'warden.warn', emotion: 'worried', animation: 'talk', affinityDelta: 0 },
      { id: 'tower', match: { any: ['tower', 'lighthouse', 'big', '塔', '灯塔', '大灯'] }, replyKey: 'warden.tower', emotion: 'neutral', animation: 'talk' },
      { id: 'thanks', match: { any: ['thanks', 'thank', '谢谢'] }, replyKey: 'warden.thanks', emotion: 'warm', animation: 'talk', affinityDelta: 1 },
      { id: 'dark', match: { any: ['dark', '黑', '岸'] }, replyKey: 'warden.dark', emotion: 'cold', animation: 'talk' },
    ],
    idleReply: { replyKey: 'warden.idle', emotion: 'neutral', animation: 'talk' },
    quests: [
      { id: 'collect_oil', requiresNight: 1 },
      { id: 'deliver_lantern', requiresNight: 1 },
      { id: 'find_glass', requiresNight: 3 },
    ],
    reactions: [
      { event: 'gust', replyKey: 'warden.warn', cooldownSec: 20 },
      { event: 'lantern_out', replyKey: 'warden.dark', cooldownSec: 30 },
    ],
  },
  netmender: {
    id: 'netmender',
    nameKey: 'netmender',
    persona: { background: '补网人，全岛的闲话都过她的手', occupation: 'net-mender', speakingStyle: '长句、爱打比方、算得清' },
    model: 'npc_netmender',
    maxTalkDistance: 6,
    choices: ['lantern', 'gossip', 'glass', 'price'],
    intents: [
      { id: 'greet', match: { any: ['hi', 'hello', 'saba', '你好', '萨芭'] }, replyKey: 'netmender.greet', emotion: 'warm', animation: 'talk' },
      {
        id: 'lantern', match: { any: ['lantern', 'lamp', 'light', '灯', '点灯'] }, replyKey: 'netmender.lantern_offer', replyCoolKey: 'lantern_have',
        emotion: 'neutral', animation: 'talk', action: 'offer_quest', quest_id: 'deliver_lantern', affinityDelta: 1, cooldownSec: 20,
      },
      { id: 'gossip', match: { any: ['where', 'gossip', '哪', '闲话', '消息', '油桶'] }, replyKey: 'netmender.gossip', emotion: 'happy', animation: 'talk' },
      { id: 'glass', match: { any: ['glass', 'pip', 'storm glass', '杯子', '皮普', '风暴杯'] }, replyKey: 'netmender.glass', emotion: 'worried', animation: 'talk' },
      { id: 'price', match: { any: ['pay', 'coin', '钱', '报酬', '给多少'] }, replyKey: 'netmender.price', emotion: 'cold', animation: 'talk' },
    ],
    idleReply: { replyKey: 'netmender.idle', emotion: 'neutral', animation: 'talk' },
    quests: [
      { id: 'deliver_lantern', requiresNight: 1 },
      { id: 'collect_oil', requiresNight: 1 },
      { id: 'find_glass', requiresNight: 3 },
    ],
    reactions: [{ event: 'night_start', replyKey: 'netmender.greet', cooldownSec: 40 }],
  },
  lampchild: {
    id: 'lampchild',
    nameKey: 'lampchild',
    persona: { background: '灯童，把风暴杯弄丢了不敢回去拿', occupation: 'child', speakingStyle: '孩子气、跳话题、诚实' },
    model: 'npc_lampchild',
    maxTalkDistance: 5,
    choices: ['lost', 'scared', 'oil', 'play'],
    intents: [
      { id: 'greet', match: { any: ['hi', 'hello', 'pip', '你好', '皮普'] }, replyKey: 'lampchild.greet', emotion: 'happy', animation: 'talk' },
      {
        id: 'lost', match: { any: ['lost', 'glass', 'drop', '丢', '杯子', '找到'] }, replyKey: 'lampchild.lost_offer', replyCoolKey: 'lost_have',
        emotion: 'worried', animation: 'talk', action: 'offer_quest', quest_id: 'find_glass', affinityDelta: 1, cooldownSec: 18,
      },
      { id: 'scared', match: { any: ['scared', 'afraid', 'cliff', '怕', '崖'] }, replyKey: 'lampchild.scared', emotion: 'worried', animation: 'talk' },
      {
        id: 'oil', match: { any: ['oil', 'give', '油', '给'] }, replyKey: 'lampchild.oil', emotion: 'warm', animation: 'talk',
        action: 'give_item', requiresAffinity: 1, affinityDelta: 1,
      },
      { id: 'play', match: { any: ['race', 'play', '跑', '玩', '比一场'] }, replyKey: 'lampchild.play', emotion: 'happy', animation: 'talk' },
    ],
    idleReply: { replyKey: 'lampchild.idle', emotion: 'neutral', animation: 'talk' },
    quests: [
      { id: 'find_glass', requiresNight: 3 },
      { id: 'deliver_lantern', requiresNight: 1 },
      { id: 'collect_oil', requiresNight: 1 },
    ],
    reactions: [{ event: 'gust', replyKey: 'lampchild.scared', cooldownSec: 25 }],
  },
};
export default NPC_PROFILES;
