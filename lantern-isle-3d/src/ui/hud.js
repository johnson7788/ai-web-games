// src/ui/hud.js — DOM 层：屏切换、HUD、提示条、播报、对话面板、首次交互引导（高亮真实 UI + 要求真实动作）。
// 引导不是说明书：每一步都必须玩家真的做一次动作才前进，可跳过、可重看、同一存档只自动弹一次。
import { CONFIG } from '../../config/game.config.js';

const $ = (id) => document.getElementById(id);
const SCREENS = ['screen-title', 'screen-pause', 'screen-dialog', 'screen-result', 'screen-help', 'screen-shop'];

export function createUI(api) {
  const els = {
    hud: $('hud'), touch: $('touch'), prompt: $('prompt'), promptKey: $('prompt-key'), promptText: $('prompt-text'),
    toast: $('toast'), ring: $('lighting-ring'), ringFill: $('lighting-fill'), wind: $('hud-wind'), goal: $('goal'), goalText: $('goal-text'), goalArrow: $('goal-arrow'), windArrow: document.querySelector('.wind-arrow'), windText: $('wind-text'),
    night: $('hud-night'), lamps: $('hud-lamps'), oil: $('hud-oil'), score: $('hud-score'), time: $('hud-time'), barTime: $('bar-time'),
    weight: $('hud-weight'), barWeight: $('bar-weight'), best: $('title-best'),
    tut: $('tutorial'), tutStep: $('tut-step'), tutText: $('tut-text'), tutHalo: $('tut-halo'), tutReplay: $('tut-replay'),
    dlgName: $('dlg-name'), dlgText: $('dlg-text'), dlgMood: $('dlg-mood'), dlgChoices: $('dlg-choices'), dlgInput: $('dlg-input'),
    resTitle: $('res-title'), resLines: $('res-lines'), resUpgrades: $('res-upgrades'), btnAgain: $('btn-again'),
    loading: $('loading'), mute: $('btn-mute'),
  };
  const t = api.t;
  let current = 'title';

  function showScreen(name) {
    current = name;
    for (const s of SCREENS) {
      const el = $(s);
      if (!el) continue;
      const on = s === (name === 'playing' || name === 'tutorial' ? null : 'screen-' + name);
      el.classList.toggle('hidden', !on);
      el.classList.toggle('is-active', on);
    }
    els.hud.classList.toggle('hidden', !(name === 'playing' || name === 'tutorial' || name === 'dialog'));
    if (els.touch) els.touch.classList.toggle('hidden', !(api.isTouch() && (name === 'playing' || name === 'tutorial')));
    if (name === 'title') els.best.textContent = api.getBest();
  }
  function bind() {
    $('btn-start').addEventListener('click', () => api.onStart());
    $('btn-resume').addEventListener('click', () => api.onResume());
    $('btn-restart').addEventListener('click', () => api.onRestart());
    $('btn-next').addEventListener('click', () => api.onNext());
    $('btn-again').addEventListener('click', () => api.onAgain());
    $('btn-how').addEventListener('click', () => { api.renderHelp(); showScreen('help'); });
    $('btn-help').addEventListener('click', () => { api.renderHelp(); showScreen('help'); });
    $('btn-help-close').addEventListener('click', () => showScreen(api.afterHelp()));
    $('btn-upgrades').addEventListener('click', () => { api.renderShop(); showScreen('shop'); });
    $('btn-shop-close').addEventListener('click', () => showScreen(api.afterHelp()));
    $('dlg-close').addEventListener('click', () => api.onDialogClose());
    $('dlg-send').addEventListener('click', () => api.onSend(els.dlgInput.value));
    els.dlgInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') api.onSend(els.dlgInput.value); e.stopPropagation(); });
    $('tut-skip').addEventListener('click', () => api.onSkipTutorial());
    for (const id of ['btn-tut', 'btn-tut-pause', 'btn-howto']) {
      const el = $(id);
      if (el) el.addEventListener('click', () => api.onReplayTutorial());
    }
    els.tutReplay.addEventListener('click', () => api.onReplayTutorial());
    $('btn-mute').addEventListener('click', () => {
      const m = api.onToggleMute();
      els.mute.classList.toggle('off', m);
      els.mute.textContent = m ? '🔇' : '♪';
    });
    for (const sel of ['lang-select', 'lang-select-pause']) {
      const el = $(sel);
      if (!el) continue;
      el.addEventListener('change', () => api.onLang(el.value));
    }
  }
  function fillLang() {
    for (const sel of ['lang-select', 'lang-select-pause']) {
      const el = $(sel);
      if (!el) continue;
      el.innerHTML = '';
      for (const code of CONFIG.languages) {
        const o = document.createElement('option');
        o.value = code;
        o.textContent = (CONFIG.langNames && CONFIG.langNames[code]) || code;
        el.appendChild(o);
      }
      el.value = api.lang();
    }
  }
  function setHud(s) {
    els.night.textContent = s.night + '/' + CONFIG.levels.length;
    els.lamps.textContent = s.lit + '/' + s.stations;
    els.oil.textContent = s.oil;
    els.score.textContent = s.score;
    const sec = Math.max(0, Math.ceil(s.timeLeft));
    els.time.textContent = Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0');
    const total = CONFIG.levels[s.night - 1].durationSec;
    els.barTime.style.width = Math.max(0, Math.min(100, (s.timeLeft / total) * 100)) + '%';
    els.weight.textContent = s.weight + '/' + s.capacity;
    els.barWeight.style.width = Math.max(0, Math.min(100, (s.weight / Math.max(1, s.capacity)) * 100)) + '%';
    if (s.goal && els.goal) {
      els.goal.classList.remove('hidden');
      els.goalText.textContent = (api.lang() === 'zh' ? '下一盏灯 ' : 'Next lamp ') + Math.round(s.goal.dist) + 'm' + (s.goal.big ? (api.lang() === 'zh' ? '（要大灯）' : ' (big)') : '');
      const ang = Math.atan2(s.goal.x - s.player.x, s.goal.z - s.player.z) * 180 / Math.PI - (s.camYaw || 0) * 180 / Math.PI;
      els.goalArrow.style.transform = 'rotate(' + (-ang).toFixed(0) + 'deg)';
    } else if (els.goal) els.goal.classList.add('hidden');
    if (s.gust > 0) {
      els.wind.classList.add('gust');
      els.windText.textContent = t('wind_gust');
      if (els.windArrow) els.windArrow.style.transform = 'rotate(' + (s.windDir * 180 / Math.PI).toFixed(0) + 'deg)';
    } else {
      els.wind.classList.remove('gust');
      els.windText.textContent = t('wind_calm');
    }
    if (s.lighting) {
      els.ring.classList.remove('hidden');
      els.ringFill.style.width = Math.min(100, (s.lighting.t / s.lighting.need) * 100) + '%';
    } else els.ring.classList.add('hidden');
  }
  function setPrompt(kind, key, text) {
    if (!kind) { els.prompt.classList.add('hidden'); return; }
    els.prompt.classList.remove('hidden');
    els.promptKey.textContent = key;
    els.promptText.textContent = text;
  }
  let toastTimer = null;
  function toast(key, kind = '') {
    const el = document.createElement('span');
    el.className = kind;
    el.textContent = t(key);
    els.toast.appendChild(el);
    while (els.toast.childNodes.length > 3) els.toast.removeChild(els.toast.firstChild);
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { els.toast.innerHTML = ''; }, 2600);
  }
  function dialog(npc, reply) {
    els.dlgName.textContent = npc.id === 'warden' ? t('warden') === 'warden' ? 'Warden' : npc.name : npcDisplayName(npc.id);
    els.dlgText.textContent = t(reply.dialogueKey);
    els.dlgMood.textContent = t('mood_' + (reply.emotion || 'neutral'));
    els.dlgChoices.innerHTML = '';
    for (const ch of npc.choices || []) {
      const intent = (npc.intents || []).find((i) => i.id === ch);
      if (!intent) continue;
      const b = document.createElement('button');
      b.className = 'choice';
      b.dataset.choice = ch;
      const label = document.createElement('b');
      label.textContent = choiceLabel(ch);
      const small = document.createElement('small');
      small.textContent = t(intent.replyKey || (npc.id + '.' + ch));
      b.appendChild(label);
      b.appendChild(small);
      b.addEventListener('click', () => api.onChoice(npc.id, ch));
      els.dlgChoices.appendChild(b);
    }
    showScreen('dialog');
  }
  function npcDisplayName(id) {
    return { warden: id === 'warden' ? 'Warden' : id, netmender: 'Saba', lampchild: 'Pip' }[id] || id;
  }
  function choiceLabel(id) {
    const map = {
      oil: ['about oil', '说说油'], wind: ['the wind', '风'], tower: ['the tower', '主塔'], thanks: ['thanks', '谢了'],
      greet: ['hello', '打招呼'], lantern: ['a lantern', '借盏灯'], gossip: ['gossip', '听听消息'], glass: ['storm glass', '风暴杯'],
      price: ['your price', '报酬'], lost: ['you lost it', '你丢的东西'], scared: ['scared', '害怕'], play: ['race', '比一场'],
    };
    const v = map[id] || [id, id];
    return api.lang() === 'zh' ? v[1] : v[0];
  }
  function closeDialog() { showScreen('playing'); }
  // ---------------- 引导 ----------------
  const TUT = [
    { key: 'tut_1', check: (s) => s.player.path !== CONFIG.levels[s.night - 1].spawn.x.toFixed(1) + ',' + CONFIG.levels[s.night - 1].spawn.z.toFixed(1), halo: null, next: 'tut_1_done' },
    { key: 'tut_2', check: (s) => s.carried.length > 0, halo: els.prompt },
    { key: 'tut_3', check: (s) => s.lit > 0, halo: els.ring },
    { key: 'tut_4', check: (s) => s.stats.interactions > 0, halo: null },
  ];
  const tut = {
    active: false, step: 0,
    start() {
      this.active = true; this.step = 0;
      els.tut.classList.remove('hidden');
      this.render();
    },
    render() {
      if (!this.active) return;
      const s = TUT[Math.min(this.step, TUT.length - 1)];
      els.tutStep.textContent = (this.step + 1) + '/' + TUT.length;
      els.tutText.innerHTML = t(s.key);
      if (s.halo) {
        const r = s.halo.getBoundingClientRect();
        const box = $('game-container').getBoundingClientRect();
        els.tutHalo.style.left = (r.left - box.left - 8) + 'px';
        els.tutHalo.style.top = (r.top - box.top - 8) + 'px';
        els.tutHalo.style.width = (r.width + 16) + 'px';
        els.tutHalo.style.height = (r.height + 16) + 'px';
        els.tutHalo.classList.add('on');
      } else els.tutHalo.classList.remove('on');
    },
    advance() {
      this.step++;
      if (this.step >= TUT.length) { this.finish(); return false; }
      this.render();
      return true;
    },
    check(snap) {
      if (!this.active) return false;
      const s = TUT[this.step];
      try { return !!s.check(snap); } catch { return false; }
    },
    skip() { this.finish(); },
    // 只收起覆盖层，不回调（避免 skip → finish → onTutorialDone → finishTutorial 递归）
    hide() {
      this.active = false;
      els.tut.classList.add('hidden');
      els.tutHalo.classList.remove('on');
      if (els.tutReplay) els.tutReplay.classList.remove('hidden');
    },
    finish() {
      this.hide();
      if (typeof api.onTutorialDone === 'function') api.onTutorialDone();
    },
  };
  function tutorialState() { return { active: tut.active, step: tut.step, skip: () => tut.skip() }; }
  function renderHelp() {
    const ul = $('help-list');
    ul.innerHTML = '';
    for (let i = 1; i <= 6; i++) {
      const li = document.createElement('li');
      li.innerHTML = t('help_' + i);
      ul.appendChild(li);
    }
    const card = document.querySelector('#screen-title .subtitle');
    if (card) card.textContent = t('subtitle');
    $('title-text').textContent = t('title');
    $('btn-start').textContent = t('start');
    $('btn-resume').textContent = t('resume');
    $('pause-title').textContent = t('paused');
    $('btn-restart').textContent = t('restart');
    $('btn-how').textContent = t('how');
    $('btn-upgrades').textContent = t('upgrades');
    for (const id of ['btn-tut', 'btn-tut-pause', 'tut-replay']) { const el = $(id); if (el) el.textContent = t('replay'); }
    $('btn-next').textContent = t('next_night');
    $('btn-again').textContent = t('again');
    $('dlg-send').textContent = t('send');
    $('dlg-close').textContent = t('leave');
    $('tut-skip').textContent = t('skip');
    $('loading').querySelector('span').textContent = t('loading');
    document.querySelectorAll('.badge').forEach((b) => { b.textContent = t(b.dataset.i18n); });
    document.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
    document.querySelectorAll('[data-i18n-title]').forEach((el) => { el.title = t(el.dataset.i18nTitle); });
    document.querySelectorAll('[data-i18n-ph]').forEach((el) => { el.placeholder = t(el.dataset.i18nPh); });
    els.dlgInput.placeholder = t('ask_hint');
  }
  function renderShop() {
    const box = $('shop-list');
    box.innerHTML = '';
    const owned = api.getUpgrades();
    for (const u of CONFIG.upgrades) {
      const d = document.createElement('div');
      d.className = 'shop-item' + (owned.includes(u.id) ? ' owned' : '');
      d.dataset.upgrade = u.id;
      d.innerHTML = '<b>' + t('up_' + u.id) + '</b><span>' + t('upd_' + u.id) + '</span>' + (owned.includes(u.id) ? '<small>' + t('shop_owned') + '</small>' : '');
      if (!owned.includes(u.id)) d.addEventListener('click', () => { api.onBuy(u.id); renderShop(); });
      box.appendChild(d);
    }
  }
  function result(s) {
    const win = s.outcome && s.outcome.win;
    els.resTitle.textContent = win ? (s.night >= CONFIG.levels.length ? t('game_done') : t('night_done')) : t('night_failed');
    els.resLines.innerHTML = '';
    const rows = [
      [t('res_lamps'), s.lit + '/' + s.stations],
      [t('res_oil_left'), s.oil],
      [t('res_lost'), s.dropped + s.darkSegments],
      [t('res_time_bonus'), win ? '+' + s.outcome.timeBonus : '—'],
      [t('res_dark_penalty'), win ? '-' + s.outcome.darkPenalty : '—'],
      [t('res_total'), s.totalScore],
      [t('res_best'), s.best],
      [t('res_quests'), s.quests.done.length],
    ];
    if (!win) rows.push([t('night_failed'), t('res_storm_reason')]);
    for (const [k, v] of rows) {
      const li = document.createElement('li');
      if (String(k) === t('res_storm_reason')) li.className = 'bad';
      li.innerHTML = '<span>' + k + '</span><b>' + v + '</b>';
      els.resLines.appendChild(li);
    }
    const goNext = win && s.night < CONFIG.levels.length;
    $('btn-next').classList.toggle('hidden', !goNext);
    els.btnAgain.classList.toggle('hidden', goNext);
    renderShop();
    els.resUpgrades.innerHTML = '';
    showScreen('result');
  }
  bind();
  fillLang();
  renderHelp();
  return { showScreen, setHud, setPrompt, toast, dialog, closeDialog, tutorial: tut, tutorialState, renderHelp, renderShop, result, fillLang, current: () => current, els };
}
