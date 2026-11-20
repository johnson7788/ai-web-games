// src/ui/screens.js — MARRY RICH · 屏幕 DOM：标题 / 玩法 / 暂停 / 结局 / 设置。
// 剧情文本渲染也在这（从 config/story.js 与 config/endings.js 按 i18n.lang 取文）。
import { t } from '../core/i18n.js';
import { getNode } from '../../config/story.js';
import { endingById } from '../../config/endings.js';

function el(tag, className, html) {
  const n = document.createElement(tag);
  if (className) n.className = className;
  if (html != null) n.innerHTML = html;
  return n;
}

function getOrCreate(root, id, className) {
  let n = root.querySelector('#' + id);
  if (!n) {
    n = document.createElement('div');
    n.id = id;
    root.appendChild(n);
  }
  n.className = className;
  return n;
}

const LANG_HTML = (id) => `<select id="${id}" class="lang-select" aria-label=""></select>`;

export function createScreens(root) {
  // ---- 标题屏 ----
  const title = getOrCreate(root, 'screen-title', 'screen');
  title.innerHTML =
    '<div class="title-inner">' +
      '<div class="title-logo" data-i18n="title.logo"></div>' +
      '<div class="title-tagline" data-i18n="title.tagline"></div>' +
      '<div class="title-best" id="title-best"></div>' +
      '<div class="title-actions">' +
        '<button id="btn-start" class="btn btn-primary" type="button" data-i18n="btn.start"></button>' +
        '<button id="btn-how" class="btn btn-ghost" type="button" data-tutorial-replay data-i18n="btn.how"></button>' +
        '<button id="btn-settings" class="btn btn-ghost" type="button" data-i18n="btn.settings"></button>' +
      '</div>' +
    '</div>' +
    LANG_HTML('lang-select');

  // ---- 玩法屏 ----
  const play = getOrCreate(root, 'screen-play', 'screen hidden');
  play.innerHTML =
    '<div class="play-layout">' +
      '<div class="scene-badge" id="scene-badge"></div>' +
      '<div class="story-card" id="story-card">' +
        '<div class="story-chapter" id="story-chapter"></div>' +
        '<div class="story-text" id="story-text"></div>' +
      '</div>' +
      '<div class="choices" id="choices"></div>' +
      '<div class="result-card hidden" id="result-card">' +
        '<div class="result-text" id="result-text"></div>' +
        '<button id="btn-continue" class="btn btn-primary" type="button" data-i18n="btn.continue"></button>' +
      '</div>' +
    '</div>';

  // ---- 暂停屏 ----
  const pause = getOrCreate(root, 'screen-pause', 'screen hidden');
  pause.innerHTML =
    '<div class="pause-inner">' +
      '<h2 class="pause-title" data-i18n="pause.title"></h2>' +
      '<div class="pause-hint" data-i18n="pause.hint"></div>' +
      '<div class="pause-actions">' +
        '<button id="btn-resume" class="btn btn-primary" type="button" data-i18n="btn.resume"></button>' +
        '<button id="btn-restart" class="btn btn-ghost" type="button" data-i18n="btn.restart"></button>' +
        '<button id="btn-how-pause" class="btn btn-ghost" type="button" data-tutorial-replay data-i18n="btn.how"></button>' +
      '</div>' +
    '</div>' +
    LANG_HTML('lang-select-pause');

  // ---- 结局屏 ----
  const ending = getOrCreate(root, 'screen-ending', 'screen hidden');
  ending.innerHTML =
    '<div class="ending-inner">' +
      '<div class="ending-title" data-i18n="result.title"></div>' +
      '<div class="ending-logo" id="ending-logo"></div>' +
      '<div class="ending-tagline" id="ending-tagline"></div>' +
      '<div class="ending-text" id="ending-text"></div>' +
      '<div class="ending-found" id="ending-found"></div>' +
      '<div class="ending-memory-hint" data-i18n="result.memoryHint"></div>' +
      '<div class="ending-actions">' +
        '<button id="btn-again" class="btn btn-primary" type="button" data-i18n="btn.again"></button>' +
        '<button id="btn-memory" class="btn btn-ghost" type="button" data-i18n="btn.memory"></button>' +
        '<button id="btn-share" class="btn btn-ghost" type="button" data-i18n="btn.share"></button>' +
      '</div>' +
    '</div>';

  // ---- 记忆碎片（如果当初）----
  const memory = getOrCreate(root, 'screen-memory', 'screen hidden');
  memory.innerHTML =
    '<div class="memory-inner">' +
      '<h2 class="memory-title" id="memory-title"></h2>' +
      '<div class="memory-body" id="memory-body"></div>' +
      '<button id="btn-memory-close" class="btn btn-primary" type="button" data-i18n="btn.memoryClose"></button>' +
    '</div>';

  // ---- 设置 ----
  const settings = getOrCreate(root, 'screen-settings', 'screen hidden');
  settings.innerHTML =
    '<div class="settings-inner">' +
      '<h2 class="settings-title" data-i18n="set.title"></h2>' +
      '<label class="settings-row"><span data-i18n="set.language"></span>' + LANG_HTML('lang-select-settings') + '</label>' +
      '<button id="btn-settings-back" class="btn btn-ghost" type="button" data-i18n="set.back"></button>' +
    '</div>';

  const els = {
    title, play, pause, ending, memory, settings,
    langSelects: [
      title.querySelector('.lang-select'),
      pause.querySelector('.lang-select'),
      settings.querySelector('.lang-select'),
    ],
    btnStart: title.querySelector('#btn-start'),
    btnHow: title.querySelector('#btn-how'),
    btnSettings: title.querySelector('#btn-settings'),
    btnResume: pause.querySelector('#btn-resume'),
    btnRestart: pause.querySelector('#btn-restart'),
    btnHowPause: pause.querySelector('#btn-how-pause'),
    btnAgain: ending.querySelector('#btn-again'),
    btnMemory: ending.querySelector('#btn-memory'),
    btnShare: ending.querySelector('#btn-share'),
    btnMemoryClose: memory.querySelector('#btn-memory-close'),
    btnSettingsBack: settings.querySelector('#btn-settings-back'),
    btnContinue: play.querySelector('#btn-continue'),
    titleBest: title.querySelector('#title-best'),
    sceneBadge: play.querySelector('#scene-badge'),
    storyCard: play.querySelector('#story-card'),
    storyChapter: play.querySelector('#story-chapter'),
    storyText: play.querySelector('#story-text'),
    choices: play.querySelector('#choices'),
    resultCard: play.querySelector('#result-card'),
    resultText: play.querySelector('#result-text'),
    endingLogo: ending.querySelector('#ending-logo'),
    endingTagline: ending.querySelector('#ending-tagline'),
    endingText: ending.querySelector('#ending-text'),
    endingFound: ending.querySelector('#ending-found'),
    memoryTitle: memory.querySelector('#memory-title'),
    memoryBody: memory.querySelector('#memory-body'),
  };

  function setBest(n, total) {
    els.titleBest.textContent = t('title.best', { n: Math.max(0, Math.floor(n ?? 0)), total: Math.max(1, Math.floor(total ?? 8)) });
  }

  function sceneLabel(scene) {
    const key = 'hud.scene.' + scene;
    const text = t(key);
    return text !== key ? text : scene;
  }

  function renderPlay(hud) {
    const node = hud.nodeId ? getNode(hud.nodeId) : null;
    if (!node) return;
    const lang = document.documentElement.lang || 'en';
    els.sceneBadge.textContent = sceneLabel(node.scene);
    els.sceneBadge.dataset.scene = node.scene;
    els.storyChapter.textContent = t('hud.chapter', { n: hud.chapter, total: hud.totalChapters });
    els.storyText.textContent = node.text[lang] || node.text.en || '';

    // 选项按钮
    els.choices.innerHTML = '';
    node.choices.forEach((c, i) => {
      const b = el('button', 'choice-btn', '');
      b.type = 'button';
      b.dataset.choice = String(i);
      b.innerHTML = '<span class="choice-key">' + (i + 1) + '</span><span class="choice-text"></span>';
      b.querySelector('.choice-text').textContent = c.text[lang] || c.text.en || '';
      els.choices.appendChild(b);
    });
  }

  function renderResult(hud) {
    const node = hud.nodeId ? getNode(hud.nodeId) : null;
    if (!node || !Number.isInteger(hud.curChoice)) return;
    const lang = document.documentElement.lang || 'en';
    const c = node.choices[hud.curChoice];
    els.resultText.textContent = c.result[lang] || c.result.en || '';
  }

  function showChoiceOrResult(hud) {
    const isResult = hud.stage === 'result';
    els.storyCard.classList.toggle('hidden', isResult);
    els.choices.classList.toggle('hidden', isResult);
    els.resultCard.classList.toggle('hidden', !isResult);
    if (isResult) renderResult(hud);
  }

  function renderEnding(ending, found, total) {
    const lang = document.documentElement.lang || 'en';
    els.endingLogo.textContent = ending.title[lang] || ending.title.en || '';
    els.endingTagline.textContent = ending.tagline[lang] || ending.tagline.en || '';
    els.endingText.textContent = ending.text[lang] || ending.text.en || '';
    els.endingFound.textContent = t('result.found', { n: found, total });
  }

  // 记忆碎片：重看关键抉择（n9 十字路口 + 末章）未走的另一分支
  function renderMemory(history) {
    const lang = document.documentElement.lang || 'en';
    els.memoryTitle.textContent = t('btn.memory');
    const keyIds = ['n9'];
    // 末章（第 12 章）节点也纳入
    const last = history[history.length - 1];
    if (last) keyIds.push(last.nodeId);

    const blocks = [];
    for (const id of keyIds) {
      const node = getNode(id);
      if (!node) continue;
      const rec = history.find((h) => h.nodeId === id);
      if (!rec) continue;
      const chosen = node.choices[rec.choiceIndex];
      const others = node.choices.filter((_, i) => i !== rec.choiceIndex);
      const wrap = el('div', 'memory-block', '');
      wrap.innerHTML =
        '<div class="memory-node">' + (node.text[lang] || node.text.en || '') + '</div>' +
        '<div class="memory-chosen">' + (chosen.text[lang] || chosen.text.en || '') + '</div>' +
        '<div class="memory-alt">' + others.map((o) => (o.text[lang] || o.text.en || '')).join(' / ') + '</div>';
      blocks.push(wrap);
    }
    els.memoryBody.innerHTML = '';
    blocks.forEach((b) => els.memoryBody.appendChild(b));
  }

  return {
    els,
    setBest,
    renderPlay,
    renderResult,
    showChoiceOrResult,
    renderEnding,
    renderMemory,
  };
}
