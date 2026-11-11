import { CHARACTER_MAP } from '../../config/characters.js';
import { TEAM_NAMES } from '../../config/modes.js';
import { getLang, t } from '../core/i18n.js';
import { getPortrait } from '../ui/portraits.js';

function imageFor(character, className = '') {
  const image = document.createElement('img');
  image.src = getPortrait(character);
  image.alt = '';
  image.className = className;
  image.draggable = false;
  return image;
}

export function createHUD({ onReplay, onLeave, onRetry, onMute }) {
  const hud = document.getElementById('hud');
  const roundPanel = document.getElementById('online-round-panel');
  const results = document.getElementById('online-results');
  const markers = document.getElementById('markers');
  const announcement = document.getElementById('announcement');
  const connection = document.getElementById('connection-overlay');
  const markerMap = new Map();
  let roster = new Map();
  let playerId = null;
  let announcementTimer = null;
  let playing = false;
  let lastResult = null;

  function nameOf(id) {
    const meta = roster.get(id);
    const character = CHARACTER_MAP[meta?.charId] ?? CHARACTER_MAP.shiba;
    return meta?.name ?? character.name[getLang()];
  }

  function charOf(id) {
    return CHARACTER_MAP[roster.get(id)?.charId] ?? CHARACTER_MAP.shiba;
  }

  function setPing(value) {
    for (const element of [document.getElementById('online-ping'), document.getElementById('online-ping-hud')]) {
      element.textContent = value == null ? '-- ms' : `${value} ms`;
      element.classList.toggle('high', value > 250);
    }
  }

  function announce(text, duration = 1200) {
    clearTimeout(announcementTimer);
    announcement.textContent = text;
    announcement.hidden = false;
    announcement.classList.remove('pop');
    void announcement.offsetWidth;
    announcement.classList.add('pop');
    announcementTimer = setTimeout(() => { announcement.hidden = true; }, duration);
  }

  function showGameplay(start, localPlayerId) {
    playing = true;
    playerId = localPlayerId;
    lastResult = null;
    roster = new Map((start.fighters ?? []).map((fighter) => [fighter.id, fighter]));
    hud.hidden = false;
    markers.hidden = false;
    roundPanel.hidden = true;
    results.hidden = true;
    document.getElementById('kill-feed').replaceChildren();
    announcement.hidden = true;
    createMarkers(start.fighters ?? []);
  }

  function createMarkers(fighters) {
    markers.replaceChildren();
    markerMap.clear();
    for (const fighter of fighters) {
      const local = fighter.id === `f${String(playerId).slice(1)}`;
      const element = document.createElement('div');
      element.className = `fighter-marker${local ? ' player' : ''} team-${fighter.team ?? 0}`;
      element.style.setProperty('--marker', charOf(fighter.id).colors.fur);
      const name = document.createElement('span');
      name.className = 'marker-name';
      if (!local) {
        const dot = document.createElement('i');
        dot.className = 'marker-dot';
        name.append(dot);
      }
      const label = document.createElement('span');
      label.className = 'marker-label';
      label.textContent = nameOf(fighter.id);
      name.append(label);
      element.append(name);
      if (local) {
        const arrow = document.createElement('span');
        arrow.className = 'marker-arrow';
        element.append(arrow);
      }
      markers.append(element);
      markerMap.set(fighter.id, element);
    }
  }

  function updateMarker(id, { x, y, visible, detailed }) {
    const marker = markerMap.get(id);
    if (!marker) return;
    marker.hidden = !visible;
    marker.classList.toggle('compact', !detailed);
    if (!visible) return;
    marker.style.left = `${x}px`;
    marker.style.top = `${y}px`;
  }

  function update(snapshot, fighters, ping) {
    if (!snapshot) return;
    document.getElementById('round-label').textContent = t('round', { round: snapshot.round ?? 1 });
    const seconds = Math.max(0, Math.ceil(snapshot.timeLeft ?? 0));
    document.getElementById('time-label').textContent = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
    setPing(ping);
    const localId = `f${String(playerId).slice(1)}`;
    const player = fighters.find((fighter) => fighter.id === localId);
    const type = player?.heldItem?.type ?? null;
    const slot = document.getElementById('item-slot');
    slot.classList.toggle('empty', !type);
    document.getElementById('item-icon').textContent = '●';
    document.getElementById('item-name').textContent = type ? t(`item.${type}`) : t('empty');
    document.getElementById('item-detail').textContent = type ? t('item.uses', { count: player.heldItem.uses }) : '';

    const ordered = [...fighters].sort((a, b) => Number(a.eliminated) - Number(b.eliminated) || b.kos - a.kos || (a.rank || 99) - (b.rank || 99) || a.id.localeCompare(b.id));
    const visible = ordered.slice(0, 5);
    if (player && !visible.includes(player)) visible[visible.length - 1] = player;
    const ranking = document.getElementById('ranking');
    ranking.replaceChildren();
    for (const fighter of visible) {
      const row = document.createElement('div');
      row.className = `rank-row${fighter.eliminated ? ' eliminated' : ''}${fighter.isPlayer ? ' player' : ''}`;
      row.append(imageFor(charOf(fighter.id), 'rank-avatar'));
      const name = document.createElement('span');
      name.textContent = nameOf(fighter.id);
      const status = document.createElement('small');
      status.textContent = fighter.eliminated ? t('out', { rank: fighter.rank }) : `${fighter.kos} KO`;
      row.append(name, status);
      ranking.append(row);
    }
  }

  function addKillFeed(event) {
    const line = document.createElement('div');
    line.className = 'kill-line';
    const victim = nameOf(event.victim);
    line.textContent = event.killer ? t('koFeed', { killer: nameOf(event.killer), victim }) : t('soloFeed', { victim });
    const feed = document.getElementById('kill-feed');
    feed.prepend(line);
    while (feed.children.length > 3) feed.lastElementChild.remove();
    setTimeout(() => line.classList.add('fade'), 2600);
    setTimeout(() => line.remove(), 3100);
  }

  function standingRow(id, rank, points, kos, localId) {
    const row = document.createElement('div');
    row.className = `online-standing-row${id === localId ? ' self' : ''}`;
    const place = document.createElement('b');
    place.textContent = `#${rank}`;
    const name = document.createElement('span');
    name.textContent = nameOf(id);
    const score = document.createElement('strong');
    score.textContent = `${points ?? 0} ${t('points')}`;
    const knockouts = document.createElement('strong');
    knockouts.textContent = `${kos ?? 0} KO`;
    row.append(place, imageFor(charOf(id)), name, score, knockouts);
    return row;
  }

  function showRoundEnd(event) {
    document.getElementById('online-round-title').textContent = event.teamWinner !== undefined
      ? `${t('team.wins', { name: TEAM_NAMES[event.teamWinner]?.[getLang()] })} · ${event.teamScores?.join(' : ')}`
      : t('roundResults', { round: event.round });
    const list = document.getElementById('online-round-results');
    list.replaceChildren();
    const localId = `f${String(playerId).slice(1)}`;
    (event.rankings ?? []).forEach((id, index) => {
      list.append(standingRow(id, index + 1, event.roundPoints?.[id], event.roundKos?.[id], localId));
    });
    roundPanel.hidden = false;
  }

  function beginRound() {
    roundPanel.hidden = true;
    results.hidden = true;
    lastResult = null;
  }

  function showMatchEnd(result, isHost) {
    if (lastResult) return;
    lastResult = result;
    playing = false;
    roundPanel.hidden = true;
    results.hidden = false;
    markers.hidden = true;
    const localId = `f${String(playerId).slice(1)}`;
    const standings = result.standings ?? [];
    document.getElementById('online-champion').textContent = standings[0] ? t('wins', { name: nameOf(standings[0].id) }) : t('matchEnd');
    document.getElementById('online-team-result').textContent = result.teamWinner !== undefined
      ? `${TEAM_NAMES[result.teamWinner]?.[getLang()]} · ${result.teamScores?.join(' : ')}` : '';
    const list = document.getElementById('online-match-standings');
    list.replaceChildren();
    standings.forEach((score, index) => list.append(standingRow(score.id, index + 1, score.points, score.kos, localId)));
    document.getElementById('btnOnlineReplay').hidden = !isHost;
    document.getElementById('online-rematch-note').textContent = t(isHost ? 'online.rematchNote' : 'online.leave');
  }

  function setConnection(status) {
    const visible = status.state === 'offline' || (playing && status.state === 'reconnecting');
    connection.hidden = !visible;
    if (!visible) return;
    document.getElementById('connection-title').textContent = t(status.state === 'offline' ? 'online.serverOffline' : 'online.reconnecting');
    document.getElementById('connection-detail').textContent = status.state === 'offline' ? t('online.serverOffline') : t('online.disconnected', { count: status.elapsed });
  }

  function hideAll() {
    playing = false;
    hud.hidden = true;
    markers.hidden = true;
    roundPanel.hidden = true;
    results.hidden = true;
    connection.hidden = true;
    announcement.hidden = true;
  }

  document.getElementById('btnOnlineReplay').addEventListener('click', onReplay);
  document.getElementById('btnOnlineResultsLeave').addEventListener('click', onLeave);
  document.getElementById('btnOnlineRetry').addEventListener('click', onRetry);
  document.getElementById('mute-button').addEventListener('click', () => {
    const muted = onMute();
    document.getElementById('mute-button').textContent = muted ? '×' : '♪';
    document.getElementById('mute-button').setAttribute('aria-label', t(muted ? 'unmute' : 'mute'));
  });

  return { showGameplay, update, announce, addKillFeed, showRoundEnd, beginRound, showMatchEnd, setConnection, setPing, updateMarker, hideAll,
    get playing() { return playing; }, get roundVisible() { return !roundPanel.hidden; }, get resultsVisible() { return !results.hidden; } };
}
