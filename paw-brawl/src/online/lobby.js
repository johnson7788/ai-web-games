import { CHARACTERS, CHARACTER_MAP } from '../../config/characters.js';
import { MODES } from '../../config/modes.js';
import { NET_CONFIG } from '../../config/net.config.js';
import { getLang, t } from '../core/i18n.js';
import { getPortrait } from '../ui/portraits.js';

const readProfile = () => {
  try { return JSON.parse(localStorage.getItem(NET_CONFIG.profileKey)) ?? {}; }
  catch { return {}; }
};

export function createLobby({ net, onCharacter }) {
  const setup = document.getElementById('online-setup');
  const roomScreen = document.getElementById('online-room');
  const lobby = document.getElementById('online-lobby');
  const nameInput = document.getElementById('online-name');
  const codeInput = document.getElementById('online-room-input');
  const message = document.getElementById('online-lobby-message');
  const roomMessage = document.getElementById('online-room-message');
  const stored = readProfile();
  const query = new URLSearchParams(location.search);
  let profile = {
    name: typeof stored.name === 'string' ? stored.name.slice(0, 12) : 'Player',
    char: CHARACTER_MAP[stored.char] ? stored.char : CHARACTER_MAP[query.get('char')] ? query.get('char') : 'shiba',
  };
  let mode = stored.mode === 'team' ? 'team' : 'ffa';
  let players = [];
  let room = null;
  let inRoom = false;
  let ready = false;
  let toastTimer = null;

  nameInput.value = profile.name;
  codeInput.value = (query.get('room') ?? '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4);
  net.setProfile(profile);

  function saveProfile() {
    try { localStorage.setItem(NET_CONFIG.profileKey, JSON.stringify({ ...profile, mode })); } catch {}
  }

  function toast(text) {
    const element = document.getElementById('toast');
    clearTimeout(toastTimer);
    element.textContent = text;
    element.hidden = false;
    toastTimer = setTimeout(() => { element.hidden = true; }, 2200);
  }

  function selectCharacter(id) {
    if (!CHARACTER_MAP[id]) return;
    profile.char = id;
    net.setProfile(profile);
    saveProfile();
    renderCharacters();
    onCharacter(id);
  }

  function renderCharacters() {
    const grid = document.getElementById('online-character-grid');
    grid.replaceChildren();
    for (const character of CHARACTERS) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `online-character-card${character.id === profile.char ? ' selected' : ''}`;
      button.dataset.char = character.id;
      button.style.setProperty('--fighter', character.colors.fur);
      button.setAttribute('aria-pressed', String(character.id === profile.char));
      const image = document.createElement('img');
      image.src = getPortrait(character);
      image.alt = '';
      image.draggable = false;
      const name = document.createElement('strong');
      name.textContent = character.name[getLang()];
      const species = document.createElement('small');
      species.textContent = t(`species.${character.id}`);
      button.append(image, name, species);
      button.addEventListener('click', () => selectCharacter(character.id));
      grid.append(button);
    }
    const selected = CHARACTER_MAP[profile.char];
    document.getElementById('online-selected-name').textContent = selected.name[getLang()];
    document.getElementById('online-selected-passive').textContent = selected.passiveText[getLang()];
  }

  function setMode(next) {
    if (!MODES[next]) return;
    mode = next;
    document.querySelectorAll('[data-online-mode]').forEach((button) => {
      const selected = button.dataset.onlineMode === next;
      button.classList.toggle('selected', selected);
      button.setAttribute('aria-pressed', String(selected));
    });
    saveProfile();
  }

  function validateName() {
    profile.name = nameInput.value.trim();
    if (![...profile.name].length || [...profile.name].length > 12) {
      message.textContent = t('online.nameRequired');
      nameInput.focus();
      return false;
    }
    message.textContent = '';
    net.setProfile(profile);
    saveProfile();
    return true;
  }

  function showSetup() {
    inRoom = false;
    ready = false;
    room = null;
    players = [];
    lobby.hidden = false;
    setup.hidden = false;
    roomScreen.hidden = true;
    roomMessage.textContent = '';
    document.getElementById('online-room-input').value = codeInput.value;
  }

  function showRoom(nextRoom) {
    room = nextRoom;
    inRoom = true;
    ready = false;
    lobby.hidden = false;
    setup.hidden = true;
    roomScreen.hidden = false;
    codeInput.value = room?.code ?? codeInput.value;
    renderRoom();
  }

  function renderRoom() {
    if (!inRoom || !room) return;
    document.getElementById('online-room-code').textContent = room.code ?? '----';
    document.getElementById('online-room-mode').textContent = MODES[room.mode]?.name[getLang()] ?? String(room.mode ?? '').toUpperCase();
    document.getElementById('online-room-count').textContent = `${players.length} / 8`;
    const list = document.getElementById('online-player-list');
    list.replaceChildren();
    for (const player of players) {
      const character = CHARACTER_MAP[player.charId] ?? CHARACTER_MAP.shiba;
      const row = document.createElement('div');
      row.className = `online-player-row${player.id === net.playerId ? ' self' : ''}${player.connected === false ? ' disconnected' : ''}`;
      row.dataset.player = player.id;
      const image = document.createElement('img');
      image.src = getPortrait(character);
      image.alt = '';
      const identity = document.createElement('div');
      const name = document.createElement('strong');
      name.textContent = player.id === net.playerId ? `${player.name} · ${t('online.you')}` : player.name;
      const detail = document.createElement('small');
      detail.textContent = [player.isHost ? t('online.host') : '', player.isBot ? t('online.bot') : character.name[getLang()]].filter(Boolean).join(' · ');
      identity.append(name, detail);
      const status = document.createElement('span');
      status.className = `online-player-status${player.ready ? ' ready' : ''}`;
      status.textContent = player.connected === false ? t('online.reconnecting') : player.ready ? t('online.ready') : t('online.notReady');
      row.append(image, identity, status);
      list.append(row);
    }
    const self = players.find((player) => player.id === net.playerId);
    ready = Boolean(self?.ready);
    const readyButton = document.getElementById('btnOnlineReady');
    readyButton.textContent = t(ready ? 'online.unready' : 'online.ready');
    readyButton.disabled = !net.connected;
    const host = room.hostId === net.playerId;
    const startButton = document.getElementById('btnOnlineStart');
    startButton.hidden = !host;
    startButton.disabled = !net.connected || !players.some((player) => player.connected && player.ready);
    if (!host) roomMessage.textContent = t('online.waiting');
    else if (roomMessage.textContent === t('online.waiting')) roomMessage.textContent = '';
  }

  function updateStatus({ state }) {
    const connection = document.getElementById('online-connection');
    connection.dataset.state = state;
    document.getElementById('online-connection-label').textContent = t(state === 'online' ? 'online.connected' : state === 'offline' ? 'online.serverOffline' : state === 'reconnecting' ? 'online.reconnecting' : 'online.connecting');
    document.getElementById('btnOnlineCreate').disabled = state !== 'online';
    document.getElementById('btnOnlineJoin').disabled = state !== 'online';
    if (state === 'offline') message.textContent = t('online.serverOffline');
    else if (message.textContent === t('online.serverOffline')) message.textContent = '';
    renderRoom();
  }

  async function copyInvite() {
    if (!room?.code) return;
    const url = new URL(location.href);
    url.searchParams.set('room', room.code);
    try {
      await navigator.clipboard.writeText(url.href);
      toast(t('online.copied'));
    } catch {
      toast(t('online.copyFailed'));
    }
  }

  document.getElementById('btnOnlineCreate').addEventListener('click', () => {
    if (!validateName()) return;
    net.createFresh(mode, profile.char);
  });
  document.getElementById('btnOnlineJoin').addEventListener('click', () => {
    if (!validateName()) return;
    const code = codeInput.value.trim().toUpperCase();
    if (!/^[A-Z]{4}$/.test(code)) {
      message.textContent = t('online.codeRequired');
      codeInput.focus();
      return;
    }
    net.join(code, profile.name, profile.char);
  });
  codeInput.addEventListener('input', () => { codeInput.value = codeInput.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 4); });
  codeInput.addEventListener('keydown', (event) => { if (event.key === 'Enter') document.getElementById('btnOnlineJoin').click(); });
  nameInput.addEventListener('change', validateName);
  document.querySelectorAll('[data-online-mode]').forEach((button) => button.addEventListener('click', () => setMode(button.dataset.onlineMode)));
  document.getElementById('btnOnlineReady').addEventListener('click', () => net.ready(!ready));
  document.getElementById('btnOnlineStart').addEventListener('click', () => net.start());
  document.getElementById('btnOnlineLeave').addEventListener('click', () => net.leave());
  document.getElementById('btnOnlineCopy').addEventListener('click', copyInvite);
  document.getElementById('online-room-code').addEventListener('click', copyInvite);

  net.on('welcome', (message) => {
    if (message.room) showRoom(message.room);
    else showSetup();
  });
  net.on('lobby', (message) => {
    room = message.room ?? room;
    players = Array.isArray(message.players) ? message.players : [];
    renderRoom();
  });
  net.on('status', updateStatus);
  net.on('error', (error) => {
    const text = t(`online.error.${error.code}`) === `online.error.${error.code}` ? t('online.errorGeneric') : t(`online.error.${error.code}`);
    if (inRoom) roomMessage.textContent = text;
    else message.textContent = text;
    toast(text);
  });

  renderCharacters();
  setMode(mode);

  return {
    hide: () => { lobby.hidden = true; },
    showSetup,
    toast,
    get profile() { return { ...profile }; },
    get mode() { return mode; },
    get room() { return room; },
    get players() { return players; },
    get inRoom() { return inRoom; },
    get isHost() { return room?.hostId === net.playerId; },
  };
}
