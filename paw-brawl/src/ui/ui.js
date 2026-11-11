import { CONFIG } from '../../config/game.config.js';
import { CHARACTERS, CHARACTER_MAP } from '../../config/characters.js';
import { CHARACTER_PRICES } from '../core/economy.js';
import { TEAM_COLORS, TEAM_NAMES } from '../../config/modes.js';
import { applyI18n, getLang, t } from '../core/i18n.js';
import { getPortrait, prewarmPortraits } from './portraits.js';

const fighterName = (fighter) => CHARACTER_MAP[fighter.charId].name[getLang()];
const itemIcons = { fish: '🐟', hammer: '🔨', bomb: '💣', glove: '🥊', star: '⭐' };

function portraitImage(character, className) {
  const image = document.createElement('img');
  image.className = className;
  image.src = getPortrait(character);
  image.alt = '';
  image.width = 256;
  image.height = 256;
  image.draggable = false;
  return image;
}

export function createUI({ input, onPlay, onModeBack, onModeSelect, onModeNext, onResume, onPause, onHelp, onRestart, onNext, onPlayAgain, onChangePaw, onChangeMode, onMute, onSettings, onSettingsBack, onSelectBack, onSelect, onStart, onPauseHome, onHome, onShare, onSettingSfx, onSettingMusic, onQuality, onReset, initialMuted = false }) {
  const title = document.getElementById('title-screen');
  const modeScreen = document.getElementById('screen-mode');
  const select = document.getElementById('screen-select');
  const hud = document.getElementById('hud');
  const touch = document.getElementById('touch');
  const pause = document.getElementById('pause-screen');
  const roundPanel = document.getElementById('round-panel');
  const matchPanel = document.getElementById('screen-results');
  const settings = document.getElementById('screen-settings');
  const help = document.getElementById('screen-help');
  const markers = document.getElementById('markers');
  const showcaseLabels = document.getElementById('showcase-labels');
  const toast = document.getElementById('toast');
  const announcement = document.getElementById('announcement');
  const markerMap = new Map();
  const showcaseMap = new Map();
  const coarse = matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
  let playing = false;
  let paused = false;
  let helpVisible = false;
  let toastTimer = 0;
  let announcementTimer = 0;
  let previousItemType = null;
  let currentRules = null;
  let currentArena = null;

  prewarmPortraits(CHARACTERS);
  applyI18n();
  document.getElementById('round-label').textContent = t('round', { round: 1 });
  document.getElementById('pause-button').setAttribute('aria-label', t('pause'));
  document.getElementById('help-button').setAttribute('aria-label', t('help.title'));

  const elementBindings = {
    btnPlay: onPlay, btnModeBack: onModeBack, btnModeNext: onModeNext, btnResume: onResume, btnRestart: onRestart, btnNextRound: onNext,
    btnPlayAgain: onPlayAgain, btnChangePaw: onChangePaw, btnChangeMode: onChangeMode, btnSettings: onSettings,
    btnSettingsBack: onSettingsBack, btnSelectBack: onSelectBack, btnStartMatch: onStart,
    btnPauseHome: onPauseHome, btnResultsHome: onHome, btnShare: onShare, btnResetSave: onReset,
    btnTitleHelp: onHelp, btnPauseHelp: onHelp, btnHelpClose: onHelp,
  };
  for (const [id, callback] of Object.entries(elementBindings)) document.getElementById(id).addEventListener('click', callback);
  document.getElementById('setting-sfx').addEventListener('click', onSettingSfx);
  document.getElementById('setting-music').addEventListener('click', onSettingMusic);
  document.querySelectorAll('.mode-card[data-mode]').forEach((card) => card.addEventListener('click', () => onModeSelect(card.dataset.mode)));
  document.getElementById('setting-quality').addEventListener('change', (event) => onQuality(event.target.value));
  document.getElementById('pause-button').addEventListener('click', onPause);
  document.getElementById('help-button').addEventListener('click', onHelp);
  document.getElementById('mute-button').addEventListener('click', () => setMuted(onMute()));

  function syncTouch() {
    touch.hidden = !coarse || !playing || paused || helpVisible || !roundPanel.hidden || !matchPanel.hidden || !select.hidden || !modeScreen.hidden || !settings.hidden;
  }

  function hideAll() {
    clearTimeout(toastTimer);
    toast.hidden = true;
    title.hidden = true;
    modeScreen.hidden = true;
    select.hidden = true;
    hud.hidden = true;
    pause.hidden = true;
    roundPanel.hidden = true;
    matchPanel.hidden = true;
    settings.hidden = true;
    help.hidden = true;
    helpVisible = false;
    document.getElementById('game-hint').hidden = true;
    document.getElementById('death-overlay').hidden = true;
    markers.hidden = true;
    touch.hidden = true;
  }

  function showGameplay(rules = currentRules) {
    hideAll();
    currentRules = rules;
    playing = true;
    paused = false;
    hud.hidden = false;
    document.getElementById('team-score').hidden = rules?.teams !== 2;
    markers.hidden = false;
    document.getElementById('kill-feed').replaceChildren();
    announcement.hidden = true;
    syncTouch();
  }

  function showTitle() {
    hideAll();
    playing = false;
    paused = false;
    title.hidden = false;
  }

  function showSettings(save) {
    hideAll();
    playing = false;
    settings.hidden = false;
    updateSettings(save);
  }

  function showMode(selectedId, save) {
    hideAll();
    playing = false;
    modeScreen.hidden = false;
    document.getElementById('mode-coins').textContent = `🪙 ${save.coins.toLocaleString()}`;
    document.querySelectorAll('.mode-card[data-mode]').forEach((card) => {
      const selected = card.dataset.mode === selectedId;
      card.classList.toggle('selected', selected);
      card.setAttribute('aria-pressed', String(selected));
    });
  }

  function showSelect(save, selectedId, rules = currentRules, arena = currentArena) {
    hideAll();
    currentRules = rules;
    currentArena = arena;
    playing = false;
    select.hidden = false;
    renderSelect(save, selectedId);
  }

  function renderSelect(save, selectedId) {
    document.getElementById('select-coins').textContent = `🪙 ${save.coins.toLocaleString()}`;
    document.getElementById('select-mode').textContent = currentRules?.name[getLang()] ?? '';
    document.getElementById('select-arena').textContent = currentArena?.name[getLang()] ?? '';
    const team = document.getElementById('select-team');
    team.hidden = currentRules?.teams !== 2;
    team.textContent = t('select.team');
    const grid = document.getElementById('character-grid');
    grid.replaceChildren();
    for (const character of CHARACTERS) {
      const unlocked = save.unlocked.includes(character.id);
      const card = document.createElement('button');
      card.className = `character-card${character.id === selectedId ? ' selected' : ''}${unlocked ? '' : ' locked'}`;
      card.dataset.char = character.id;
      card.style.setProperty('--fighter', character.colors.fur);
      card.setAttribute('aria-pressed', String(character.id === selectedId));
      const avatar = portraitImage(character, 'card-avatar');
      const name = document.createElement('strong');
      name.textContent = character.name[getLang()];
      const species = document.createElement('small');
      species.textContent = t(`species.${character.id}`);
      card.append(avatar, name, species);
      if (!unlocked) {
        const lock = document.createElement('span');
        lock.className = 'card-lock';
        lock.textContent = `🔒 ${CHARACTER_PRICES[character.id]}`;
        card.append(lock);
      }
      card.addEventListener('click', () => onSelect(character.id));
      grid.append(card);
    }
    const character = CHARACTER_MAP[selectedId] ?? CHARACTERS[0];
    document.getElementById('preview-name').textContent = character.name[getLang()];
    document.getElementById('preview-species').textContent = t(`species.${character.id}`);
    document.getElementById('preview-passive').textContent = `${t('select.passive')} · ${character.passiveText[getLang()]}`;
    const stats = document.getElementById('preview-stats');
    stats.replaceChildren();
    for (const key of ['speed', 'weight', 'power', 'jump']) {
      const row = document.createElement('div');
      row.className = 'stat-row';
      const label = document.createElement('span');
      label.textContent = t(`select.stats.${key}`);
      const track = document.createElement('span');
      track.className = 'stat-track';
      const fill = document.createElement('i');
      fill.style.width = `${Math.max(0, Math.min(100, (character[key] - 0.6) / 0.8 * 100))}%`;
      track.append(fill);
      row.append(label, track);
      stats.append(row);
    }
    document.getElementById('btnStartMatch').disabled = !save.unlocked.includes(character.id);
  }

  function updateSettings(save) {
    for (const key of ['sfx', 'music']) {
      const button = document.getElementById(`setting-${key}`);
      button.textContent = t(save.settings[key] ? 'settings.on' : 'settings.off');
      button.classList.toggle('off', !save.settings[key]);
      button.setAttribute('aria-pressed', String(save.settings[key]));
    }
    document.getElementById('setting-quality').value = save.settings.quality;
  }

  function setPaused(value) {
    paused = value;
    pause.hidden = !value;
    syncTouch();
  }

  function showPlayerDeath(killer) {
    const overlay = document.getElementById('death-overlay');
    document.getElementById('death-killer').textContent = t('death.killer', { killer });
    overlay.classList.remove('fading');
    overlay.hidden = false;
  }

  function fadePlayerDeath() {
    document.getElementById('death-overlay').classList.add('fading');
  }

  function hidePlayerDeath() {
    const overlay = document.getElementById('death-overlay');
    overlay.hidden = true;
    overlay.classList.remove('fading');
  }

  function showHelp() {
    helpVisible = true;
    help.hidden = false;
    syncTouch();
  }

  function hideHelp() {
    helpVisible = false;
    help.hidden = true;
    syncTouch();
  }

  function setGameHint(message) {
    const hint = document.getElementById('game-hint');
    hint.hidden = !message;
    if (message && hint.textContent !== message) hint.textContent = message;
  }

  function setMuted(value) {
    const button = document.getElementById('mute-button');
    button.textContent = value ? '×' : '♪';
    button.setAttribute('aria-label', t(value ? 'unmute' : 'mute'));
  }
  setMuted(initialMuted);

  function setTime(seconds) {
    const whole = Math.max(0, Math.ceil(seconds));
    const minutes = String(Math.floor(whole / 60)).padStart(2, '0');
    const remainder = String(whole % 60).padStart(2, '0');
    document.getElementById('time-label').textContent = `${minutes}:${remainder}`;
  }

  function updateItem(player) {
    const slot = document.getElementById('item-slot');
    let type = player?.heldItem?.type ?? null;
    let detail = player?.heldItem ? t('item.uses', { count: player.heldItem.uses }) : '';
    if (!type && player?.starT > 0) {
      type = 'star';
      detail = t('item.seconds', { count: Math.ceil(player.starT) });
    } else if (!type && player?.gloveT > 0) {
      type = 'glove';
      detail = t('item.seconds', { count: Math.ceil(player.gloveT) });
    }
    slot.classList.toggle('empty', !type);
    if (type && type !== previousItemType) {
      slot.classList.remove('pickup');
      void slot.offsetWidth;
      slot.classList.add('pickup');
    }
    previousItemType = type;
    document.getElementById('item-icon').textContent = type ? itemIcons[type] : '●';
    document.getElementById('item-name').textContent = type ? t(`item.${type}`) : t('empty');
    document.getElementById('item-detail').textContent = detail;
  }

  function updateHUD(sim, match) {
    document.getElementById('round-label').textContent = t('round', { round: match.round });
    setTime(match.timeLeft);
    if (sim.teams === 2) {
      document.getElementById('score-red').textContent = String(match.teamScores[0]);
      document.getElementById('score-blue').textContent = String(match.teamScores[1]);
    }
    updateItem(sim.fighters.find((fighter) => fighter.isPlayer));
    if (match.phase === 'roundEnd') {
      document.getElementById('round-countdown').textContent = t('nextIn', { count: Math.max(1, Math.ceil(CONFIG.match.roundEndTime - match.phaseT)) });
    }
    const ordered = [...sim.fighters].sort((a, b) => Number(a.eliminated) - Number(b.eliminated) || b.kos - a.kos || (a.rank || 99) - (b.rank || 99) || a.id.localeCompare(b.id));
    const visible = ordered.slice(0, 5);
    const player = sim.fighters.find((fighter) => fighter.isPlayer);
    if (player && !visible.includes(player)) visible[visible.length - 1] = player;
    const ranking = document.getElementById('ranking');
    ranking.replaceChildren();
    for (const fighter of visible) {
      const row = document.createElement('div');
      row.className = `rank-row${fighter.eliminated ? ' eliminated' : ''}${fighter.isPlayer ? ' player' : ''}`;
      const portrait = portraitImage(CHARACTER_MAP[fighter.charId], 'rank-avatar');
      const name = document.createElement('span');
      name.textContent = fighterName(fighter);
      const status = document.createElement('small');
      status.textContent = fighter.eliminated ? t('out', { rank: fighter.rank }) : `${fighter.kos} KO`;
      row.append(portrait, name, status);
      ranking.append(row);
    }
  }

  function announce(message, duration = 1200) {
    clearTimeout(announcementTimer);
    announcement.textContent = message;
    announcement.hidden = false;
    announcement.classList.remove('pop');
    void announcement.offsetWidth;
    announcement.classList.add('pop');
    announcementTimer = setTimeout(() => { announcement.hidden = true; }, duration);
  }

  function addKillFeed(event, sim) {
    const victim = sim.fighterMap.get(event.victim);
    const killer = event.killer ? sim.fighterMap.get(event.killer) : null;
    const line = document.createElement('div');
    line.className = 'kill-line';
    line.textContent = killer ? t('koFeed', { killer: fighterName(killer), victim: fighterName(victim) }) : t('soloFeed', { victim: fighterName(victim) });
    const feed = document.getElementById('kill-feed');
    feed.prepend(line);
    while (feed.children.length > 3) feed.lastElementChild.remove();
    setTimeout(() => { line.classList.add('fade'); }, 2600);
    setTimeout(() => line.remove(), 3100);
  }

  function resultRow(fighter, rank, points, kos = null) {
    const row = document.createElement('div');
    row.className = 'result-row';
    const place = document.createElement('b');
    place.textContent = `#${rank}`;
    const portrait = portraitImage(CHARACTER_MAP[fighter.charId], 'result-avatar');
    const name = document.createElement('span');
    name.textContent = fighterName(fighter);
    const score = document.createElement('strong');
    score.textContent = `+${points} ${t('points')}`;
    row.append(place, portrait, name, score);
    if (kos !== null) {
      const ko = document.createElement('strong');
      ko.textContent = `${kos} KO`;
      row.append(ko);
    }
    return row;
  }

  function showRoundEnd(result, sim) {
    document.getElementById('round-title').textContent = result.teamWinner !== undefined
      ? `${t('team.wins', { name: TEAM_NAMES[result.teamWinner][getLang()] })} · ${result.teamScores[0]} : ${result.teamScores[1]}`
      : t('roundResults', { round: result.round });
    const list = document.getElementById('round-results');
    list.replaceChildren();
    result.rankings.forEach((id, index) => {
      const fighter = sim.fighterMap.get(id);
      const points = result.roundPoints?.[id] ?? CONFIG.match.points[index] ?? 0;
      list.append(resultRow(fighter, index + 1, points, result.roundKos?.[id] ?? fighter.kos));
    });
    roundPanel.hidden = false;
    syncTouch();
  }

  function beginRound() {
    roundPanel.hidden = true;
    matchPanel.hidden = true;
    syncTouch();
  }

  function showResults(standings, sim, reward, save, playerId = 'f0') {
    hideAll();
    playing = false;
    matchPanel.hidden = false;
    const podium = document.getElementById('podium');
    const list = document.getElementById('match-standings');
    podium.replaceChildren();
    list.replaceChildren();
    document.getElementById('team-result-banner').hidden = true;
    document.getElementById('result-crown').hidden = false;
    standings.slice(0, 3).forEach((score, index) => {
      const fighter = sim.fighterMap.get(score.id);
      const place = document.createElement('div');
      place.className = `podium-place place-${index + 1}`;
      place.style.setProperty('--fighter', CHARACTER_MAP[fighter.charId].colors.fur);
      const number = document.createElement('b');
      number.textContent = String(index + 1);
      const portrait = portraitImage(CHARACTER_MAP[fighter.charId], 'podium-avatar');
      const name = document.createElement('span');
      name.textContent = fighterName(fighter);
      const detail = document.createElement('small');
      detail.textContent = `${score.points} ${t('points')} · ${score.kos} KO`;
      place.append(number, portrait, name, detail);
      podium.append(place);
      list.append(resultRow(fighter, index + 1, score.points, score.kos));
    });
    document.getElementById('champion-name').textContent = fighterName(sim.fighterMap.get(standings[0].id));
    const breakdown = document.getElementById('coin-breakdown');
    breakdown.replaceChildren();
    const lines = [
      ['results.place', reward.breakdown.rank],
      ['results.ko', reward.breakdown.kos],
      ['results.firstWin', reward.breakdown.firstWin],
      ['results.championBonus', reward.breakdown.champion],
    ];
    for (const [key, value] of lines) {
      if (!value && key !== 'results.place' && key !== 'results.ko') continue;
      const line = document.createElement('div');
      line.className = 'coin-line';
      const label = document.createElement('span');
      label.textContent = t(key);
      const amount = document.createElement('strong');
      amount.textContent = `+${value}`;
      line.append(label, amount);
      breakdown.append(line);
    }
    const total = document.getElementById('coin-total');
    total.textContent = `${t('results.total')} 🪙 ${save.coins}  (+${reward.total})`;
    total.classList.remove('fly');
    void total.offsetWidth;
    total.classList.add('fly');
    const player = standings.find((score) => score.id === playerId);
    document.getElementById('match-summary').textContent = `${t('results.matchKos')} ${player?.kos ?? 0} · ${t('results.roundWins')} ${player?.roundWins ?? 0}`;
  }

  function showTeamResults(standings, sim, reward, save, winningTeam, teamScores) {
    showResults(standings, sim, reward, save);
    const lang = getLang();
    const banner = document.getElementById('team-result-banner');
    banner.hidden = false;
    banner.style.setProperty('--winning-team', TEAM_COLORS[winningTeam]);
    document.getElementById('result-crown').hidden = true;
    document.getElementById('team-result-score').textContent = `${teamScores[0]} — ${teamScores[1]}`;
    document.getElementById('team-result-winner').textContent = t('team.wins', { name: TEAM_NAMES[winningTeam][lang] });
    document.getElementById('champion-name').textContent = `${TEAM_NAMES[winningTeam][lang]} ${teamScores[0]}:${teamScores[1]}`;
    document.querySelector('#screen-results .match-card > h2').textContent = `${t('team.red')} ${teamScores[0]} — ${teamScores[1]} ${t('team.blue')}`;
    const player = standings.find((score) => score.id === 'f0');
    document.getElementById('match-summary').textContent = `${t('results.matchKos')} ${player?.kos ?? 0}`;
  }

  function createMarkers(fighters) {
    markers.replaceChildren();
    markerMap.clear();
    for (const fighter of fighters) {
      const element = document.createElement('div');
      element.className = `fighter-marker${fighter.isPlayer ? ' player' : ''} team-${fighter.team}`;
      element.dataset.team = String(fighter.team);
      const character = CHARACTER_MAP[fighter.charId];
      element.style.setProperty('--marker', character.colors.fur);
      const name = document.createElement('span');
      name.className = 'marker-name';
      if (!fighter.isPlayer) {
        const dot = document.createElement('i');
        dot.className = 'marker-dot';
        name.append(dot);
      }
      const label = document.createElement('span');
      label.className = 'marker-label';
      label.textContent = character.name[getLang()];
      name.append(label);
      element.append(name);
      if (fighter.isPlayer) {
        const arrow = document.createElement('span');
        arrow.className = 'marker-arrow';
        element.append(arrow);
      }
      markers.append(element);
      markerMap.set(fighter.id, element);
    }
  }

  function updateMarker(id, { x, y, visible, detailed = true }) {
    const marker = markerMap.get(id);
    if (!marker) return;
    marker.hidden = !visible;
    marker.classList.toggle('compact', !detailed);
    if (!visible) return;
    marker.style.left = `${x}px`;
    marker.style.top = `${y}px`;
  }

  function createShowcaseLabels(fighters) {
    showcaseLabels.replaceChildren();
    showcaseMap.clear();
    for (const fighter of fighters) {
      const character = CHARACTER_MAP[fighter.charId];
      const element = document.createElement('div');
      element.className = 'showcase-label';
      element.style.setProperty('--marker', character.colors.fur);
      const name = document.createElement('strong');
      name.textContent = character.name[getLang()];
      element.append(name);
      if (getLang() === 'en') {
        const species = document.createElement('span');
        species.textContent = character.id.toUpperCase();
        element.append(species);
      }
      showcaseLabels.append(element);
      showcaseMap.set(fighter.id, element);
    }
  }

  function updateShowcaseLabel(id, { x, y, visible, below }) {
    const label = showcaseMap.get(id);
    if (!label) return;
    label.hidden = !visible;
    if (!visible) return;
    label.classList.toggle('below', below);
    label.style.left = `${x}px`;
    label.style.top = `${y}px`;
  }

  function showToast(message) {
    clearTimeout(toastTimer);
    toast.textContent = message;
    toast.hidden = false;
    toastTimer = setTimeout(() => { toast.hidden = true; }, 1800);
  }

  const zone = document.getElementById('joystick-zone');
  const base = document.getElementById('joystick-base');
  const knob = document.getElementById('joystick-knob');

  function updateStick(stick) {
    if (!stick) return;
    const dx = stick.x - stick.originX;
    const dy = stick.y - stick.originY;
    const length = Math.hypot(dx, dy);
    const scale = length > CONFIG.input.joystickRadius ? CONFIG.input.joystickRadius / length : 1;
    knob.style.transform = `translate(calc(-50% + ${dx * scale}px), calc(-50% + ${dy * scale}px))`;
  }

  zone.addEventListener('pointerdown', (event) => {
    if (!playing || paused || event.pointerType === 'mouse') return;
    event.preventDefault();
    zone.setPointerCapture(event.pointerId);
    const stick = input.beginJoystick(event.pointerId, event.clientX, event.clientY, performance.now() / 1000);
    base.hidden = false;
    const bounds = zone.getBoundingClientRect();
    const visualX = Math.max(72, Math.min(bounds.width - 72, stick.originX - bounds.left));
    const visualY = Math.max(72, Math.min(bounds.height - 72, stick.originY - bounds.top));
    base.style.left = `${visualX}px`;
    base.style.top = `${visualY}px`;
    updateStick(stick);
  });
  zone.addEventListener('pointermove', (event) => {
    const stick = input.moveJoystick(event.pointerId, event.clientX, event.clientY);
    if (stick) {
      event.preventDefault();
      updateStick(stick);
    }
  });
  const endStick = (event) => {
    if (!input.endJoystick(event.pointerId)) return;
    base.hidden = true;
    knob.style.transform = 'translate(-50%, -50%)';
  };
  zone.addEventListener('pointerup', endStick);
  zone.addEventListener('pointercancel', endStick);

  document.querySelectorAll('.touch-button').forEach((button) => {
    button.addEventListener('pointerdown', (event) => {
      if (!playing || paused) return;
      event.preventDefault();
      event.stopPropagation();
      button.setPointerCapture(event.pointerId);
      input.setAction(button.dataset.action, true);
    });
    const release = (event) => {
      input.setAction(button.dataset.action, false);
      if (button.hasPointerCapture(event.pointerId)) button.releasePointerCapture(event.pointerId);
    };
    button.addEventListener('pointerup', release);
    button.addEventListener('pointercancel', release);
    button.addEventListener('lostpointercapture', () => input.setAction(button.dataset.action, false));
  });
  document.addEventListener('contextmenu', (event) => event.preventDefault());

  return { showGameplay, showTitle, showMode, showSelect, renderSelect, showSettings, updateSettings, setPaused, showHelp, hideHelp, setGameHint, showPlayerDeath, fadePlayerDeath, hidePlayerDeath, updateHUD, announce, addKillFeed, showRoundEnd, showResults, showTeamResults, beginRound, setMuted, createMarkers, updateMarker, createShowcaseLabels, updateShowcaseLabel, showToast };
}
