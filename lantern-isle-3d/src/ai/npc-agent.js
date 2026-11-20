// runtime/npc-agent.js — 游戏内 AI NPC 的运行期机制：**纯逻辑**（无 DOM/THREE），可 node --test 直接测。
// 分工（照 ChatGPT 路线的契约，落点按平台铁律改）：
//   LLM 只在**构建期**生成人格与语料（config/npc/*.json）；运行期做「意图匹配 → 结构化决策 → 规则校验 → 记忆」，
//   远端 LLM 是可选增强（config.npc.mode==="remote"），失败必须静默降级到离线人格。**永远不许 LLM 写坐标或控制每帧。**
// 结构化输出契约：{ dialogueKey, params, emotion, animation, action, quest_id, source }

export function normalize(s) {
  return String(s || '').toLowerCase().replace(/[。，！？、,.!?~\s]+/g, ' ').trim();
}
/** 意图匹配：profile.intents[].match 支持 any（关键词，任一命中）/ all（全命中）/ regex（字符串） */
export function matchIntent(text, profile) {
  const t = normalize(text);
  if (!t) return null;
  let best = null, bestScore = 0;
  for (const it of profile.intents || []) {
    const m = it.match || {};
    let score = 0;
    if (m.any) {
      const hits = m.any.filter((k) => t.includes(normalize(k)));
      if (!hits.length) continue;
      score += 1 + hits.reduce((a, k) => a + String(k).length, 0) / 100;
    }
    if (m.all) {
      const hits = m.all.filter((k) => t.includes(normalize(k)));
      if (hits.length !== m.all.length) continue;
      score += 2 + hits.length * 0.1;
    }
    if (m.regex) {
      try { if (new RegExp(m.regex, 'i').test(text)) score += 1.5; else if (!m.any && !m.all) continue; } catch { /* 坏正则忽略 */ }
    }
    if (score > bestScore) { bestScore = score; best = it; }
  }
  return best;
}

/** 规则校验层：LLM/意图给的 action 必须过这关，不合法降级为 dialogue_only */
export function validate(structured, rules, state) {
  const out = { ...structured, downgraded: null };
  const ok = (r) => (typeof r === 'function' ? !!r(state) : r !== false);
  if (out.action && out.action !== 'dialogue_only') {
    const ar = (rules.actions || {})[out.action];
    if (!ar) { out.downgraded = 'unknown_action:' + out.action; out.action = 'dialogue_only'; out.quest_id = null; }
    else if (ar.requires && !ok(ar.requires)) { out.downgraded = 'requires:' + out.action; out.action = 'dialogue_only'; out.quest_id = null; }
  }
  if (out.quest_id) {
    const q = (rules.quests || []).find((x) => x.id === out.quest_id);
    if (!q) { out.downgraded = 'unknown_quest:' + out.quest_id; out.quest_id = null; out.action = 'dialogue_only'; }
    else {
      if (q.maxActive && (state.activeQuests || []).length >= q.maxActive) { out.downgraded = 'quest_slots_full'; out.quest_id = null; out.action = 'dialogue_only'; }
      else if (q.alreadyActive && (state.activeQuests || []).includes(q.id)) { out.downgraded = 'quest_active'; out.quest_id = null; out.action = 'continue_quest'; }
      else if (q.done && (state.doneQuests || []).includes(q.id)) { out.downgraded = 'quest_done'; out.quest_id = null; out.action = 'dialogue_only'; }
      else if (q.requires && !ok(q.requires)) { out.downgraded = 'quest_requires:' + q.id; out.quest_id = null; out.action = 'dialogue_only'; }
    }
  }
  if (out.animation && !(rules.animations || ['idle', 'talk', 'walk', 'run', 'jump', 'carry']).includes(out.animation)) out.animation = 'talk';
  if (Number(state.distance) > Number(rules.maxTalkDistance ?? 6)) { out.downgraded = 'too_far'; out.action = 'dialogue_only'; out.quest_id = null; }
  return out;
}

/** 决策：意图 → 结构化结果（含冷却/亲和度） */
export function decide({ profile, text, state = {}, now = 0 }) {
  const dist = state.distance != null ? state.distance : 3;
  if (Number(dist) > Number(profile.maxTalkDistance ?? 6)) {
    return { dialogueKey: profile.id + '.faraway', params: {}, emotion: 'neutral', animation: 'idle', action: 'dialogue_only', quest_id: null, source: 'distance' };
  }
  const intent = matchIntent(text, profile);
  const mem = state.memory || {};
  let chosen = intent;
  if (!chosen && mem.lastTopic) {
    chosen = (profile.intents || []).find((i) => i.id === mem.lastTopic) || null;
    if (chosen) chosen = { ...chosen, fallbackTopic: true };
  }
  if (!chosen) chosen = profile.idleReply ? { id: 'idle', ...profile.idleReply } : (profile.intents || [])[0] || null;
  if (!chosen) return { dialogueKey: profile.id + '.idle', params: {}, emotion: 'neutral', animation: 'talk', action: 'dialogue_only', quest_id: null, source: 'no_corpus' };
  const cd = Number(chosen.cooldownSec || 0);
  const lastAt = (mem.intentAt || {})[chosen.id];
  const throttled = cd > 0 && lastAt != null && now - lastAt < cd;
  const key = (chosen.replyKey || `${profile.id}.${chosen.id}`) + (throttled && chosen.replyCoolKey ? '.' + chosen.replyCoolKey : '');
  const out = {
    dialogueKey: key,
    params: { name: state.playerName || 'traveler', ...(chosen.params || {}) },
    emotion: chosen.emotion || 'neutral',
    animation: chosen.animation || 'talk',
    action: throttled ? 'dialogue_only' : (chosen.action || 'dialogue_only'),
    quest_id: throttled ? null : (chosen.quest_id || null),
    intent: chosen.id,
    affinityDelta: chosen.affinityDelta || 0,
    source: 'offline',
  };
  return validate(out, profile.rules || {}, { ...state, distance: dist });
}

/** NPC 记忆：短期会话 + 长期摘要 + 亲和度；由游戏侧负责持久化（Sdk.save） */
export class NpcMemory {
  constructor(initial = {}) {
    this.affinity = initial.affinity || 0;
    this.lastTopic = initial.lastTopic || null;
    this.intentAt = initial.intentAt || {};
    this.flags = initial.flags || {};
    this.log = (initial.log || []).slice(-8);
  }
  note({ intent, now, questId, kind }) {
    if (intent) { this.lastTopic = intent; this.intentAt[intent] = now; }
    if (questId) this.flags['quest_' + questId] = now;
    this.log.push({ at: Math.round(now), intent: intent || null, quest: questId || null, kind: kind || 'talk' });
    if (this.log.length > 8) this.log.shift();
  }
  addAffinity(d) { this.affinity = Math.max(-3, Math.min(6, this.affinity + (d || 0))); }
  serialize() { return { affinity: this.affinity, lastTopic: this.lastTopic, intentAt: this.intentAt, flags: this.flags, log: this.log }; }
  /** 给对话模板用的短期摘要（离线也能「记得」玩家做过什么） */
  summary() {
    const done = Object.keys(this.flags).filter((k) => this.flags[k]).map((k) => k.replace('quest_', ''));
    return { affinity: this.affinity, done, lastTopic: this.lastTopic, turns: this.log.length };
  }
}
/** 亲和度影响措辞档位：把 profile.repliesByAffinity 选出一个 key 后缀 */
export function affinityTier(affinity) {
  if (affinity >= 4) return 'warm';
  if (affinity >= 1) return 'friendly';
  if (affinity <= -2) return 'cold';
  return 'neutral';
}
